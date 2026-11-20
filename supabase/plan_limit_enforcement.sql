-- ============================================================
-- EquiCore — Limite de equinos por plano aplicado no banco
-- Execute no SQL Editor do Supabase (bloco único, idempotente)
-- ============================================================
-- O limite já era checado no formulário (EquineFormStepper.tsx), mas
-- qualquer chamada direta à API conseguia passar dele. Este trigger
-- garante o limite independentemente de onde o insert venha.
-- Mantenha os valores em sincronia com PLAN_LIMITS em src/lib/supabase.ts.

BEGIN;

create or replace function public.enforce_equine_plan_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan  text;
  v_limit int;
  v_count int;
begin
  select coalesce(plan, 'free') into v_plan from profiles where id = new.user_id;

  v_limit := case coalesce(v_plan, 'free')
    when 'starter' then 5
    when 'pro'     then 15
    when 'haras'   then null   -- ilimitado
    else 2                     -- free
  end;

  if v_limit is null then
    return new;
  end if;

  select count(*) into v_count from equinos where user_id = new.user_id;

  if v_count >= v_limit then
    raise exception 'PLAN_LIMIT_REACHED: plano % permite até % equinos', coalesce(v_plan, 'free'), v_limit
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists equinos_plan_limit on equinos;
create trigger equinos_plan_limit
  before insert on equinos
  for each row execute procedure public.enforce_equine_plan_limit();

COMMIT;
