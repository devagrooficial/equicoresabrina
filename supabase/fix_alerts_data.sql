-- ============================================================
-- EquiCore — Correção de dados dos alertas
-- Rode UMA vez no SQL Editor para alinhar os registros existentes
-- com a nova lógica de status.
-- ============================================================

-- 1. Garante que a Resenha Gráfica é PERMANENTE (sem vencimento cíclico)
update alert_templates
  set periodicity_months = null
  where name = 'Resenha Gráfica';

-- 2. Limpa due_date/last_done dos alertas de documentos permanentes
--    (ex.: Resenha que ficou com data de vencimento por engano)
update equine_alerts ea
  set due_date = null, last_done_at = null
  from alert_templates at
  where ea.template_id = at.id
    and at.periodicity_months is null;

-- 3. Limpa resolved_at dos itens CÍCLICOS (vacinas/exames/procedimentos).
--    O status passa a ser derivado exclusivamente da data de vencimento,
--    então um exame vencido volta a ser alerta ativo (não "resolvido").
update equine_alerts ea
  set resolved_at = null
  from alert_templates at
  where ea.template_id = at.id
    and at.periodicity_months is not null;

-- 4. (Opcional) Gera os alertas que faltam para equinos já cadastrados
--    antes da criação de novos templates (Resenha, Odontologia, etc.)
insert into equine_alerts (equine_id, template_id, due_date)
select e.id, t.id, null
from equinos e
cross join alert_templates t
where not exists (
  select 1 from equine_alerts ea
  where ea.equine_id = e.id and ea.template_id = t.id
);
