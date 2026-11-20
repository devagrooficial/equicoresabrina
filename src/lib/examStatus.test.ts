import { describe, expect, it } from 'vitest';
import { examValidity, formatBrDate, latestExam, overallState } from './examStatus';

const today = new Date(2026, 10, 19); // 19/11/2026

describe('validade dos exames', () => {
  it('calcula vencimento em 60 dias após a colheita', () => {
    expect(examValidity('2026-11-07', today)).toMatchObject({ until: '2027-01-06', daysLeft: 48, state: 'valid', label: 'Válido', remainingPct: 80 });
  });

  it('destaca quem vence em até 7 dias', () => {
    expect(examValidity('2026-09-25', today)).toMatchObject({ until: '2026-11-24', daysLeft: 5, state: 'expiring', label: 'Vence em 5 dias' });
    expect(examValidity('2026-09-21', today)).toMatchObject({ daysLeft: 1, label: 'Vence em 1 dia' });
    expect(examValidity('2026-09-20', today)).toMatchObject({ daysLeft: 0, state: 'expiring', label: 'Vence hoje' });
  });

  it('marca vencidos', () => {
    expect(examValidity('2026-09-19', today)).toMatchObject({ daysLeft: -1, state: 'expired', label: 'Vencido há 1 dia', remainingPct: 0 });
    expect(examValidity('2026-05-04', today)).toMatchObject({ state: 'expired' });
  });

  it('ignora datas ausentes ou inválidas', () => {
    expect(examValidity(null, today)).toBeNull();
    expect(examValidity('', today)).toBeNull();
    expect(examValidity('ontem', today)).toBeNull();
  });

  it('formata datas', () => {
    expect(formatBrDate('2026-11-07')).toBe('07/11/2026');
    expect(formatBrDate('2026-11-07T10:00:00Z')).toBe('07/11/2026');
    expect(formatBrDate(null)).toBe('—');
  });
});

describe('resumo por animal', () => {
  const exams = [
    { exam_type: 'aieidga' as const,    collection_date: '2026-05-01' },
    { exam_type: 'aieelisa' as const,   collection_date: '2026-11-01' },
    { exam_type: 'mormoelisa' as const, collection_date: '2026-09-25' },
    { exam_type: 'mormoelisa' as const, collection_date: null },
  ];

  it('pega o exame mais recente de cada grupo, juntando IDGA e ELISA', () => {
    expect(latestExam(exams, 'aie')).toEqual({ exam_type: 'aieelisa', collection_date: '2026-11-01' });
    expect(latestExam(exams, 'mormo')).toEqual({ exam_type: 'mormoelisa', collection_date: '2026-09-25' });
    expect(latestExam([], 'aie')).toBeNull();
  });

  it('resume pela pior situação', () => {
    expect(overallState(exams, today)).toBe('expiring');
    expect(overallState([exams[1]], today)).toBe('valid');
    expect(overallState([exams[0], exams[2]], today)).toBe('expired');
    expect(overallState([], today)).toBe('none');
  });
});
