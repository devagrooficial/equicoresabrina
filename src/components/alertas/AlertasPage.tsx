import { useState, useMemo } from 'react';

const C = {
  green: 'hsl(168 83% 29%)',
  greenLight: 'hsl(168 83% 29% / 0.08)',
  fg: 'hsl(var(--foreground))',
  muted: 'hsl(var(--muted-foreground))',
  card: 'hsl(var(--card))',
  border: 'hsl(var(--border))',
  bg: 'hsl(var(--background))',
  amber: 'hsl(38 92% 50%)',
  amberText: 'hsl(38 92% 28%)',
  amberLight: 'hsl(38 92% 50% / 0.1)',
  red: 'hsl(0 84.2% 55%)',
  redText: 'hsl(0 84.2% 38%)',
  redLight: 'hsl(0 84.2% 55% / 0.08)',
  blue: 'hsl(217 91% 60%)',
  blueText: 'hsl(217 91% 32%)',
  blueLight: 'hsl(217 91% 60% / 0.08)',
};

type Severity = 'INFO' | 'PENDING' | 'ATTENTION' | 'URGENT' | 'CRITICAL';
type AlertType = 'VACCINE_DUE' | 'DEWORMING_DUE' | 'DOCUMENT_EXPIRING' | 'DOCUMENT_EXPIRED' | 'VET_FOLLOWUP';
type AlertStatus = 'ACTIVE' | 'RESOLVED' | 'DISMISSED' | 'SNOOZED';

interface AlertItem {
  id: string;
  equine: string;
  type: AlertType;
  severity: Severity;
  title: string;
  description: string;
  dueDate: string;
  daysUntilDue: number;
  status: AlertStatus;
}

const MOCK_ALERTS: AlertItem[] = [
  { id: '1', equine: 'Duque Real', type: 'DOCUMENT_EXPIRING', severity: 'CRITICAL', title: 'Exame de Mormo vencendo', description: 'Mormo (Mallein) — Instituto Vet. Central. Obrigatório para trânsito interestadual.', dueDate: '27/05/2026', daysUntilDue: 3, status: 'ACTIVE' },
  { id: '2', equine: 'Serena da Serra', type: 'DOCUMENT_EXPIRING', severity: 'URGENT', title: 'AIE (Coggins Test) vencendo', description: 'Anemia Infecciosa Equina — validade 180 dias. Renovação obrigatória.', dueDate: '29/05/2026', daysUntilDue: 5, status: 'ACTIVE' },
  { id: '3', equine: 'Trovão do Sul', type: 'VACCINE_DUE', severity: 'URGENT', title: 'Vacina — Influenza Equina', description: 'Revacinação semestral (exigência FEI). Última aplicação: 12/01/2026.', dueDate: '01/06/2026', daysUntilDue: 7, status: 'ACTIVE' },
  { id: '4', equine: 'Trovão do Sul', type: 'VACCINE_DUE', severity: 'ATTENTION', title: 'Vacina — Raiva', description: 'Revacinação anual obrigatória. Zoonose — notificação compulsória.', dueDate: '08/06/2026', daysUntilDue: 14, status: 'ACTIVE' },
  { id: '5', equine: 'Rosa Dourada', type: 'VACCINE_DUE', severity: 'ATTENTION', title: 'Vacina — Tétano + Influenza (Tríplice)', description: 'Protocolo anual. Última aplicação: 10/06/2025.', dueDate: '10/06/2026', daysUntilDue: 16, status: 'ACTIVE' },
  { id: '6', equine: 'Serena da Serra', type: 'DEWORMING_DUE', severity: 'PENDING', title: 'Vermifugação — Ivermectina', description: 'Estratégia de rotação: recomendado alternar princípio ativo. Última: Moxidectina (Jan/2026).', dueDate: '15/07/2026', daysUntilDue: 51, status: 'ACTIVE' },
  { id: '7', equine: 'Duque Real', type: 'VET_FOLLOWUP', severity: 'PENDING', title: 'Retorno veterinário — Claudicação TE', description: 'Dr. Marcos Vieira (CRMV-MT 12345). Agendado após tratamento com AINE.', dueDate: '20/07/2026', daysUntilDue: 56, status: 'ACTIVE' },
  { id: '8', equine: 'Relâmpago Negro', type: 'DOCUMENT_EXPIRING', severity: 'INFO', title: 'GTA — Guia de Trânsito Animal', description: 'Guia emitida em 01/05/2026 — válida por 30 dias. Renovar antes de transporte.', dueDate: '31/05/2026', daysUntilDue: 37, status: 'ACTIVE' },
  { id: '9', equine: 'Estrela do Norte', type: 'VACCINE_DUE', severity: 'INFO', title: 'Vacina — Encefalomielite', description: 'Aplicação anual. Exigida para passaporte e participação em eventos.', dueDate: '10/08/2026', daysUntilDue: 77, status: 'ACTIVE' },
  { id: '10', equine: 'Trovão do Sul', type: 'VACCINE_DUE', severity: 'CRITICAL', title: 'Rinopneumonite — vencida', description: 'Vacina vencida há 3 dias. Exigência GTA para potros. Aplicar imediatamente.', dueDate: '21/05/2026', daysUntilDue: -3, status: 'ACTIVE' },
];

