-- ============================================================
-- EquiCore — Anexos de documentos (Supabase Storage)
-- Execute no SQL Editor. Pré-requisito: bucket público "docs" criado.
-- ============================================================

-- -----------------------------------------------------------
-- 1. Colunas de anexo em equine_alerts
-- -----------------------------------------------------------
alter table equine_alerts add column if not exists attachment_url  text;
alter table equine_alerts add column if not exists attachment_name text;

-- -----------------------------------------------------------
-- 2. Políticas de acesso ao bucket "docs"
--    Leitura pública (bucket é público) + escrita autenticada
-- -----------------------------------------------------------

-- Upload (insert) por usuários autenticados
drop policy if exists "docs: upload autenticado" on storage.objects;
create policy "docs: upload autenticado"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'docs');

-- Atualização/substituição por usuários autenticados
drop policy if exists "docs: update autenticado" on storage.objects;
create policy "docs: update autenticado"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'docs')
  with check (bucket_id = 'docs');

-- Remoção por usuários autenticados
drop policy if exists "docs: delete autenticado" on storage.objects;
create policy "docs: delete autenticado"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'docs');

-- Leitura pública dos arquivos
drop policy if exists "docs: leitura pública" on storage.objects;
create policy "docs: leitura pública"
  on storage.objects for select
  using (bucket_id = 'docs');
