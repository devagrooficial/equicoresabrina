// Situação dos exames sanitários (AIE e mormo) a partir da data de colheita.
// Usado na área do veterinário e na do dono. Sem dependências.

import type { ExamType } from './sgq/labels';

/** Regra do EquiCore para AIE e mormo (a mesma dos alertas do dono): 60 dias após a colheita. */
export const EXAM_VALIDITY_DAYS = 60;
/** A partir de quantos dias do vencimento o exame é destacado como "vencendo". */
export const EXAM_WARNING_DAYS = 7;

export type ExamState = 'valid' | 'expiring' | 'expired';

export interface ExamValidity {
  until: string;          // ISO (yyyy-mm-dd)
  daysLeft: number;       // negativo = dias de atraso
  state: ExamState;
  label: string;          // "Válido", "Vence em 5 dias", "Vencido há 3 dias"
  /** 0–100: quanto da validade ainda resta (para barra de progresso) */
  remainingPct: number;
}

const toIso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function formatBrDate(iso: string | null | undefined): string {
  return iso ? iso.slice(0, 10).split('-').reverse().join('/') : '—';
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function examValidity(collectionDate: string | null | undefined, today: Date = new Date()): ExamValidity | null {
  const m = (collectionDate ?? '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const until = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + EXAM_VALIDITY_DAYS);
  const base = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const daysLeft = Math.round((until.getTime() - base.getTime()) / 86_400_000);

  const state: ExamState = daysLeft < 0 ? 'expired' : daysLeft <= EXAM_WARNING_DAYS ? 'expiring' : 'valid';
  const label =
    state === 'expired'  ? `Vencido há ${plural(-daysLeft, 'dia', 'dias')}`
    : daysLeft === 0     ? 'Vence hoje'
    : state === 'expiring' ? `Vence em ${plural(daysLeft, 'dia', 'dias')}`
    : 'Válido';

  return {
    until: toIso(until),
    daysLeft,
    state,
    label,
    remainingPct: Math.max(0, Math.min(100, Math.round((daysLeft / EXAM_VALIDITY_DAYS) * 100))),
  };
}

export type ExamGroup = 'aie' | 'mormo';

export const EXAM_GROUP: Record<ExamType, ExamGroup> = {
  aieidga: 'aie',
  aieelisa: 'aie',
  mormoelisa: 'mormo',
};

export const EXAM_GROUP_LABEL: Record<ExamGroup, { short: string; long: string }> = {
  aie:   { short: 'AIE',   long: 'Anemia Infecciosa Equina' },
  mormo: { short: 'Mormo', long: 'Mormo' },
};

/** Exame mais recente de um grupo, pela data de colheita. */
export function latestExam<T extends { exam_type: ExamType; collection_date: string | null }>(
  exams: readonly T[],
  group: ExamGroup,
): T | null {
  let latest: T | null = null;
  for (const exam of exams) {
    if (EXAM_GROUP[exam.exam_type] !== group || !exam.collection_date) continue;
    if (!latest || exam.collection_date > latest.collection_date!) latest = exam;
  }
  return latest;
}

/** Pior situação entre AIE e mormo — resume o animal em uma palavra. */
export function overallState(exams: readonly { exam_type: ExamType; collection_date: string | null }[], today: Date = new Date()):
  ExamState | 'none' {
  const states = (['aie', 'mormo'] as const)
    .map(group => examValidity(latestExam(exams, group)?.collection_date, today)?.state)
    .filter((s): s is ExamState => !!s);
  if (!states.length) return 'none';
  if (states.includes('expired')) return 'expired';
  if (states.includes('expiring')) return 'expiring';
  return 'valid';
}
