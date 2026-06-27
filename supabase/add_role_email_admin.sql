-- ============================================================
-- EquiCore — Migration segura: role, email, admin, crmv, specialty
-- Cole e execute TODO o bloco de uma vez no Supabase SQL Editor
-- ============================================================

BEGIN;

-- ── Passo 1: Trigger seguro ───────────────────────────────────────────────
-- Usa SQL dinâmico para detectar se as novas colunas existem.
-- Funciona ANTES e DEPOIS de adicionar as colunas — nunca quebra o signup.
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  _has_role boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'profiles'
      AND column_name  = 'role'
  ) INTO _has_role;

  IF _has_role THEN
    EXECUTE '
      INSERT INTO profiles
        (id, full_name, phone, farm_name, plan, email, role, admin, crmv, specialty)
      VALUES ($1, $2, $3, $4, $5, $6, $7, false, $8, $9)
    ' USING
      new.id,
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'phone',
      new.raw_user_meta_data->>'farm_name',
      COALESCE(new.raw_user_meta_data->>'plan', 'free'),
      new.email,
      COALESCE(new.raw_user_meta_data->>'role', 'dono'),
      new.raw_user_meta_data->>'crmv',
      new.raw_user_meta_data->>'specialty';
  ELSE
    -- Fallback para schema antigo (sem novas colunas)
    INSERT INTO profiles (id, full_name, phone, farm_name, plan)
    VALUES (
      new.id,
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'phone',
      new.raw_user_meta_data->>'farm_name',
      COALESCE(new.raw_user_meta_data->>'plan', 'free')
    );
  END IF;

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE handle_new_user();

-- ── Passo 2: Adiciona as novas colunas ────────────────────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS email      text,
  ADD COLUMN IF NOT EXISTS admin      boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS role       text    NOT NULL DEFAULT 'dono'
    CHECK (role IN ('dono', 'veterinario')),
  ADD COLUMN IF NOT EXISTS crmv       text,
  ADD COLUMN IF NOT EXISTS specialty  text;

-- ── Passo 3: Retroalimenta email nos perfis existentes ────────────────────
UPDATE profiles p
  SET email = u.email
  FROM auth.users u
  WHERE p.id = u.id
    AND p.email IS NULL;

COMMIT;
