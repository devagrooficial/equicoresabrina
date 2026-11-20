-- ============================================================
-- EquiCore — Integração com o Portal Central de Requisições (SGQ)
-- Importa proprietários, propriedades e equinos da conta do
-- veterinário no portal SGQ para as tabelas vet_*.
-- Cole e execute TODO o bloco de uma vez no Supabase SQL Editor
-- ============================================================

BEGIN;

-- -----------------------------------------------------------
-- 1. Código de origem no portal (idempotência da importação)
--    Proprietários não precisam: a chave é o CPF/CNPJ.
-- -----------------------------------------------------------
alter table vet_properties
  add column if not exists sgq_code text;

alter table vet_equines
  add column if not exists sgq_code      text,
  add column if not exists sgq_synced_at timestamptz;   -- ficha completa já importada

create unique index if not exists vet_properties_sgq_code_uidx
  on vet_properties (vet_id, sgq_code) where sgq_code is not null;

create unique index if not exists vet_equines_sgq_code_uidx
  on vet_equines (vet_id, sgq_code) where sgq_code is not null;

-- -----------------------------------------------------------
-- 2. Credenciais da integração (por veterinário)
--    secret_enc / session_enc: AES-256-GCM, chave em SGQ_CRED_KEY
--    (variável de ambiente do servidor — nunca no banco).
--    RLS ligado SEM policies: só o servidor (service_role) acessa.
-- -----------------------------------------------------------
create table if not exists vet_integrations (
  vet_id        uuid not null references auth.users(id) on delete cascade,
  provider      text not null,                 -- 'sgq'
  username      text not null,
  secret_enc    text not null,
  session_enc   text,
  consent_at    timestamptz not null,          -- aceite do termo de importação
  last_sync_at  timestamptz,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now(),
  primary key (vet_id, provider)
);

alter table vet_integrations enable row level security;

drop trigger if exists vet_integrations_updated_at on vet_integrations;
create trigger vet_integrations_updated_at
  before update on vet_integrations
  for each row execute procedure update_updated_at();

-- -----------------------------------------------------------
-- 3. Jobs de sincronização e fila de itens
--    Também sem policies: leitura/escrita só pelas rotas /api/sgq.
-- -----------------------------------------------------------
create table if not exists sgq_sync_jobs (
  id            uuid primary key default gen_random_uuid(),
  vet_id        uuid not null references auth.users(id) on delete cascade,
  status        text not null default 'running'
                check (status in ('running', 'done', 'error', 'cancelled')),
  phase         text not null default 'owners'
                check (phase in ('owners', 'properties', 'animals', 'details', 'done')),
  stats         jsonb not null default '{}'::jsonb,
  error         text,
  started_at    timestamptz not null default now(),
  -- trava de passo: um passo por vez e intervalo mínimo entre acessos ao portal
  tick_lock_until timestamptz not null default 'epoch',
  finished_at   timestamptz
);

create index if not exists sgq_sync_jobs_vet_idx on sgq_sync_jobs (vet_id, started_at desc);

-- No máximo um job em andamento por veterinário
create unique index if not exists sgq_sync_jobs_running_uidx
  on sgq_sync_jobs (vet_id) where status = 'running';

alter table sgq_sync_jobs enable row level security;

create table if not exists sgq_sync_items (
  id        bigserial primary key,
  job_id    uuid not null references sgq_sync_jobs(id) on delete cascade,
  kind      text not null check (kind in ('owner', 'animal')),
  sgq_code  text not null,
  label     text,                               -- nome normalizado (casamento por nome)
  local_id  uuid,                               -- vet_owners.id / vet_equines.id
  status    text not null default 'pending'
            check (status in ('pending', 'done', 'error', 'skipped')),
  note      text,
  unique (job_id, kind, sgq_code)
);

create index if not exists sgq_sync_items_pending_idx
  on sgq_sync_items (job_id, status, kind, id);

alter table sgq_sync_items enable row level security;

COMMIT;
