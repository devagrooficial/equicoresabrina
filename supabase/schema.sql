-- ============================================================
-- EquiCore — Schema completo
-- Cole no Supabase SQL Editor e execute na ordem
-- ============================================================

-- -----------------------------------------------------------
-- 1. Tabela profiles (extensão de auth.users)
-- -----------------------------------------------------------
create table if not exists profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text,
  phone       text,
  farm_name   text,
  plan        text default 'free' check (plan in ('free','starter','pro','haras')),
  created_at  timestamptz default now()
);

alter table profiles enable row level security;

create policy "Usuário gerencia próprio perfil"
  on profiles for all
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Trigger: cria profile automaticamente após signup
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into profiles (id, full_name, phone, farm_name, plan)
  values (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'phone',
    new.raw_user_meta_data->>'farm_name',
    coalesce(new.raw_user_meta_data->>'plan', 'free')
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- -----------------------------------------------------------
-- 2. Tabela equinos
-- -----------------------------------------------------------
create table if not exists equinos (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now(),

  -- Etapa 1 — Identificação
  name          text not null,
  nickname      text,
  breed         text not null,
  breed_other   text,
  sex           text not null,
  coat          text not null,
  coat_other    text,
  birth_date    date,
  estimated_age int,
  microchip     text,
  brand_desc    text,
  purpose       text[] not null default '{}',
  stable        text,

  -- Etapa 2 — Registros
  reg_abqm      text,
  reg_abccm     text,
  reg_abpsi     text,
  reg_abccc     text,
  reg_other     text,
  reg_entity    text,
  passport      text,

  -- Etapa 3 — Atividade
  competition_level  text,
  training_status    text,

  -- Etapa 4 — Nutrição
  feed_kg_day   numeric(5,2),
  feed_brand    text,
  hay_kg_day    numeric(5,2),
  hay_type      text,
  water_access  text,
  supplements   text,

  -- Etapa 5 — Físico
  weight_kg     numeric(6,1),
  height_cm     numeric(5,1),
  last_weight   date,
  bcs           int check (bcs between 1 and 9),
  is_pregnant   boolean default false,
  foaling_date  date,
  breeding_method text,

  -- Etapa 6 — Genealogia
  father_name   text,
  father_reg    text,
  mother_name   text,
  mother_reg    text,
  pat_grandfather text,
  pat_grandmother text,
  mat_grandfather text,
  mat_grandmother text,

  -- Status de saúde
  health_status text default 'healthy'
    check (health_status in ('healthy','attention','urgent','critical'))
);

alter table equinos enable row level security;

create policy "Usuário gerencia próprios equinos"
  on equinos for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Trigger: atualiza updated_at automaticamente
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists equinos_updated_at on equinos;
create trigger equinos_updated_at
  before update on equinos
  for each row execute procedure update_updated_at();

-- -----------------------------------------------------------
-- 3. Índices úteis
-- -----------------------------------------------------------
create index if not exists equinos_user_id_idx on equinos (user_id);
create index if not exists equinos_health_status_idx on equinos (user_id, health_status);
