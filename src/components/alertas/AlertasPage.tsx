import { useState, useMemo, useEffect } from 'react';
import { createClient } from '../../lib/supabase';
import { calculateAlertStatus, type AlertStatusKey } from '../../lib/alertStatus';

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
  orange: 'hsl(340 82% 52%)',
  orangeText: 'hsl(340 82% 32%)',
  orangeLight: 'hsl(340 82% 52% / 0.1)',
  red: 'hsl(0 84.2% 55%)',
  redText: 'hsl(0 84.2% 38%)',
  redLight: 'hsl(0 84.2% 55% / 0.08)',
  blue: 'hsl(217 91% 60%)',
  blueText: 'hsl(217 91% 32%)',
  blueLight: 'hsl(217 91% 60% / 0.08)',
};

interface AlertRow {
  id: string;
  equineId: string;
  equine: string;
  category: string;       // Vacina | Documento | Procedimento
  title: string;          // nome do template
  description: string;
  dueDate: string | null; // ISO
  resolvedAt: string | null;
  notOwned: boolean;
  permanent: boolean;     // documento sem vencimento cíclico
}

type Filter = 'all' | 'vencida' | 'critico' | 'urgente' | 'atencao' | 'pendente' | 'emdia';
type Bucket = 'vencida' | 'critico' | 'urgente' | 'atencao' | 'pendente' | 'emdia' | 'naoaplica';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'Todos' },
  { key: 'vencida', label: 'Vencida' },
  { key: 'critico', label: 'Crítico' },
  { key: 'urgente', label: 'Urgente' },
  { key: 'atencao', label: 'Atenção' },
  { key: 'pendente', label: 'Pendentes' },
  { key: 'emdia', label: 'Em dia' },
];

// Buckets que exigem atenção (entram em "Todos")
const ACTIVE_BUCKETS: Bucket[] = ['vencida', 'critico', 'urgente', 'atencao', 'pendente'];

// Classifica um alerta pelo status REAL (derivado da data), não por resolved_at
function bucketOf(a: AlertRow): Bucket {
  if (a.notOwned) return 'naoaplica';
  if (a.permanent) return a.resolvedAt ? 'emdia' : 'pendente';
  if (!a.dueDate) return 'pendente';
  const k = calculateAlertStatus(a.dueDate).key;
  if (k === 'PENDENTE') return 'emdia';          // tem data e vence em > 15 dias
  return k.toLowerCase() as Bucket;              // vencida | critico | urgente | atencao
}

function statusStyle(key: AlertStatusKey): { bg: string; text: string; dot: string; label: string } {
  switch (key) {
    case 'VENCIDA': return { bg: C.redLight, text: C.redText, dot: C.red, label: 'VENCIDA' };
    case 'CRITICO': return { bg: C.redLight, text: C.redText, dot: C.red, label: 'CRÍTICO' };
    case 'URGENTE': return { bg: C.orangeLight, text: C.orangeText, dot: C.orange, label: 'URGENTE' };
    case 'ATENCAO': return { bg: C.amberLight, text: C.amberText, dot: C.amber, label: 'ATENÇÃO' };
    case 'PENDENTE': return { bg: C.blueLight, text: C.blueText, dot: C.blue, label: 'PENDENTE' };
  }
}

function CategoryIcon({ category }: { category: string }) {
  const d = category === 'Vacina'
    ? '<path d="m18 2 4 4"/><path d="m17 7 3-3"/><path d="M19 9 8.7 19.3c-1 1-2.5 1-3.4 0l-.6-.6c-1-1-1-2.5 0-3.4L15 5"/><path d="m9 11 4 4"/><path d="m5 19-3 3"/><path d="m14 4 6 6"/>'
    : category === 'Procedimento'
    ? '<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>'
    : '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="m9 15 2 2 4-4"/>';
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: d }} />;
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return iso.split('-').reverse().join('/');
}

