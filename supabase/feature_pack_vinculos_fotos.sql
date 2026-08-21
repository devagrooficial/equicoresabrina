-- ============================================================
-- EquiCore — Pacote: vínculo dono↔veterinário + fotos obrigatórias
-- Execute no SQL Editor do Supabase (bloco único, idempotente)
-- ============================================================

BEGIN;

-- -----------------------------------------------------------
-- 1. vet_owner_links — vínculo dono ↔ veterinário
-- -----------------------------------------------------------
-- owner_name/owner_email são denormalizados no INSERT (feito pelo próprio
-- dono, cuja RLS permite) porque a RLS de "profiles" não permite que o
-- veterinário/admin façam lookup direto do perfil do dono.

create table if not exists vet_owner_links (
  id                 uuid primary key default gen_random_uuid(),
  owner_id           uuid not null references auth.users(id) on delete cascade,
  vet_id             uuid references auth.users(id) on delete set null,
  owner_name         text,
  owner_email        text,
  status             text not null default 'pending' check (status in ('pending','accepted','rejected')),
  requested_at       timestamptz not null default now(),
  resolved_at        timestamptz,
  assigned_by_admin  boolean not null default false,
  note               text
);

create index if not exists vet_owner_links_owner_id_idx on vet_owner_links (owner_id);
create index if not exists vet_owner_links_vet_id_idx   on vet_owner_links (vet_id);
create index if not exists vet_owner_links_status_idx   on vet_owner_links (status);

alter table vet_owner_links enable row level security;

-- SELECT: dono vê os próprios pedidos
drop policy if exists "vinculos: dono vê os próprios" on vet_owner_links;
create policy "vinculos: dono vê os próprios"
  on vet_owner_links for select
  using (owner_id = auth.uid());

-- SELECT: veterinário vê pedidos endereçados a ele
drop policy if exists "vinculos: vet vê os endereçados a ele" on vet_owner_links;
create policy "vinculos: vet vê os endereçados a ele"
  on vet_owner_links for select
  using (vet_id = auth.uid());

-- SELECT/UPDATE: admin vê e gerencia tudo (fallback de atribuição)
drop policy if exists "vinculos: admin vê tudo" on vet_owner_links;
create policy "vinculos: admin vê tudo"
  on vet_owner_links for select
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.admin = true));

drop policy if exists "vinculos: admin gerencia tudo" on vet_owner_links;
create policy "vinculos: admin gerencia tudo"
  on vet_owner_links for update
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.admin = true))
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.admin = true));

-- INSERT: dono cria o próprio pedido
drop policy if exists "vinculos: dono cria o próprio pedido" on vet_owner_links;
create policy "vinculos: dono cria o próprio pedido"
  on vet_owner_links for insert
  with check (owner_id = auth.uid());

-- UPDATE: veterinário aceita/recusa pedidos endereçados a ele
drop policy if exists "vinculos: vet responde ao próprio pedido" on vet_owner_links;
create policy "vinculos: vet responde ao próprio pedido"
  on vet_owner_links for update
  using (vet_id = auth.uid())
  with check (vet_id = auth.uid());

-- -----------------------------------------------------------
-- 2. search_veterinarios — busca de veterinários por nome/CRMV
--    (profiles tem RLS restrita a auth.uid() = id; função SECURITY
--    DEFINER permite que dono/admin busquem veterinários por CRMV/nome)
-- -----------------------------------------------------------

create or replace function public.search_veterinarios(p_query text)
returns table (
  id         uuid,
  full_name  text,
  crmv       text,
  specialty  text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if length(trim(coalesce(p_query, ''))) < 2 then
    return;
  end if;

  return query
    select p.id, p.full_name, p.crmv, p.specialty
    from profiles p
    where p.role = 'veterinario'
      and (
        p.full_name ilike '%' || p_query || '%'
        or p.crmv ilike '%' || p_query || '%'
      )
    order by p.full_name
    limit 20;
end;
$$;

revoke all on function public.search_veterinarios(text) from public, anon;
grant execute on function public.search_veterinarios(text) to authenticated;

-- -----------------------------------------------------------
-- 3. Fotos obrigatórias do dono + capa do perfil do animal
-- -----------------------------------------------------------

alter table equinos
  add column if not exists photo_frente             text,
  add column if not exists photo_costas              text,
  add column if not exists photo_lateral_esquerda    text,
  add column if not exists photo_lateral_direita     text,
  add column if not exists cover_photo_url            text;

-- -----------------------------------------------------------
-- 4. Marca de fogo — cadastro do animal pelo veterinário
-- -----------------------------------------------------------

alter table vet_equines
  add column if not exists marca_fogo_url text;

COMMIT;
