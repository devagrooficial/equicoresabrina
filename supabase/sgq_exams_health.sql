-- ============================================================
-- EquiCore — Integração SGQ, parte 2: exames, histórico de saúde,
-- foto do portal e etapas novas da sincronização.
-- Pré-requisito: sgq_integration.sql já aplicado.
-- Cole e execute TODO o bloco de uma vez no Supabase SQL Editor
-- ============================================================

BEGIN;

-- -----------------------------------------------------------
-- 1. Sincronização: nova etapa (exames) e novos tipos de item
-- -----------------------------------------------------------
alter table sgq_sync_jobs drop constraint if exists sgq_sync_jobs_phase_check;
alter table sgq_sync_jobs add constraint sgq_sync_jobs_phase_check
  check (phase in ('owners', 'properties', 'animals', 'exams', 'details', 'done'));

alter table sgq_sync_items drop constraint if exists sgq_sync_items_kind_check;
alter table sgq_sync_items add constraint sgq_sync_items_kind_check
  check (kind in ('owner', 'animal', 'property', 'requisition'));

-- -----------------------------------------------------------
-- 2. Foto única do animal vinda do portal (o EquiCore tem 4
--    ângulos obrigatórios; a do portal não tem ângulo definido)
-- -----------------------------------------------------------
alter table vet_equines
  add column if not exists portal_photo_url text;

-- -----------------------------------------------------------
-- 3. Exames (requisições de AIE e mormo)
--    equine_id pode ficar nulo enquanto o exame não é ligado a
--    um animal (nome ambíguo); owner_name/animal_name guardam o
--    que o portal mostra.
-- -----------------------------------------------------------
create table if not exists vet_equine_exams (
  id               uuid primary key default gen_random_uuid(),
  vet_id           uuid not null references auth.users(id) on delete cascade,
  equine_id        uuid references vet_equines(id) on delete cascade,
  exam_type        text not null check (exam_type in ('aieidga', 'aieelisa', 'mormoelisa')),
  number           text not null,                 -- nº da requisição (PCR...)
  sgq_code         text,                          -- código interno no portal
  requested_date   date,
  collection_date  date,
  laboratory       text,
  laudo_available  boolean not null default false,
  laudo_path       text,                          -- PDF no bucket docs (baixado sob demanda)
  owner_name       text,
  animal_name      text,
  created_at       timestamptz default now(),
  updated_at       timestamptz default now(),
  unique (vet_id, number)
);

create index if not exists vet_equine_exams_equine_idx on vet_equine_exams (equine_id);
create index if not exists vet_equine_exams_vet_idx    on vet_equine_exams (vet_id, collection_date desc);

alter table vet_equine_exams enable row level security;

drop policy if exists "Vet gerencia próprios exames" on vet_equine_exams;
create policy "Vet gerencia próprios exames"
  on vet_equine_exams for all
  using (auth.uid() = vet_id)
  with check (auth.uid() = vet_id);

-- Dono enxerga exames dos animais que o veterinário compartilhou com ele
drop policy if exists "Dono vê exames dos equinos compartilhados" on vet_equine_exams;
create policy "Dono vê exames dos equinos compartilhados"
  on vet_equine_exams for select
  using (
    exists (
      select 1 from vet_equines e
      where e.id = vet_equine_exams.equine_id
        and e.shared_with_owner = true
        and public.vet_equine_belongs_to_user(e.owner_id)
    )
  );

drop trigger if exists vet_equine_exams_updated_at on vet_equine_exams;
create trigger vet_equine_exams_updated_at
  before update on vet_equine_exams
  for each row execute procedure update_updated_at();

-- -----------------------------------------------------------
-- 4. Histórico de saúde (vacinas, vermifugações, medicamentos,
--    pesagens, reprodução, observações clínicas)
--    data: colunas exatamente como aparecem no portal.
-- -----------------------------------------------------------
create table if not exists vet_equine_health_records (
  id          uuid primary key default gen_random_uuid(),
  vet_id      uuid not null references auth.users(id) on delete cascade,
  equine_id   uuid not null references vet_equines(id) on delete cascade,
  kind        text not null
              check (kind in ('vacina', 'vermifugacao', 'medicamento', 'pesagem', 'reproducao', 'observacao')),
  event_date  date,
  title       text,
  data        jsonb not null default '{}'::jsonb,
  source      text not null default 'sgq',
  source_key  text not null,                      -- impede duplicar ao sincronizar de novo
  created_at  timestamptz default now(),
  unique (equine_id, kind, source_key)
);

create index if not exists vet_equine_health_equine_idx
  on vet_equine_health_records (equine_id, kind, event_date desc);

alter table vet_equine_health_records enable row level security;

drop policy if exists "Vet gerencia próprio histórico de saúde" on vet_equine_health_records;
create policy "Vet gerencia próprio histórico de saúde"
  on vet_equine_health_records for all
  using (auth.uid() = vet_id)
  with check (auth.uid() = vet_id);

drop policy if exists "Dono vê histórico dos equinos compartilhados" on vet_equine_health_records;
create policy "Dono vê histórico dos equinos compartilhados"
  on vet_equine_health_records for select
  using (
    exists (
      select 1 from vet_equines e
      where e.id = vet_equine_health_records.equine_id
        and e.shared_with_owner = true
        and public.vet_equine_belongs_to_user(e.owner_id)
    )
  );

COMMIT;
