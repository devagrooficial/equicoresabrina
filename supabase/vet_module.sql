-- ============================================================
-- EquiCore — Módulo Veterinário
-- Cadastros de Propriedade, Proprietário e Equino (área vet)
-- Cole e execute TODO o bloco de uma vez no Supabase SQL Editor
-- ============================================================

BEGIN;

-- -----------------------------------------------------------
-- 0. Pré-requisitos
-- -----------------------------------------------------------
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- CPF no perfil do usuário do app (dono) — elo da cadeia de
-- associação proprietário ↔ equino via CPF
alter table profiles add column if not exists cpf text;

-- -----------------------------------------------------------
-- 1. Propriedades cadastradas pelo veterinário
-- -----------------------------------------------------------
create table if not exists vet_properties (
  id              uuid primary key default gen_random_uuid(),
  vet_id          uuid not null references auth.users(id) on delete cascade,
  name            text not null,
  address         text,                 -- endereço ou coordenadas
  oesa_code       text,                 -- Nº Cadastro OESA
  uf              text,
  city            text,
  classification  text,
  animal_count    int,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

create index if not exists vet_properties_vet_id_idx on vet_properties (vet_id);

alter table vet_properties enable row level security;

drop policy if exists "Vet gerencia próprias propriedades" on vet_properties;
create policy "Vet gerencia próprias propriedades"
  on vet_properties for all
  using (auth.uid() = vet_id)
  with check (auth.uid() = vet_id);

drop trigger if exists vet_properties_updated_at on vet_properties;
create trigger vet_properties_updated_at
  before update on vet_properties
  for each row execute procedure update_updated_at();

-- -----------------------------------------------------------
-- 2. Proprietários cadastrados pelo veterinário
--    cpf_cnpj é armazenado SOMENTE com dígitos
-- -----------------------------------------------------------
create table if not exists vet_owners (
  id               uuid primary key default gen_random_uuid(),
  vet_id           uuid not null references auth.users(id) on delete cascade,
  name             text not null,
  cpf_cnpj         text not null,
  phone            text,
  email            text,
  address          text,
  district         text,                -- bairro
  cep              text,
  uf               text,
  city             text,
  producer_number  text,                -- Nº do Produtor
  created_at       timestamptz default now(),
  updated_at       timestamptz default now(),
  unique (vet_id, cpf_cnpj)
);

create index if not exists vet_owners_vet_id_idx   on vet_owners (vet_id);
create index if not exists vet_owners_cpf_cnpj_idx on vet_owners (cpf_cnpj);

alter table vet_owners enable row level security;

drop policy if exists "Vet gerencia próprios proprietários" on vet_owners;
create policy "Vet gerencia próprios proprietários"
  on vet_owners for all
  using (auth.uid() = vet_id)
  with check (auth.uid() = vet_id);

drop trigger if exists vet_owners_updated_at on vet_owners;
create trigger vet_owners_updated_at
  before update on vet_owners
  for each row execute procedure update_updated_at();

-- -----------------------------------------------------------
-- 3. Equinos cadastrados pelo veterinário
--    Sempre associado a um proprietário (via CPF);
--    propriedade é OPCIONAL (o animal pode estar em outra).
-- -----------------------------------------------------------
create table if not exists vet_equines (
  id              uuid primary key default gen_random_uuid(),
  vet_id          uuid not null references auth.users(id) on delete cascade,
  owner_id        uuid not null references vet_owners(id) on delete restrict,
  property_id     uuid references vet_properties(id) on delete set null,
  name            text not null,
  registry_brand  text,                 -- Registro/Marca
  chip            text,                 -- Nº Chip
  species         text,                 -- Espécie (Equina/Asinina/Muar)
  breed           text,                 -- Raça
  coat            text,                 -- Pelagem
  sex             text,                 -- Sexo
  birth_date      date,
  age_years       int,
  signs_desc      text,                 -- Descrição de sinais
  resenha_url     text,                 -- PNG da resenha gráfica (bucket docs)
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

create index if not exists vet_equines_vet_id_idx   on vet_equines (vet_id);
create index if not exists vet_equines_owner_id_idx on vet_equines (owner_id);

alter table vet_equines enable row level security;

drop policy if exists "Vet gerencia próprios equinos" on vet_equines;
create policy "Vet gerencia próprios equinos"
  on vet_equines for all
  using (auth.uid() = vet_id)
  with check (auth.uid() = vet_id);

drop trigger if exists vet_equines_updated_at on vet_equines;
create trigger vet_equines_updated_at
  before update on vet_equines
  for each row execute procedure update_updated_at();

-- -----------------------------------------------------------
-- 4. Cadeia de associação via CPF:
--    dono do app (profiles.cpf) enxerga os equinos vinculados
--    ao proprietário com o mesmo CPF.
--    (security definer para atravessar o RLS de vet_owners)
-- -----------------------------------------------------------
create or replace function public.vet_equine_belongs_to_user(p_owner_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from vet_owners o
    join profiles p
      on regexp_replace(coalesce(p.cpf, ''), '\D', '', 'g') = o.cpf_cnpj
    where o.id = p_owner_id
      and p.id = auth.uid()
      and coalesce(p.cpf, '') <> ''
  );
$$;

drop policy if exists "Dono vê equinos do seu CPF" on vet_equines;
create policy "Dono vê equinos do seu CPF"
  on vet_equines for select
  using (public.vet_equine_belongs_to_user(owner_id));

-- -----------------------------------------------------------
-- 5. Busca de proprietário pelo cadastro geral via CPF/CNPJ
--    1º: proprietários já cadastrados por qualquer veterinário
--    2º: usuários do app (donos) com CPF preenchido no perfil
-- -----------------------------------------------------------
create or replace function public.lookup_owner_by_cpf(p_cpf text)
returns table (
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
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cpf text := regexp_replace(coalesce(p_cpf, ''), '\D', '', 'g');
begin
  if length(v_cpf) < 11 then
    return;
  end if;

  return query
    select 'cadastro'::text, o.name, o.phone, o.email, o.address,
           o.district, o.cep, o.uf, o.city, o.producer_number
    from vet_owners o
    where o.cpf_cnpj = v_cpf
    order by o.updated_at desc
    limit 1;
  if found then return; end if;

  return query
    select 'usuario'::text, pr.full_name, pr.phone, pr.email,
           null::text, null::text, null::text, null::text, null::text, null::text
    from profiles pr
    where regexp_replace(coalesce(pr.cpf, ''), '\D', '', 'g') = v_cpf
    limit 1;
end;
$$;

revoke all on function public.lookup_owner_by_cpf(text) from public, anon;
grant execute on function public.lookup_owner_by_cpf(text) to authenticated;

COMMIT;
