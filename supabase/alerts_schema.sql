-- ============================================================
-- EquiCore — Motor de Alertas de Saúde/Documentação
-- Execute no Supabase SQL Editor APÓS o schema.sql principal
-- ============================================================

-- -----------------------------------------------------------
-- 1. Catálogo estático de itens obrigatórios
-- -----------------------------------------------------------
create table if not exists alert_templates (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  category            text not null check (category in ('Vacina', 'Documento', 'Procedimento')),
  description         text,
  periodicity_months  int,                -- intervalo de renovação; null = item único / sob demanda
  created_at          timestamptz default now()
);

-- Catálogo somente-leitura para usuários autenticados
alter table alert_templates enable row level security;

drop policy if exists "Templates visíveis a autenticados" on alert_templates;
create policy "Templates visíveis a autenticados"
  on alert_templates for select
  to authenticated
  using (true);

-- Garante unicidade do nome para o seed idempotente (upsert)
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'alert_templates_name_key') then
    alter table alert_templates add constraint alert_templates_name_key unique (name);
  end if;
end $$;

-- Seed dos itens obrigatórios (idempotente — atualiza descrições/periodicidade ao re-rodar)
-- periodicity_months NULL = documento permanente (usuário só marca Possui / Não Possui)
insert into alert_templates (name, category, description, periodicity_months)
values
  ('Vacina de Raiva',     'Vacina',       'Imunização anual obrigatória contra raiva equina.',                                  12),
  ('Vacina de Tétano',    'Vacina',       'Imunização contra tétano (clostridium tetani).',                                     12),
  ('Vacina de Influenza', 'Vacina',       'Imunização contra influenza equina.',                                                 6),
  ('Exame de Mormo',      'Documento',    'Obrigatório para emissão de GTA e trânsito. Validade estrita (60 dias).',              2),
  ('Exame de AIE',        'Documento',    'Anemia Infecciosa Equina. Obrigatório para emissão de GTA e aglomerações. Validade estrita (60 dias).', 2),
  ('Resenha Gráfica',     'Documento',    'Identificação visual obrigatória para vincular aos laudos de exames.',              null),
  ('Vermifugação',        'Procedimento', 'Controle de parasitas internos.',                                                     3),
  ('Casqueamento',        'Procedimento', 'Manejo de cascos / ferrageamento.',                                                   2),
  ('Odontologia Equina',  'Procedimento', 'Grosagem e manutenção dentária para nutrição e performance.',                        12)
on conflict (name) do update
  set category = excluded.category,
      description = excluded.description,
      periodicity_months = excluded.periodicity_months;

-- -----------------------------------------------------------
-- 2. Alertas transacionais por equino
-- -----------------------------------------------------------
create table if not exists equine_alerts (
  id              uuid primary key default gen_random_uuid(),
  equine_id       uuid not null references equinos(id) on delete cascade,
  template_id     uuid not null references alert_templates(id) on delete cascade,
  due_date        date,                    -- null = aguardando preenchimento no onboarding
  last_done_at    date,                    -- data da última aplicação/exame informada pelo usuário
  resolved_at     timestamptz,             -- preenchido quando o item é resolvido/concluído
  status_override text check (status_override in ('VENCIDA','CRITICO','URGENTE','ATENCAO','PENDENTE','NAO_POSSUI')),
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

create index if not exists equine_alerts_equine_id_idx on equine_alerts (equine_id);
create index if not exists equine_alerts_due_date_idx on equine_alerts (due_date);

-- updated_at automático
drop trigger if exists equine_alerts_updated_at on equine_alerts;
create trigger equine_alerts_updated_at
  before update on equine_alerts
  for each row execute procedure update_updated_at();

-- -----------------------------------------------------------
-- RLS: espelha o acesso de equinos (dono via user_id)
-- -----------------------------------------------------------
alter table equine_alerts enable row level security;

drop policy if exists "Acesso aos alertas dos próprios equinos" on equine_alerts;
create policy "Acesso aos alertas dos próprios equinos"
  on equine_alerts for all
  using (
    exists (
      select 1 from equinos e
      where e.id = equine_alerts.equine_id
        and e.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from equinos e
      where e.id = equine_alerts.equine_id
        and e.user_id = auth.uid()
    )
  );

-- -----------------------------------------------------------
-- 3. Trigger: gera alertas em lote ao cadastrar um equino
-- -----------------------------------------------------------
create or replace function generate_equine_alerts()
returns trigger as $$
begin
  insert into equine_alerts (equine_id, template_id, due_date)
  select new.id, at.id, null
  from alert_templates at;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_equino_created on equinos;
create trigger on_equino_created
  after insert on equinos
  for each row execute procedure generate_equine_alerts();
