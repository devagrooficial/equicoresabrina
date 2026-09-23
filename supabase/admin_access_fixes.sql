-- ============================================================
-- EquiCore — Preferências de notificação + acesso admin real
-- Execute no SQL Editor do Supabase (bloco único, idempotente)
-- ============================================================

BEGIN;

-- -----------------------------------------------------------
-- 1. Preferências de notificação do dono (aba "Notificações" do perfil)
-- -----------------------------------------------------------

alter table profiles
  add column if not exists notify_email          boolean not null default true,
  add column if not exists notify_push           boolean not null default false,
  add column if not exists vaccine_reminder_days  int[]   not null default '{30,15,7,3}',
  add column if not exists doc_reminder_days      int[]   not null default '{30,15,7}';

-- -----------------------------------------------------------
-- 2. Acesso admin real (Usuários/Equinos/Dashboard do painel admin)
--    "profiles" é "for all using (auth.uid() = id)" — bloqueia até o
--    admin. Uma policy em "profiles" que reconsulta "profiles" direto
--    num EXISTS entraria em RLS sobre si mesma; em vez disso, uma
--    função SECURITY DEFINER (mesmo padrão de search_veterinarios/
--    lookup_owner_by_cpf) resolve o "sou admin?" ignorando RLS.
-- -----------------------------------------------------------

alter table profiles
  add column if not exists suspended boolean not null default false;

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce((select admin from profiles where id = auth.uid()), false);
$$;

revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

drop policy if exists "profiles: admin vê tudo" on profiles;
create policy "profiles: admin vê tudo"
  on profiles for select
  using (is_admin());

drop policy if exists "profiles: admin gerencia tudo" on profiles;
create policy "profiles: admin gerencia tudo"
  on profiles for update
  using (is_admin())
  with check (is_admin());

drop policy if exists "equinos: admin vê tudo" on equinos;
create policy "equinos: admin vê tudo"
  on equinos for select
  using (is_admin());

drop policy if exists "equine_alerts: admin vê tudo" on equine_alerts;
create policy "equine_alerts: admin vê tudo"
  on equine_alerts for select
  using (is_admin());

COMMIT;
