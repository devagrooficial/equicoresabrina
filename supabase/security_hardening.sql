-- ============================================================
-- EquiCore — Hardening de Segurança
-- Execute no SQL Editor do Supabase (bloco único)
-- ============================================================
-- Cobre:
--   1. Storage: leitura autenticada + writes path-scoped por vet
--   2. vet_equines: controle de compartilhamento com o dono (LGPD)
--   3. lookup_owner_by_cpf: restrito a veterinários autenticados
--   4. Audit log (LGPD Art. 37) em vet_owners e vet_equines
-- ============================================================

BEGIN;

-- -----------------------------------------------------------
-- 1. Storage — bucket "docs"
--    IMPORTANTE: no painel do Supabase, marque o bucket "docs"
--    como privado (Public = OFF) antes de rodar esta migration.
-- -----------------------------------------------------------

-- Remove a policy de leitura pública irrestrita
DROP POLICY IF EXISTS "docs: leitura pública"    ON storage.objects;

-- Leitura: apenas usuários autenticados
DROP POLICY IF EXISTS "docs: leitura autenticada" ON storage.objects;
CREATE POLICY "docs: leitura autenticada"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'docs');

-- Upload: path obrigatoriamente começa com o uid do veterinário
-- Formato esperado: {uid}/equinos/{equineId}/{arquivo}
DROP POLICY IF EXISTS "docs: upload autenticado" ON storage.objects;
CREATE POLICY "docs: upload autenticado"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'docs'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Update: somente o próprio dono do path
DROP POLICY IF EXISTS "docs: update autenticado" ON storage.objects;
CREATE POLICY "docs: update autenticado"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING  (bucket_id = 'docs' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'docs' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Delete: dono do path (novo formato) OU dono do equino (formato legado equinos/{id}/...)
DROP POLICY IF EXISTS "docs: delete autenticado" ON storage.objects;
CREATE POLICY "docs: delete autenticado"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'docs'
    AND (
      -- Novo formato: {uid}/equinos/{equineId}/arquivo
      (storage.foldername(name))[1] = auth.uid()::text
      -- Formato legado: equinos/{equineId}/arquivo — verifica via RLS da tabela
      OR (
        (storage.foldername(name))[1] = 'equinos'
        AND EXISTS (
          SELECT 1 FROM vet_equines e
          WHERE e.id::text = (storage.foldername(name))[2]
            AND e.vet_id = auth.uid()
        )
      )
    )
  );

-- -----------------------------------------------------------
-- 2. vet_equines — controle explícito de compartilhamento
-- -----------------------------------------------------------

ALTER TABLE vet_equines
  ADD COLUMN IF NOT EXISTS shared_with_owner boolean NOT NULL DEFAULT false;

-- Reescreve a policy do dono: só enxerga quando o vet ativar o compartilhamento
DROP POLICY IF EXISTS "Dono vê equinos do seu CPF" ON vet_equines;
CREATE POLICY "Dono vê equinos do seu CPF"
  ON vet_equines FOR SELECT
  USING (
    shared_with_owner = true
    AND public.vet_equine_belongs_to_user(owner_id)
  );

-- -----------------------------------------------------------
-- 3. lookup_owner_by_cpf — restrito a veterinários
-- -----------------------------------------------------------

CREATE OR REPLACE FUNCTION public.lookup_owner_by_cpf(p_cpf text)
RETURNS TABLE (
  source           text,
  name             text,
  phone            text,
  email            text,
  address          text,
  district         text,
  cep              text,
  uf               text,
  city             text,
  producer_number  text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cpf  text := regexp_replace(coalesce(p_cpf, ''), '\D', '', 'g');
  v_role text;
BEGIN
  -- Verifica role do chamador — apenas veterinários podem consultar
  SELECT role INTO v_role FROM profiles WHERE id = auth.uid();
  IF v_role IS DISTINCT FROM 'veterinario' THEN
    RETURN;
  END IF;

  IF length(v_cpf) < 11 THEN
    RETURN;
  END IF;

  -- 1º: proprietário já cadastrado por qualquer veterinário
  RETURN QUERY
    SELECT 'cadastro'::text, o.name, o.phone, o.email, o.address,
           o.district, o.cep, o.uf, o.city, o.producer_number
    FROM vet_owners o
    WHERE o.cpf_cnpj = v_cpf
    ORDER BY o.updated_at DESC
    LIMIT 1;
  IF found THEN RETURN; END IF;

  -- 2º: usuário do app com CPF preenchido no perfil
  RETURN QUERY
    SELECT 'usuario'::text, pr.full_name, pr.phone, pr.email,
           null::text, null::text, null::text, null::text, null::text, null::text
    FROM profiles pr
    WHERE regexp_replace(coalesce(pr.cpf, ''), '\D', '', 'g') = v_cpf
    LIMIT 1;
END;
$$;

REVOKE ALL ON FUNCTION public.lookup_owner_by_cpf(text) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.lookup_owner_by_cpf(text) TO authenticated;

-- -----------------------------------------------------------
-- 4. Audit log — LGPD Art. 37 (rastreabilidade de acesso)
-- -----------------------------------------------------------

CREATE TABLE IF NOT EXISTS audit_log (
  id          bigserial    PRIMARY KEY,
  ts          timestamptz  NOT NULL DEFAULT now(),
  actor_id    uuid         REFERENCES auth.users(id) ON DELETE SET NULL,
  table_name  text         NOT NULL,
  operation   text         NOT NULL CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),
  record_id   uuid         NOT NULL,
  old_data    jsonb,
  new_data    jsonb
);

-- Índices para consultas de auditoria
CREATE INDEX IF NOT EXISTS audit_log_actor_idx  ON audit_log (actor_id);
CREATE INDEX IF NOT EXISTS audit_log_record_idx ON audit_log (record_id);
CREATE INDEX IF NOT EXISTS audit_log_ts_idx     ON audit_log (ts DESC);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Nenhum usuário acessa diretamente — apenas via service_role (admin/dashboard)
DROP POLICY IF EXISTS "audit_log: sem acesso direto" ON audit_log;
CREATE POLICY "audit_log: sem acesso direto"
  ON audit_log FOR ALL
  USING (false);

-- Função de trigger para log de auditoria
CREATE OR REPLACE FUNCTION public.fn_audit_log()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO audit_log (actor_id, table_name, operation, record_id, old_data, new_data)
  VALUES (
    auth.uid(),
    TG_TABLE_NAME,
    TG_OP,
    CASE TG_OP WHEN 'DELETE' THEN OLD.id ELSE NEW.id END,
    CASE TG_OP WHEN 'INSERT' THEN NULL ELSE to_jsonb(OLD) END,
    CASE TG_OP WHEN 'DELETE' THEN NULL ELSE to_jsonb(NEW) END
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Triggers nas tabelas com dados pessoais sensíveis
DROP TRIGGER IF EXISTS audit_vet_owners ON vet_owners;
CREATE TRIGGER audit_vet_owners
  AFTER INSERT OR UPDATE OR DELETE ON vet_owners
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log();

DROP TRIGGER IF EXISTS audit_vet_equines ON vet_equines;
CREATE TRIGGER audit_vet_equines
  AFTER INSERT OR UPDATE OR DELETE ON vet_equines
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log();

COMMIT;