type Filter = 'all' | 'critical' | 'urgent' | 'attention' | 'pending' | 'info' | 'resolved';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'Todos' },
  { key: 'critical', label: 'Crítico' },
  { key: 'urgent', label: 'Urgente' },
  { key: 'attention', label: 'Atenção' },
  { key: 'pending', label: 'Pendentes' },
  { key: 'info', label: 'Info' },
  { key: 'resolved', label: 'Resolvidos' },
];

function typeLabel(type: AlertType) {
  switch (type) {
    case 'VACCINE_DUE': return 'Vacina';
    case 'DEWORMING_DUE': return 'Vermifugação';
    case 'DOCUMENT_EXPIRING': return 'Documento';
    case 'DOCUMENT_EXPIRED': return 'Documento vencido';
    case 'VET_FOLLOWUP': return 'Retorno vet.';
  }
}

function TypeIcon({ type }: { type: AlertType }) {
  const d = type === 'VACCINE_DUE'
    ? '<path d="m18 2 4 4"/><path d="m17 7 3-3"/><path d="M19 9 8.7 19.3c-1 1-2.5 1-3.4 0l-.6-.6c-1-1-1-2.5 0-3.4L15 5"/><path d="m9 11 4 4"/><path d="m5 19-3 3"/><path d="m14 4 6 6"/>'
    : type === 'DEWORMING_DUE'
    ? '<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>'
    : type === 'VET_FOLLOWUP'
    ? '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>'
    : '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="m9 15 2 2 4-4"/>';
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: d }} />;
}

function severityStyle(s: Severity, overdue?: boolean): { bg: string; text: string; dot: string; label: string } {
  if (overdue) return { bg: C.redLight, text: C.redText, dot: C.red, label: 'VENCIDA' };
  switch (s) {
    case 'CRITICAL': return { bg: C.redLight, text: C.redText, dot: C.red, label: 'CRÍTICO' };
    case 'URGENT': return { bg: 'hsl(340 82% 52% / 0.1)', text: 'hsl(340 82% 32%)', dot: 'hsl(340 82% 52%)', label: 'URGENTE' };
    case 'ATTENTION': return { bg: C.amberLight, text: C.amberText, dot: C.amber, label: 'ATENÇÃO' };
    case 'PENDING': return { bg: C.blueLight, text: C.blueText, dot: C.blue, label: 'PENDENTE' };
    case 'INFO': return { bg: C.greenLight, text: C.green, dot: C.green, label: 'INFO' };
  }
}

