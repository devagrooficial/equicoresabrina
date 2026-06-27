-- ============================================================
-- EquiCore — Adiciona vacinas padrão MAPA ao catálogo
-- Execute no Supabase SQL Editor (idempotente)
-- ============================================================

insert into alert_templates (name, category, description, periodicity_months)
values
  ('Vacina de Herpesvírus Equino',   'Vacina', 'Imunização contra EHV-1 e EHV-4 (rinopneumonite/aborto viral). Frequência semestral.',               6),
  ('Vacina de Encefalomielite',      'Vacina', 'Proteção contra encefalomielite equina leste (EEE) e oeste (WEE). Anual.',                           12),
  ('Vacina de Leptospirose',         'Vacina', 'Imunização contra leptospirose equina. Anual.',                                                       12),
  ('Vacina contra Garrotilho',       'Vacina', 'Proteção contra adenite equina (Streptococcus equi). Recomendada em regiões de risco.',               12),
  ('Vacina contra Vírus do Nilo',    'Vacina', 'West Nile Virus (WNV). Recomendada para cavalos de competição e regiões de risco.',                  12)
on conflict (name) do update
  set category           = excluded.category,
      description        = excluded.description,
      periodicity_months = excluded.periodicity_months;
