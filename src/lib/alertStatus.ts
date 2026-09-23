export type AlertStatusKey = 'VENCIDA' | 'CRITICO' | 'URGENTE' | 'ATENCAO' | 'PENDENTE';

export interface AlertStatus {
  key: AlertStatusKey;
  label: string;
  /** Tema de cor semântico para o frontend (mapeável para classes/tokens) */
  colorTheme: 'red' | 'critical' | 'orange' | 'amber' | 'muted';
  /** Dias até o vencimento (negativo = vencido). null quando due_date é null */
  daysRemaining: number | null;
}

const STATUS_META: Record<AlertStatusKey, { label: string; colorTheme: AlertStatus['colorTheme'] }> = {
  VENCIDA:  { label: 'Vencida',  colorTheme: 'red' },
  CRITICO:  { label: 'Crítico',  colorTheme: 'critical' },
  URGENTE:  { label: 'Urgente',  colorTheme: 'orange' },
  ATENCAO:  { label: 'Atenção',  colorTheme: 'amber' },
  PENDENTE: { label: 'Pendente', colorTheme: 'muted' },
};

/**
 * Calcula o status de um alerta com base na data de vencimento x data atual.
 *
 * - VENCIDA:  due_date < hoje
 * - CRÍTICO:  hoje .. hoje+3 dias
 * - URGENTE:  hoje+4 .. hoje+7 dias
 * - ATENÇÃO:  hoje+8 .. hoje+15 dias
 * - PENDENTE: due_date > 15 dias OU due_date null (aguardando preenchimento)
 */
export function calculateAlertStatus(dueDate: string | null): AlertStatus {
  if (!dueDate) {
    return { key: 'PENDENTE', ...STATUS_META.PENDENTE, daysRemaining: null };
  }

  // Normaliza para meia-noite local para comparar apenas a data (sem horas)
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Parse manual de 'YYYY-MM-DD' como data LOCAL (evita deslocamento de fuso ao usar new Date())
  const [y, m, d] = dueDate.slice(0, 10).split('-').map(Number);
  const due = new Date(y, (m ?? 1) - 1, d ?? 1);
  due.setHours(0, 0, 0, 0);

  const MS_PER_DAY = 1000 * 60 * 60 * 24;
  const daysRemaining = Math.round((due.getTime() - today.getTime()) / MS_PER_DAY);

  let key: AlertStatusKey;
  if (daysRemaining < 0) key = 'VENCIDA';
  else if (daysRemaining <= 3) key = 'CRITICO';
  else if (daysRemaining <= 7) key = 'URGENTE';
  else if (daysRemaining <= 15) key = 'ATENCAO';
  else key = 'PENDENTE';

  return { key, ...STATUS_META[key], daysRemaining };
}

const RANK: Record<Exclude<AlertStatusKey, 'PENDENTE'>, number> = {
  VENCIDA: 5,
  CRITICO: 4,
  URGENTE: 3,
  ATENCAO: 2,
};

export interface EquineAlertLike {
  due_date: string | null;
  status_override: string | null;
  resolved_at: string | null;
  template: { periodicity_months: number | null } | null;
}

export type EquineHealthStatus = 'healthy' | 'attention' | 'urgent' | 'critical';

/** Rank de gravidade de um alerta (-1 = não se aplica, 0 = em dia, 5 = pior). */
function alertRank(a: EquineAlertLike): number {
  if (a.status_override === 'NAO_POSSUI') return -1;
  if (a.template?.periodicity_months == null) return a.resolved_at ? 0 : 1;
  if (!a.due_date) return 1;
  const key = calculateAlertStatus(a.due_date).key;
  if (key === 'PENDENTE') return 0;
  return RANK[key];
}

/**
 * Deriva o status de saúde de um equino (e sua contagem de alertas em
 * aberto) a partir dos alertas ao vivo — `equinos.health_status` nunca é
 * escrito por nenhum trigger/código, então não pode ser usado como fonte
 * da verdade.
 */
export function computeEquineHealth(alerts: EquineAlertLike[]): { status: EquineHealthStatus; alertsCount: number } {
  const worst = alerts.reduce((max, a) => Math.max(max, alertRank(a)), 0);
  const alertsCount = alerts.filter(a => alertRank(a) >= 1).length;
  const status: EquineHealthStatus = worst >= 4 ? 'critical' : worst === 3 ? 'urgent' : worst === 2 ? 'attention' : 'healthy';
  return { status, alertsCount };
}

/** Adiciona N meses a uma data ISO (YYYY-MM-DD) e retorna no mesmo formato. */
export function addMonths(isoDate: string, months: number): string {
  const [y, m, d] = isoDate.slice(0, 10).split('-').map(Number);
  const date = new Date(y, (m ?? 1) - 1 + months, d ?? 1);
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}
