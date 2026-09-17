-- ============================================================
-- EquiCore — Assinatura mensal via Stripe (dono do haras)
-- Execute no SQL Editor do Supabase (bloco único, idempotente)
-- ============================================================

BEGIN;

-- -----------------------------------------------------------
-- 1. billing_settings — valor único e dinâmico da assinatura
--    (linha única, id fixo = 1; editável apenas pelo admin)
-- -----------------------------------------------------------

create table if not exists billing_settings (
  id                  smallint primary key default 1 check (id = 1),
  product_name        text not null default 'EquiCore Haras',
  monthly_price_cents integer not null default 9900 check (monthly_price_cents >= 0),
  currency            text not null default 'brl',
  trial_days          integer not null default 0 check (trial_days >= 0),
  updated_at          timestamptz not null default now()
);

insert into billing_settings (id) values (1)
  on conflict (id) do nothing;

alter table billing_settings enable row level security;

-- SELECT: qualquer usuário autenticado (precisa ver o preço antes de assinar)
drop policy if exists "billing_settings: leitura autenticada" on billing_settings;
create policy "billing_settings: leitura autenticada"
  on billing_settings for select
  to authenticated
  using (true);

-- UPDATE: só admin
drop policy if exists "billing_settings: admin edita" on billing_settings;
create policy "billing_settings: admin edita"
  on billing_settings for update
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.admin = true))
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.admin = true));

drop trigger if exists billing_settings_updated_at on billing_settings;
create trigger billing_settings_updated_at
  before update on billing_settings
  for each row execute procedure update_updated_at();

-- -----------------------------------------------------------
-- 2. subscriptions — estado da assinatura Stripe de cada dono
--    Gravada apenas pelo webhook (service_role, contorna RLS) —
--    sem policy de insert/update para clientes.
--
--    owner_name/owner_email/farm_name são denormalizados na
--    gravação (mesmo motivo de vet_owner_links: a RLS de
--    "profiles" é auth.uid() = id e não deixa o admin ler o
--    perfil de terceiros).
-- -----------------------------------------------------------

create table if not exists subscriptions (
  id                     uuid primary key default gen_random_uuid(),
  owner_id               uuid not null unique references auth.users(id) on delete cascade,
  stripe_customer_id     text,
  stripe_subscription_id text unique,
  status                 text not null default 'none',
  price_cents            integer,
  currency               text,
  current_period_end     timestamptz,
  cancel_at_period_end   boolean not null default false,
  owner_name             text,
  owner_email            text,
  farm_name              text,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create index if not exists subscriptions_owner_id_idx           on subscriptions (owner_id);
create index if not exists subscriptions_stripe_customer_id_idx on subscriptions (stripe_customer_id);
create index if not exists subscriptions_status_idx             on subscriptions (status);

alter table subscriptions enable row level security;

-- SELECT: dono vê a própria assinatura
drop policy if exists "subscriptions: dono vê a própria" on subscriptions;
create policy "subscriptions: dono vê a própria"
  on subscriptions for select
  using (owner_id = auth.uid());

-- SELECT: admin vê tudo
drop policy if exists "subscriptions: admin vê tudo" on subscriptions;
create policy "subscriptions: admin vê tudo"
  on subscriptions for select
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.admin = true));

drop trigger if exists subscriptions_updated_at on subscriptions;
create trigger subscriptions_updated_at
  before update on subscriptions
  for each row execute procedure update_updated_at();

COMMIT;
