import { describe, it, expect } from 'vitest';
import { computeEquineHealth, type EquineAlertLike } from './alertStatus';

// Mesma construção de data local usada em calculateAlertStatus/addMonths —
// evita deslocamento de fuso horário ao comparar com "hoje".
function daysFromNow(n: number): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + n);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function alert(overrides: Partial<EquineAlertLike> = {}): EquineAlertLike {
  return {
    due_date: null,
    status_override: null,
    resolved_at: null,
    template: { periodicity_months: 12 },
    ...overrides,
  };
}

describe('computeEquineHealth', () => {
  it('sem alertas retorna saudável e zero contagem', () => {
    expect(computeEquineHealth([])).toEqual({ status: 'healthy', alertsCount: 0 });
  });

  it('ignora alertas marcados como NAO_POSSUI', () => {
    const result = computeEquineHealth([alert({ status_override: 'NAO_POSSUI', due_date: daysFromNow(-10) })]);
    expect(result).toEqual({ status: 'healthy', alertsCount: 0 });
  });

  it('alerta vencido é crítico', () => {
    const result = computeEquineHealth([alert({ due_date: daysFromNow(-1) })]);
    expect(result.status).toBe('critical');
    expect(result.alertsCount).toBe(1);
  });

  it('alerta a vencer em 2 dias (faixa crítica) é crítico', () => {
    expect(computeEquineHealth([alert({ due_date: daysFromNow(2) })]).status).toBe('critical');
  });

  it('alerta a vencer em 5 dias (faixa urgente) é urgente', () => {
    expect(computeEquineHealth([alert({ due_date: daysFromNow(5) })]).status).toBe('urgent');
  });

  it('alerta a vencer em 10 dias (faixa atenção) é atenção', () => {
    expect(computeEquineHealth([alert({ due_date: daysFromNow(10) })]).status).toBe('attention');
  });

  it('alerta agendado para daqui a 30 dias não eleva status nem conta', () => {
    const result = computeEquineHealth([alert({ due_date: daysFromNow(30) })]);
    expect(result).toEqual({ status: 'healthy', alertsCount: 0 });
  });

  it('item permanente já resolvido não conta', () => {
    const result = computeEquineHealth([alert({ template: { periodicity_months: null }, resolved_at: new Date().toISOString() })]);
    expect(result).toEqual({ status: 'healthy', alertsCount: 0 });
  });

  it('item permanente não resolvido conta mas não eleva o status', () => {
    const result = computeEquineHealth([alert({ template: { periodicity_months: null }, resolved_at: null })]);
    expect(result.status).toBe('healthy');
    expect(result.alertsCount).toBe(1);
  });

  it('item periódico sem data agendada ainda conta mas não eleva o status', () => {
    const result = computeEquineHealth([alert({ due_date: null })]);
    expect(result.status).toBe('healthy');
    expect(result.alertsCount).toBe(1);
  });

  it('usa o pior status entre vários alertas e conta só os relevantes', () => {
    const result = computeEquineHealth([
      alert({ due_date: daysFromNow(30) }), // pendente distante — não conta
      alert({ due_date: daysFromNow(-1) }), // vencido — conta, crítico
      alert({ due_date: daysFromNow(10) }), // atenção — conta
    ]);
    expect(result.status).toBe('critical');
    expect(result.alertsCount).toBe(2);
  });
});