function AlertCard({ alert, onAction }: { alert: AlertItem; onAction: (id: string, action: 'resolve' | 'dismiss') => void }) {
  const overdue = alert.daysUntilDue < 0;
  const sc = severityStyle(alert.severity, overdue);
  const resolved = alert.status === 'RESOLVED';

  return (
    <div style={{
      padding: '1rem 1.125rem', borderRadius: '0.875rem',
      border: `1px solid ${resolved ? C.border : sc.text + '33'}`,
      background: resolved ? 'transparent' : sc.bg,
      opacity: resolved ? 0.6 : 1,
      transition: 'all 0.2s',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        {/* Icon */}
        <div style={{ width: 32, height: 32, borderRadius: '0.625rem', display: 'flex', alignItems: 'center', justifyContent: 'center', background: sc.text + '1a', color: sc.text, flexShrink: 0, marginTop: 2 }}>
          <TypeIcon type={alert.type} />
        </div>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <p style={{ fontSize: '0.9rem', fontWeight: 700, color: C.fg }}>{alert.title}</p>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.6875rem', fontWeight: 700, padding: '2px 9px', borderRadius: 999, background: sc.text + '1a', color: sc.text, letterSpacing: '0.05em' }}>
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: sc.dot }} />
                  {sc.label}
                </span>
              </div>
              <p style={{ fontSize: '0.75rem', color: C.muted, marginTop: 2 }}>
                <span style={{ fontWeight: 600, color: C.fg }}>{alert.equine}</span>
                {' · '}
                <span style={{ background: 'hsl(var(--muted))', padding: '1px 6px', borderRadius: 4, fontSize: '0.6875rem', fontWeight: 600 }}>
                  {typeLabel(alert.type)}
                </span>
              </p>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <p style={{ fontSize: '0.8125rem', fontWeight: 700, color: overdue ? C.redText : sc.text }}>
                {overdue ? `Vencida há ${Math.abs(alert.daysUntilDue)} dia${Math.abs(alert.daysUntilDue) !== 1 ? 's' : ''}` : `Vence em ${alert.daysUntilDue} dia${alert.daysUntilDue !== 1 ? 's' : ''}`}
              </p>
              <p style={{ fontSize: '0.6875rem', color: C.muted }}>{alert.dueDate}</p>
            </div>
          </div>
          <p style={{ fontSize: '0.8125rem', color: C.muted, marginTop: 6, lineHeight: 1.5 }}>{alert.description}</p>

          {/* Actions */}
          {!resolved && (
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button onClick={() => onAction(alert.id, 'resolve')}
                style={{ padding: '4px 12px', borderRadius: 6, fontSize: '0.75rem', fontWeight: 600, background: C.green, color: '#fff', border: 'none', cursor: 'pointer' }}>
                ✓ Resolver
              </button>
              <button onClick={() => onAction(alert.id, 'dismiss')}
                style={{ padding: '4px 12px', borderRadius: 6, fontSize: '0.75rem', fontWeight: 600, background: 'hsl(var(--muted))', color: C.muted, border: 'none', cursor: 'pointer' }}>
                Dispensar
              </button>
              <a href={`/dashboard/equino/1`}
                style={{ padding: '4px 12px', borderRadius: 6, fontSize: '0.75rem', fontWeight: 600, color: C.green, background: C.greenLight, textDecoration: 'none' }}>
                Ver equino →
              </a>
            </div>
          )}
          {resolved && (
            <p style={{ fontSize: '0.75rem', color: C.green, marginTop: 6, fontWeight: 600 }}>✓ Resolvido</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AlertasPage() {
  const [filter, setFilter] = useState<Filter>('all');
  const [alerts, setAlerts] = useState(MOCK_ALERTS);

  const counts = useMemo(() => ({
    all: alerts.filter(a => a.status === 'ACTIVE').length,
    critical: alerts.filter(a => a.severity === 'CRITICAL' && a.status === 'ACTIVE').length,
    urgent: alerts.filter(a => a.severity === 'URGENT' && a.status === 'ACTIVE').length,
    attention: alerts.filter(a => a.severity === 'ATTENTION' && a.status === 'ACTIVE').length,
    pending: alerts.filter(a => a.severity === 'PENDING' && a.status === 'ACTIVE').length,
    info: alerts.filter(a => a.severity === 'INFO' && a.status === 'ACTIVE').length,
    resolved: alerts.filter(a => a.status === 'RESOLVED').length,
  }), [alerts]);

  const filtered = useMemo(() => {
    if (filter === 'resolved') return alerts.filter(a => a.status === 'RESOLVED');
    if (filter === 'all') return alerts.filter(a => a.status === 'ACTIVE');
    const sev = filter.toUpperCase() as Severity;
    return alerts.filter(a => a.severity === sev && a.status === 'ACTIVE');
  }, [filter, alerts]);

  function handleAction(id: string, action: 'resolve' | 'dismiss') {
    setAlerts(prev => prev.map(a =>
      a.id === id ? { ...a, status: action === 'resolve' ? 'RESOLVED' : 'DISMISSED' } : a
    ));
  }

  const sortedFiltered = [...filtered].sort((a, b) => a.daysUntilDue - b.daysUntilDue);

  return (
    <div>
      <style>{`.filter-pill { padding: 6px 14px; border-radius: 999px; font-size: 12px; font-weight: 600; border: 1px solid transparent; cursor: pointer; transition: all 0.15s; white-space: nowrap; }`}</style>

      {/* Header */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.25rem', fontWeight: 800, color: C.fg, letterSpacing: '-0.02em' }}>Alertas</h1>
        <p style={{ fontSize: '0.8125rem', color: C.muted, marginTop: 2 }}>
          {counts.all} alertas ativos · {counts.critical} críticos · {counts.urgent} urgentes
        </p>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 10, marginBottom: '1.5rem' }}>
        {[
          { label: 'Crítico', count: counts.critical, color: C.redText, bg: C.redLight },
          { label: 'Urgente', count: counts.urgent, color: 'hsl(340 82% 32%)', bg: 'hsl(340 82% 52% / 0.1)' },
          { label: 'Atenção', count: counts.attention, color: C.amberText, bg: C.amberLight },
          { label: 'Pendentes', count: counts.pending, color: C.blueText, bg: C.blueLight },
        ].map((s) => (
          <div key={s.label} style={{ padding: '0.875rem', borderRadius: '0.875rem', background: s.bg, border: `1px solid ${s.color}22` }}>
            <p style={{ fontSize: '1.5rem', fontWeight: 900, color: s.color }}>{s.count}</p>
            <p style={{ fontSize: '0.6875rem', fontWeight: 700, color: s.color, letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: 2 }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filter pills */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: '1.25rem' }}>
        {FILTERS.map((f) => {
          const count = f.key === 'all' ? counts.all : counts[f.key as keyof typeof counts] ?? 0;
          const active = filter === f.key;
          return (
            <button key={f.key} className="filter-pill" onClick={() => setFilter(f.key)}
              style={{ background: active ? C.green : 'transparent', color: active ? '#fff' : C.muted, borderColor: active ? C.green : C.border }}>
              {f.label}
              {count > 0 && <span style={{ marginLeft: 5, background: active ? 'hsl(168 83% 20% / 0.4)' : 'hsl(var(--muted))', padding: '1px 6px', borderRadius: 999, fontSize: 10 }}>{count}</span>}
            </button>
          );
        })}
      </div>

      {/* Alert list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {sortedFiltered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem 1rem', color: C.muted }}>
            <p style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🎉</p>
            <p style={{ fontWeight: 700, color: C.fg, marginBottom: '0.25rem' }}>
              {filter === 'resolved' ? 'Nenhum alerta resolvido ainda' : 'Nenhum alerta nesta categoria'}
            </p>
            <p style={{ fontSize: '0.875rem' }}>
              {filter === 'resolved' ? 'Resolva alertas para vê-los aqui' : 'Tudo em ordem por aqui!'}
            </p>
          </div>
        ) : (
          sortedFiltered.map((alert) => (
            <AlertCard key={alert.id} alert={alert} onAction={handleAction} />
          ))
        )}
      </div>
    </div>
  );
}