function AlertCard({ alert, bucket, onAction }: { alert: AlertRow; bucket: Bucket; onAction: (id: string, action: 'resolve' | 'dismiss') => void }) {
  const status = calculateAlertStatus(alert.dueDate);
  const emDia = bucket === 'emdia';
  const sc = emDia
    ? { bg: 'hsl(142 71% 45% / 0.1)', text: 'hsl(142 71% 26%)', dot: 'hsl(142 71% 40%)', label: alert.permanent ? 'POSSUI' : 'EM DIA' }
    : statusStyle(status.key);
  const days = alert.permanent ? null : status.daysRemaining;
  const isPendingNoDate = !alert.permanent && !alert.dueDate;

  return (
    <div style={{
      padding: '1rem 1.125rem', borderRadius: '0.875rem',
      border: `1px solid ${sc.text + '33'}`,
      background: emDia ? 'transparent' : sc.bg,
      opacity: emDia ? 0.75 : 1,
      transition: 'all 0.2s',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ width: 32, height: 32, borderRadius: '0.625rem', display: 'flex', alignItems: 'center', justifyContent: 'center', background: sc.text + '1a', color: sc.text, flexShrink: 0, marginTop: 2 }}>
          <CategoryIcon category={alert.category} />
        </div>

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
                  {alert.category}
                </span>
              </p>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              {alert.permanent ? (
                <p style={{ fontSize: '0.8125rem', fontWeight: 700, color: sc.text }}>Permanente</p>
              ) : days === null ? (
                <p style={{ fontSize: '0.8125rem', fontWeight: 700, color: sc.text }}>Aguardando data</p>
              ) : days < 0 ? (
                <p style={{ fontSize: '0.8125rem', fontWeight: 700, color: C.redText }}>Vencida há {Math.abs(days)} dia{Math.abs(days) !== 1 ? 's' : ''}</p>
              ) : (
                <p style={{ fontSize: '0.8125rem', fontWeight: 700, color: sc.text }}>Vence em {days} dia{days !== 1 ? 's' : ''}</p>
              )}
              <p style={{ fontSize: '0.6875rem', color: C.muted }}>{formatDate(alert.dueDate)}</p>
            </div>
          </div>
          {alert.description && <p style={{ fontSize: '0.8125rem', color: C.muted, marginTop: 6, lineHeight: 1.5 }}>{alert.description}</p>}

          <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
            {/* Permanente pendente: pode marcar "Possui" direto */}
            {alert.permanent && !emDia && (
              <button onClick={() => onAction(alert.id, 'resolve')}
                style={{ padding: '4px 12px', borderRadius: 6, fontSize: '0.75rem', fontWeight: 600, background: C.green, color: '#fff', border: 'none', cursor: 'pointer' }}>
                ✓ Marcar como possui
              </button>
            )}
            {/* Itens cíclicos: atualizar a data (renovar) */}
            {!alert.permanent && (
              <a href={`/dashboard/equino/${alert.equineId}/setup-saude`}
                style={{ padding: '4px 12px', borderRadius: 6, fontSize: '0.75rem', fontWeight: 600, background: emDia ? 'hsl(var(--muted))' : C.green, color: emDia ? C.muted : '#fff', textDecoration: 'none' }}>
                {isPendingNoDate ? 'Informar data' : 'Atualizar / renovar'}
              </a>
            )}
            <button onClick={() => onAction(alert.id, 'dismiss')}
              style={{ padding: '4px 12px', borderRadius: 6, fontSize: '0.75rem', fontWeight: 600, background: 'hsl(var(--muted))', color: C.muted, border: 'none', cursor: 'pointer' }}>
              Não se aplica
            </button>
            <a href={`/dashboard/equino/${alert.equineId}`}
              style={{ padding: '4px 12px', borderRadius: 6, fontSize: '0.75rem', fontWeight: 600, color: C.green, background: C.greenLight, textDecoration: 'none' }}>
              Ver equino →
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AlertasPage() {
  const [filter, setFilter] = useState<Filter>('all');
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [loading, setLoading] = useState(true);

  const supabase = createClient();

  useEffect(() => {
    supabase
      .from('equine_alerts')
      .select('id, due_date, resolved_at, status_override, equine:equinos(id, name, nickname), template:alert_templates(name, category, description, periodicity_months)')
      .then(({ data }) => {
        const rows: AlertRow[] = (data ?? []).map((a: any) => ({
          id: a.id,
          equineId: a.equine?.id ?? '',
          equine: a.equine?.nickname || a.equine?.name || 'Equino',
          category: a.template?.category ?? 'Procedimento',
          title: a.template?.name ?? 'Item',
          description: a.template?.description ?? '',
          dueDate: a.due_date,
          resolvedAt: a.resolved_at,
          notOwned: a.status_override === 'NAO_POSSUI',
          permanent: a.template?.periodicity_months == null,
        }));
        setAlerts(rows);
        setLoading(false);
      });
  }, []);

  // Classifica cada alerta pelo status REAL
  const buckets = useMemo(() => new Map(alerts.map(a => [a.id, bucketOf(a)])), [alerts]);

  const counts = useMemo(() => {
    const c = { all: 0, vencida: 0, critico: 0, urgente: 0, atencao: 0, pendente: 0, emdia: 0 };
    alerts.forEach(a => {
      const b = buckets.get(a.id)!;
      if (b === 'naoaplica') return;
      (c as any)[b]++;
      if (ACTIVE_BUCKETS.includes(b)) c.all++;
    });
    return c;
  }, [alerts, buckets]);

  const filtered = useMemo(() => {
    if (filter === 'all') return alerts.filter(a => ACTIVE_BUCKETS.includes(buckets.get(a.id)!));
    return alerts.filter(a => buckets.get(a.id) === filter);
  }, [filter, alerts, buckets]);

  async function handleAction(id: string, action: 'resolve' | 'dismiss') {
    // "Não se aplica" → marca NAO_POSSUI; "resolve" (permanente pendente) → marca possui
    const patch = action === 'dismiss'
      ? { status_override: 'NAO_POSSUI', due_date: null, last_done_at: null, resolved_at: null }
      : { resolved_at: new Date().toISOString(), status_override: null };
    setAlerts(prev => prev.map(a =>
      a.id === id
        ? { ...a, notOwned: action === 'dismiss', resolvedAt: action === 'resolve' ? new Date().toISOString() : a.resolvedAt }
        : a
    ));
    await supabase.from('equine_alerts').update(patch).eq('id', id);
  }

  // Ordena: vencidas e mais próximas primeiro; pendentes (sem data) ao fim
  const sortedFiltered = [...filtered].sort((a, b) => {
    const da = a.permanent || !a.dueDate ? Infinity : (calculateAlertStatus(a.dueDate).daysRemaining ?? Infinity);
    const db = b.permanent || !b.dueDate ? Infinity : (calculateAlertStatus(b.dueDate).daysRemaining ?? Infinity);
    return da - db;
  });

  return (
    <div>
      <style>{`.filter-pill { padding: 6px 14px; border-radius: 999px; font-size: 12px; font-weight: 600; border: 1px solid transparent; cursor: pointer; transition: all 0.15s; white-space: nowrap; }`}</style>

      {/* Header */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.25rem', fontWeight: 800, color: C.fg, letterSpacing: '-0.02em' }}>Alertas</h1>
        <p style={{ fontSize: '0.8125rem', color: C.muted, marginTop: 2 }}>
          {loading ? 'Carregando…' : `${counts.all} alertas ativos · ${counts.vencida} vencidas · ${counts.critico} críticos`}
        </p>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 10, marginBottom: '1.5rem' }}>
        {[
          { label: 'Vencida', count: counts.vencida, color: C.redText, bg: C.redLight },
          { label: 'Crítico', count: counts.critico, color: C.redText, bg: C.redLight },
          { label: 'Urgente', count: counts.urgente, color: C.orangeText, bg: C.orangeLight },
          { label: 'Atenção', count: counts.atencao, color: C.amberText, bg: C.amberLight },
          { label: 'Pendentes', count: counts.pendente, color: C.blueText, bg: C.blueLight },
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
          const count = counts[f.key as keyof typeof counts] ?? 0;
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
        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem 1rem', color: C.muted }}>
            <p style={{ fontSize: '0.875rem' }}>Carregando alertas…</p>
          </div>
        ) : sortedFiltered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem 1rem', color: C.muted }}>
            <p style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🎉</p>
            <p style={{ fontWeight: 700, color: C.fg, marginBottom: '0.25rem' }}>
              {filter === 'emdia' ? 'Nenhum item em dia ainda' : 'Nenhum alerta nesta categoria'}
            </p>
            <p style={{ fontSize: '0.875rem' }}>
              {filter === 'emdia' ? 'Itens com data em dia aparecem aqui' : 'Tudo em ordem por aqui!'}
            </p>
          </div>
        ) : (
          sortedFiltered.map((alert) => (
            <AlertCard key={alert.id} alert={alert} bucket={buckets.get(alert.id)!} onAction={handleAction} />
          ))
        )}
      </div>
    </div>
  );
}
