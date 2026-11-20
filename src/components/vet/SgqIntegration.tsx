import { useEffect, useMemo, useRef, useState } from 'react';
import { Banner, Field, inputStyle, VET_BLUE, VET_BLUE_LIGHT } from './formUI';
import SgqDePara from './SgqDePara';
import type { JobView, SyncChange, SyncEvent } from '../../lib/sgq/sync';

// Integração com o Portal Central de Requisições (SGQ Sistemas).
// O veterinário conecta a própria conta do portal e dispara a importação.
// A sincronização roda em passos: esta tela chama /api/sgq/sync a cada poucos
// segundos e cada passo lê no máximo uma página do portal. Fechar a aba pausa;
// o progresso fica salvo e pode ser retomado.

interface Status {
  configured: boolean;
  connected: boolean;
  username: string | null;
  lastSyncAt: string | null;
  job: JobView | null;
}

interface FeedEntry extends SyncEvent { id: number; at: string }

const C = {
  fg:     'hsl(var(--foreground))',
  muted:  'hsl(var(--muted-foreground))',
  card:   'hsl(var(--card))',
  bg:     'hsl(var(--background))',
  soft:   'hsl(var(--muted))',
  border: 'hsl(var(--border))',
  green:  'hsl(142 71% 35%)',
  red:    'hsl(0 84.2% 55%)',
  amber:  'hsl(35 92% 40%)',
};

// Pausa entre passos (o servidor também impõe um mínimo de 2,5 s)
const STEP_DELAY_MS = 2_800;
const STEP_JITTER_MS = 1_500;
const MAX_NETWORK_RETRIES = 3;
/**
 * Sem nenhum passo concluído por este tempo, a tela para e avisa. Cobre o caso
 * em que o servidor é derrubado no meio de um passo: a trava daquele passo
 * leva ~70 s para expirar e, até lá, as chamadas só respondem "aguarde".
 */
const STALL_LIMIT_MS = 150_000;
/** Quantos passos ficam visíveis na lista de atividade */
const MAX_FEED = 80;
/** As listas (6 páginas) são rápidas; quase todo o tempo vai nas fichas */
const LIST_STEPS = 6;
const LIST_WEIGHT = 5;

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

async function api<T>(path: string, method: 'GET' | 'POST' | 'DELETE', body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    // Sem corpo JSON, a resposta não veio da aplicação (ex.: 504 = função excedeu o tempo)
    const message = data.error ?? `O servidor não respondeu (HTTP ${res.status}).`;
    throw new Error(data.detail ? `${message} Detalhe: ${data.detail}` : message);
  }
  return data as T;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

// ─── Progresso ───────────────────────────────────────────────────────────────

const PHASES: JobView['phase'][] = ['owners', 'properties', 'animals', 'exams', 'details'];

function listStepsDone(job: JobView): number {
  switch (job.phase) {
    case 'owners':     return 0;
    case 'properties': return 1;
    case 'animals':    return 2;
    case 'exams':      return 3 + Math.min(job.stats.exams.cursor, 3);
    default:           return LIST_STEPS;
  }
}

function percent(job: JobView): number {
  if (job.phase === 'done') return 100;
  const lists = (listStepsDone(job) / LIST_STEPS) * LIST_WEIGHT;
  const { done, total } = job.stats.details;
  const details = job.phase === 'details' && total > 0 ? (done / total) * (100 - LIST_WEIGHT) : 0;
  return Math.min(99, Math.round(lists + details));
}

function phaseLabel(job: JobView): string {
  switch (job.phase) {
    case 'owners':     return 'Lendo a lista de proprietários';
    case 'properties': return 'Lendo a lista de propriedades';
    case 'animals':    return 'Lendo a lista de animais';
    case 'exams':      return 'Lendo as requisições de exames';
    case 'details':    return `Importando fichas — ${job.stats.details.done} de ${job.stats.details.total}`;
    default:           return 'Concluído';
  }
}

function remainingLabel(job: JobView): string | null {
  if (job.phase !== 'details') return 'as listas levam menos de um minuto';
  const left = job.stats.details.total - job.stats.details.done;
  if (left <= 0) return null;
  const minutes = Math.ceil((left * (STEP_DELAY_MS + STEP_JITTER_MS / 2 + 1_200)) / 60_000);
  if (minutes <= 1) return 'menos de 1 minuto restante';
  if (minutes < 90) return `cerca de ${minutes} min restantes`;
  return `cerca de ${(Math.round(minutes / 6) / 10).toLocaleString('pt-BR')} h restantes`;
}

// ─── Ícones ──────────────────────────────────────────────────────────────────

const icon = (path: React.ReactNode, size = 18) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
       strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{path}</svg>
);
const Icons = {
  sync:     (s?: number) => icon(<><path d="M21 12a9 9 0 0 0-15-6.7L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 15 6.7l3-2.7"/><path d="M21 21v-5h-5"/></>, s),
  check:    (s?: number) => icon(<path d="M20 6 9 17l-5-5"/>, s),
  lock:     (s?: number) => icon(<><rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></>, s),
  users:    (s?: number) => icon(<><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></>, s),
  home:     (s?: number) => icon(<><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/></>, s),
  paw:      (s?: number) => icon(<><circle cx="11" cy="4" r="2"/><circle cx="18" cy="8" r="2"/><circle cx="20" cy="16" r="2"/><path d="M9 10a5 5 0 0 1 5 5v3.5a3.5 3.5 0 0 1-6.84 1.045Q6.52 17.48 4.46 16.84A3.5 3.5 0 0 1 5.5 10Z"/></>, s),
  flask:    (s?: number) => icon(<><path d="M9 3h6"/><path d="M10 3v6L4.5 18.5A1.7 1.7 0 0 0 6 21h12a1.7 1.7 0 0 0 1.5-2.5L14 9V3"/><path d="M7.5 15h9"/></>, s),
  chevron:  (s?: number) => icon(<path d="m6 9 6 6 6-6"/>, s),
  pause:    (s?: number) => icon(<><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></>, s),
  alert:    (s?: number) => icon(<><path d="m21.7 18-8-14a2 2 0 0 0-3.4 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></>, s),
};

// ─── Peças de interface ──────────────────────────────────────────────────────

const buttonStyle = (variant: 'primary' | 'ghost' | 'danger', disabled = false): React.CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
  padding: '0.625rem 1.125rem', borderRadius: '0.625rem', fontWeight: 600, fontSize: '0.875rem',
  cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.6 : 1, transition: 'opacity 0.15s',
  border: variant === 'primary' ? '1px solid transparent' : `1px solid ${variant === 'danger' ? 'hsl(0 84.2% 55% / 0.4)' : C.border}`,
  background: variant === 'primary' ? VET_BLUE : 'transparent',
  color: variant === 'primary' ? '#fff' : variant === 'danger' ? C.red : C.fg,
});

function Chip({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', fontWeight: 600, padding: '3px 10px', borderRadius: 999, color, background: `color-mix(in srgb, ${color} 12%, transparent)` }}>
      <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: '50%', background: color }} />
      {children}
    </span>
  );
}

function StatTile({ icon: tileIcon, label, value, hint }: { icon: React.ReactNode; label: string; value: number; hint: string }) {
  return (
    <div style={{ border: `1px solid ${C.border}`, borderRadius: '0.75rem', padding: '0.75rem 0.875rem', background: C.bg }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: C.muted, fontSize: '0.75rem', fontWeight: 600 }}>
        <span style={{ color: VET_BLUE, display: 'flex' }}>{tileIcon}</span>{label}
      </div>
      <div style={{ fontSize: '1.375rem', fontWeight: 800, color: C.fg, letterSpacing: '-0.02em', marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>
        {value.toLocaleString('pt-BR')}
      </div>
      <div style={{ fontSize: '0.75rem', color: C.muted }}>{hint}</div>
    </div>
  );
}

function Stats({ job }: { job: JobView }) {
  const { owners, properties, animals, exams } = job.stats;
  const news = (n: number, feminine = false) =>
    `${n.toLocaleString('pt-BR')} ${feminine ? (n === 1 ? 'nova' : 'novas') : (n === 1 ? 'novo' : 'novos')}`;
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5" style={{ marginTop: '1rem' }}>
      <StatTile icon={Icons.users(14)} label="Proprietários" value={owners.found} hint={news(owners.created)} />
      <StatTile icon={Icons.home(14)}  label="Propriedades"  value={properties.found} hint={news(properties.created, true)} />
      <StatTile icon={Icons.paw(14)}   label="Animais"       value={animals.found} hint={news(animals.created)} />
      <StatTile icon={Icons.flask(14)} label="Exames"        value={exams.found} hint={`${exams.linked.toLocaleString('pt-BR')} ligados a um animal`} />
    </div>
  );
}

function Stepper({ job, active }: { job: JobView; active: boolean }) {
  const current = job.phase === 'done' ? PHASES.length : PHASES.indexOf(job.phase);
  const labels = ['Proprietários', 'Propriedades', 'Animais', 'Exames', 'Fichas'];
  return (
    <ol style={{ listStyle: 'none', display: 'flex', margin: '1.125rem 0 0', padding: 0 }}>
      {labels.map((label, i) => {
        const done = i < current;
        const now = i === current;
        return (
          <li key={label} aria-current={now ? 'step' : undefined} style={{ flex: 1, minWidth: 0, textAlign: 'center', position: 'relative' }}>
            {i > 0 && (
              <span aria-hidden="true" style={{ position: 'absolute', top: 11, right: '50%', width: '100%', height: 2, background: i <= current ? (done ? C.green : VET_BLUE) : C.border, zIndex: 0 }} />
            )}
            <span style={{
              position: 'relative', zIndex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 24, height: 24, borderRadius: '50%', fontSize: '0.6875rem', fontWeight: 700,
              background: done ? C.green : now ? VET_BLUE : C.card, color: done || now ? '#fff' : C.muted,
              border: `2px solid ${done ? C.green : now ? VET_BLUE : C.border}`,
              boxShadow: now && active ? `0 0 0 4px ${VET_BLUE_LIGHT}` : 'none',
            }}>
              {done ? Icons.check(12) : i + 1}
            </span>
            <span style={{ display: 'block', marginTop: 6, fontSize: '0.6875rem', fontWeight: now ? 700 : 500, color: done || now ? C.fg : C.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function ProgressBar({ value, color = VET_BLUE }: { value: number; color?: string }) {
  return (
    <div role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}
         style={{ height: 8, borderRadius: 999, background: C.soft, overflow: 'hidden' }}>
      <div style={{ width: `${value}%`, height: '100%', background: color, borderRadius: 999, transition: 'width 0.5s ease' }} />
    </div>
  );
}

// ─── Atividade (de-para registro a registro) ─────────────────────────────────

const OUTCOME: Record<SyncEvent['outcome'], { label: string; color: string }> = {
  created:   { label: 'Novo',        color: C.green },
  updated:   { label: 'Atualizado',  color: VET_BLUE },
  unchanged: { label: 'Sem mudança', color: C.muted },
  skipped:   { label: 'Ignorado',    color: C.amber },
  error:     { label: 'Erro',        color: C.red },
};

const SCOPE: Record<SyncEvent['scope'], string> = {
  owners: 'Lista', properties: 'Lista', animals: 'Lista', exams: 'Lista',
  animal: 'Animal', owner: 'Proprietário', property: 'Propriedade', link: 'Vínculo',
};

type Filter = 'all' | 'changed' | 'problems';
const FILTERS: { key: Filter; label: string; test: (e: FeedEntry) => boolean }[] = [
  { key: 'all',      label: 'Tudo',       test: () => true },
  { key: 'changed',  label: 'Importados', test: e => e.outcome === 'created' || e.outcome === 'updated' },
  { key: 'problems', label: 'Pendências', test: e => e.outcome === 'error' || e.outcome === 'skipped' },
];

function Changes({ changes }: { changes: SyncChange[] }) {
  if (!changes.length) return null;
  return (
    <dl style={{ display: 'grid', gridTemplateColumns: 'minmax(96px, max-content) 1fr', columnGap: 12, rowGap: 3, margin: '6px 0 0' }}>
      {changes.map(c => (
        <div key={c.field} style={{ display: 'contents' }}>
          <dt style={{ fontSize: '0.75rem', color: C.muted, opacity: c.written ? 1 : 0.6 }}>{c.field}</dt>
          <dd style={{ fontSize: '0.75rem', color: C.fg, margin: 0, wordBreak: 'break-word', opacity: c.written ? 1 : 0.6 }}>
            {c.from ?? '—'}
            {(c.to !== c.from || !c.written) && (
              <>
                <span aria-label="vira" style={{ color: C.muted }}> → </span>
                {c.to === null ? <em style={{ color: C.muted }}>não importado</em> : <strong>{c.to}</strong>}
              </>
            )}
            {!c.written && c.to !== null && <span style={{ color: C.muted }}> · já preenchido</span>}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function FeedItem({ entry, open, onToggle }: { entry: FeedEntry; open: boolean; onToggle: () => void }) {
  const outcome = OUTCOME[entry.outcome];
  const written = entry.changes.filter(c => c.written).length;
  const expandable = entry.changes.length > 0 || (entry.samples?.length ?? 0) > 0;
  const summary = entry.note
    ?? (entry.changes.length ? `${written} de ${entry.changes.length} campos gravados` : null);

  return (
    <li style={{ borderTop: `1px solid ${C.border}` }}>
      <button type="button" onClick={onToggle} disabled={!expandable} aria-expanded={expandable ? open : undefined}
              style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '0.625rem 0.875rem', background: 'transparent', border: 'none', textAlign: 'left', cursor: expandable ? 'pointer' : 'default', color: C.fg }}>
        <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: '50%', background: outcome.color, flexShrink: 0 }} />
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.8125rem', fontWeight: 600 }}>{entry.title}</span>
            <span style={{ fontSize: '0.6875rem', color: C.muted }}>{SCOPE[entry.scope]}</span>
          </span>
          {summary && <span style={{ display: 'block', fontSize: '0.75rem', color: C.muted, marginTop: 1 }}>{summary}</span>}
        </span>
        <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: outcome.color, flexShrink: 0 }}>{outcome.label}</span>
        <span className="hidden sm:inline" style={{ fontSize: '0.6875rem', color: C.muted, flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>{entry.at}</span>
        <span style={{ color: C.muted, display: 'flex', flexShrink: 0, visibility: expandable ? 'visible' : 'hidden', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>
          {Icons.chevron(14)}
        </span>
      </button>
      {open && expandable && (
        <div style={{ padding: '0 0.875rem 0.75rem 2rem' }}>
          <Changes changes={entry.changes} />
          {entry.samples?.map(sample => (
            <div key={sample.title} style={{ marginTop: 10, paddingTop: 8, borderTop: `1px dashed ${C.border}` }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: C.fg }}>{sample.title}</div>
              <Changes changes={sample.changes} />
            </div>
          ))}
        </div>
      )}
    </li>
  );
}

function Feed({ entries }: { entries: FeedEntry[] }) {
  const [filter, setFilter] = useState<Filter>('all');
  const [openId, setOpenId] = useState<number | null>(null);
  const counts = useMemo(
    () => Object.fromEntries(FILTERS.map(f => [f.key, entries.filter(f.test).length])) as Record<Filter, number>,
    [entries],
  );
  if (!entries.length) return null;
  const visible = entries.filter(FILTERS.find(f => f.key === filter)!.test);

  return (
    <section style={{ marginTop: '1.5rem' }} aria-label="Atividade da sincronização">
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: '0.5rem' }}>
        <div>
          <h3 style={{ fontSize: '0.875rem', fontWeight: 700, color: C.fg }}>Atividade</h3>
          <p style={{ fontSize: '0.75rem', color: C.muted }}>Abra uma linha para ver o valor do portal e como ficou no EquiCore.</p>
        </div>
        <div role="tablist" aria-label="Filtrar atividade" style={{ display: 'flex', gap: 4, background: C.soft, padding: 3, borderRadius: '0.5rem' }}>
          {FILTERS.map(f => (
            <button key={f.key} type="button" role="tab" aria-selected={filter === f.key} onClick={() => setFilter(f.key)}
                    style={{ padding: '0.25rem 0.625rem', borderRadius: '0.375rem', border: 'none', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', background: filter === f.key ? C.card : 'transparent', color: filter === f.key ? C.fg : C.muted, boxShadow: filter === f.key ? '0 1px 2px rgb(0 0 0 / 0.08)' : 'none' }}>
              {f.label} <span style={{ color: C.muted, fontWeight: 500 }}>{counts[f.key]}</span>
            </button>
          ))}
        </div>
      </div>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, maxHeight: 420, overflowY: 'auto', border: `1px solid ${C.border}`, borderRadius: '0.75rem', borderTop: 'none' }}>
        {visible.length === 0 && (
          <li style={{ borderTop: `1px solid ${C.border}`, padding: '1rem', fontSize: '0.8125rem', color: C.muted, textAlign: 'center' }}>Nada neste filtro.</li>
        )}
        {visible.map(entry => (
          <FeedItem key={entry.id} entry={entry} open={openId === entry.id}
                    onToggle={() => setOpenId(prev => (prev === entry.id ? null : entry.id))} />
        ))}
      </ul>
    </section>
  );
}

function Issues({ job }: { job: JobView }) {
  const { issues, details, health, files, links } = job.stats;
  const extras = [
    health.records ? `${health.records} registros de saúde` : null,
    files.resenhos ? `${files.resenhos} resenhos` : null,
    files.photos ? `${files.photos} fotos` : null,
    links.total ? `${links.linked} de ${links.total} animais ligados à propriedade` : null,
  ].filter(Boolean);
  const total = issues.length + (details.errors ? 1 : 0);

  return (
    <>
      {extras.length > 0 && (
        <p style={{ fontSize: '0.8125rem', color: C.muted, marginTop: '0.75rem' }}>Das fichas: {extras.join(' · ')}</p>
      )}
      {total > 0 && (
        <details style={{ marginTop: '0.75rem', border: '1px solid hsl(35 92% 40% / 0.3)', background: 'hsl(35 92% 50% / 0.06)', borderRadius: '0.75rem', padding: '0.625rem 0.875rem' }}>
          <summary style={{ fontSize: '0.8125rem', fontWeight: 600, color: C.fg, cursor: 'pointer' }}>
            <span style={{ color: C.amber, display: 'inline-flex', verticalAlign: '-2px', marginRight: 6 }}>{Icons.alert(15)}</span>
            {total} {total === 1 ? 'pendência para revisar' : 'pendências para revisar'}
          </summary>
          <ul style={{ margin: '0.5rem 0 0', paddingLeft: '1.25rem' }}>
            {details.errors > 0 && (
              <li style={{ fontSize: '0.8125rem', color: C.fg, padding: '0.125rem 0' }}>
                {details.errors} {details.errors === 1 ? 'página não pôde ser lida' : 'páginas não puderam ser lidas'} — serão tentadas de novo na próxima sincronização.
              </li>
            )}
            {issues.map((issue, i) => (
              <li key={i} style={{ fontSize: '0.8125rem', color: C.muted, padding: '0.125rem 0' }}>{issue}</li>
            ))}
          </ul>
        </details>
      )}
    </>
  );
}

// ─── Antes de conectar ───────────────────────────────────────────────────────

function HowItWorks() {
  const steps = [
    ['Conecte', 'Informe o login que você já usa no portal SGQ.'],
    ['Sincronize', 'O EquiCore lê seus cadastros devagar, sem alterar nada lá.'],
    ['Confira', 'Proprietários, animais e exames aparecem em Registros.'],
  ];
  return (
    <ol className="grid grid-cols-1 sm:grid-cols-3 gap-2.5" style={{ listStyle: 'none', padding: 0, margin: '0 0 1.5rem' }}>
      {steps.map(([title, text], i) => (
        <li key={title} style={{ border: `1px solid ${C.border}`, borderRadius: '0.75rem', padding: '0.75rem 0.875rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8125rem', fontWeight: 700, color: C.fg }}>
            <span style={{ width: 20, height: 20, borderRadius: '50%', background: VET_BLUE_LIGHT, color: VET_BLUE, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6875rem' }}>{i + 1}</span>
            {title}
          </div>
          <p style={{ fontSize: '0.75rem', color: C.muted, marginTop: 4, lineHeight: 1.45 }}>{text}</p>
        </li>
      ))}
    </ol>
  );
}

// ─── Componente principal ────────────────────────────────────────────────────

export default function SgqIntegration() {
  const [status, setStatus]       = useState<Status | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError]         = useState<string | null>(null);
  const [username, setUsername]   = useState('');
  const [password, setPassword]   = useState('');
  const [consent, setConsent]     = useState(false);
  const [busy, setBusy]           = useState(false);
  const [syncing, setSyncing]     = useState(false);
  const [feed, setFeed]           = useState<FeedEntry[]>([]);
  const [full, setFull]           = useState(false);
  const [retrying, setRetrying]   = useState<string | null>(null);
  const loopActive = useRef(false);
  const feedId = useRef(0);

  useEffect(() => {
    api<Status>('/api/sgq/status', 'GET')
      .then(setStatus)
      .catch(err => setLoadError(err.message));
    // Sair da tela pausa o laço; o job continua salvo no servidor
    return () => { loopActive.current = false; };
  }, []);

  const setJob = (job: JobView | null) => setStatus(prev => (prev ? { ...prev, job } : prev));

  const pushEvent = (event: SyncEvent | null | undefined) => {
    if (!event) return;
    const entry: FeedEntry = {
      ...event,
      id: ++feedId.current,
      at: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    };
    setFeed(prev => [entry, ...prev].slice(0, MAX_FEED));
  };

  async function runLoop() {
    if (loopActive.current) return;
    loopActive.current = true;
    setSyncing(true);
    setError(null);
    setRetrying(null);
    let failures = 0;
    let lastError: string | null = null;
    let lastProgress = Date.now();

    try {
      const started = await api<{ job: JobView }>('/api/sgq/sync', 'POST', { action: 'start', full });
      setJob(started.job);

      while (loopActive.current) {
        let res: { job: JobView | null; wait?: boolean; event?: SyncEvent | null };
        try {
          res = await api('/api/sgq/sync', 'POST', { action: 'tick' });
        } catch (err) {
          // Falha momentânea: tenta mais algumas vezes antes de parar
          lastError = err instanceof Error ? err.message : 'Falha na comunicação com o servidor.';
          if (++failures > MAX_NETWORK_RETRIES) throw err;
          setRetrying(`${lastError} Tentando de novo (${failures} de ${MAX_NETWORK_RETRIES})…`);
          await sleep(5_000 * failures);
          continue;
        }

        if (!res.job) break;
        setJob(res.job);
        pushEvent(res.event);

        if (res.wait) {
          // "Aguarde" não é progresso: se só vier isso, um passo anterior ficou preso
          if (Date.now() - lastProgress > STALL_LIMIT_MS) {
            throw new Error(
              `A sincronização não avança há mais de ${Math.round(STALL_LIMIT_MS / 60_000)} minutos.` +
              (lastError ? ` Último erro: ${lastError}` : ' O servidor não concluiu o passo em andamento.') +
              ' O progresso está salvo; tente continuar em alguns minutos.',
            );
          }
        } else {
          failures = 0;
          lastError = null;
          lastProgress = Date.now();
          setRetrying(null);
        }
        if (res.job.status !== 'running') {
          if (res.job.status === 'done') {
            setStatus(prev => (prev ? { ...prev, lastSyncAt: res.job!.finishedAt } : prev));
            setFull(false);
          }
          break;
        }
        await sleep(res.wait ? 1_500 : STEP_DELAY_MS + Math.random() * STEP_JITTER_MS);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha na sincronização.');
    } finally {
      loopActive.current = false;
      setSyncing(false);
      setRetrying(null);
    }
  }

  function pause() {
    loopActive.current = false;
  }

  async function cancel() {
    if (!window.confirm('Cancelar a sincronização? O que já foi importado continua no EquiCore, e você pode sincronizar de novo depois.')) return;
    loopActive.current = false;
    setBusy(true);
    try {
      await api('/api/sgq/sync', 'POST', { action: 'cancel' });
      setStatus(prev => (prev?.job ? { ...prev, job: { ...prev.job, status: 'cancelled' } } : prev));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível cancelar.');
    } finally {
      setBusy(false);
    }
  }

  async function connect(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!consent) { setError('Marque a autorização para continuar.'); return; }
    setBusy(true);
    try {
      const res = await api<{ username: string }>('/api/sgq/credentials', 'POST', { username, password, consent: true });
      setStatus(prev => (prev ? { ...prev, connected: true, username: res.username } : prev));
      setUsername('');
      setConsent(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível conectar.');
    } finally {
      // A senha nunca fica guardada no navegador depois do envio
      setPassword('');
      setBusy(false);
    }
  }

  async function disconnect() {
    if (!window.confirm('Remover a conexão com o portal SGQ? Os cadastros já importados continuam no EquiCore.')) return;
    loopActive.current = false;
    setBusy(true);
    setError(null);
    try {
      await api('/api/sgq/credentials', 'DELETE');
      setStatus(prev => (prev ? { ...prev, connected: false, username: null, job: null } : prev));
      setFeed([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível desconectar.');
    } finally {
      setBusy(false);
    }
  }

  const card: React.CSSProperties = {
    background: C.card, border: `1px solid ${C.border}`, borderRadius: '1rem', padding: '1.5rem',
  };

  if (loadError) {
    return <div style={card}><Banner kind="error">{loadError}</Banner></div>;
  }
  if (!status) {
    return (
      <div style={card} aria-busy="true" aria-label="Carregando integração">
        <div style={{ height: 18, width: '55%', borderRadius: 6, background: C.soft, marginBottom: 12 }} />
        <div style={{ height: 12, width: '85%', borderRadius: 6, background: C.soft, marginBottom: 24 }} />
        <div style={{ height: 88, borderRadius: 12, background: C.soft }} />
      </div>
    );
  }

  const job = status.job;
  const running = job?.status === 'running';
  const paused = running && !syncing;
  const pct = job ? percent(job) : 0;
  // Job interrompido que já tinha lido as listas: sincronizar de novo continua das fichas que faltam
  const resumable = !!job && (job.status === 'cancelled' || job.status === 'error') && job.stats.animals.found > 0;

  return (
    <div style={card}>
      {/* Cabeçalho */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: '1.25rem' }}>
        <span style={{ width: 40, height: 40, borderRadius: '0.75rem', background: VET_BLUE_LIGHT, color: VET_BLUE, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          {Icons.sync(20)}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 700, color: C.fg }}>Portal SGQ</h2>
            {status.configured && (status.connected
              ? <Chip color={C.green}>Conectado</Chip>
              : <Chip color={C.muted}>Não conectado</Chip>)}
          </div>
          <p style={{ fontSize: '0.8125rem', color: C.muted, marginTop: 2, lineHeight: 1.5 }}>
            Traga para o EquiCore os proprietários, animais, exames e histórico que você já tem no Portal Central de Requisições.
          </p>
        </div>
      </div>

      {error && <Banner kind="error">{error}</Banner>}

      {!status.configured && (
        <Banner kind="error">Integração ainda não habilitada no servidor. Fale com o suporte do EquiCore.</Banner>
      )}

      {/* ── Conectar ───────────────────────────────────────────── */}
      {status.configured && !status.connected && (
        <>
          <HowItWorks />
          <form onSubmit={connect} style={{ maxWidth: 440 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem', marginBottom: '1rem' }}>
              <Field label="E-mail de acesso ao portal SGQ">
                <input type="text" autoComplete="off" value={username} onChange={e => setUsername(e.target.value)}
                       placeholder="voce@exemplo.com" style={inputStyle} required />
              </Field>
              <Field label="Senha do portal SGQ">
                <input type="password" autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)}
                       placeholder="••••••••" style={inputStyle} required />
              </Field>
            </div>
            <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: '0.8125rem', color: C.fg, lineHeight: 1.5, marginBottom: '1.25rem', cursor: 'pointer' }}>
              <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} style={{ marginTop: 3 }} />
              <span>
                Autorizo o EquiCore a acessar minha conta no portal SGQ para importar meus cadastros e declaro que
                posso tratar os dados dos proprietários nele registrados (LGPD).
              </span>
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
              <button type="submit" disabled={busy} style={buttonStyle('primary', busy)}>
                {busy ? 'Verificando login…' : 'Conectar conta'}
              </button>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', color: C.muted }}>
                {Icons.lock(13)} Senha criptografada; você remove a conexão quando quiser.
              </span>
            </div>
          </form>
        </>
      )}

      {/* ── Conectado ──────────────────────────────────────────── */}
      {status.configured && status.connected && (
        <>
          {/* Painel de sincronização */}
          <div style={{ border: `1px solid ${running ? 'hsl(221 83% 53% / 0.35)' : C.border}`, borderRadius: '0.875rem', padding: '1.125rem 1.125rem 1.25rem', background: running ? 'hsl(221 83% 53% / 0.03)' : C.bg }}>
            {running && job ? (
              <>
                <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, marginBottom: 8 }}>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: '0.75rem', fontWeight: 700, color: paused ? C.amber : VET_BLUE, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      {paused ? 'Pausada' : 'Sincronizando'}
                    </p>
                    <p style={{ fontSize: '0.9375rem', fontWeight: 700, color: C.fg, marginTop: 2 }}>{phaseLabel(job)}</p>
                  </div>
                  <span style={{ fontSize: '1.75rem', fontWeight: 800, color: C.fg, letterSpacing: '-0.03em', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
                    {pct}<span style={{ fontSize: '1rem', color: C.muted }}>%</span>
                  </span>
                </div>
                <ProgressBar value={pct} color={paused ? C.amber : VET_BLUE} />
                <p style={{ fontSize: '0.8125rem', color: C.muted, marginTop: 8, lineHeight: 1.5 }}>
                  {paused
                    ? 'O progresso está salvo. Continue quando quiser, nesta ou em outra sessão.'
                    : <>Uma página do portal por vez{remainingLabel(job) ? ` — ${remainingLabel(job)}` : ''}. Deixe esta aba aberta.</>}
                </p>
                {retrying && (
                  <p role="status" style={{ fontSize: '0.8125rem', color: C.amber, marginTop: 8, lineHeight: 1.5 }}>{retrying}</p>
                )}
                <Stepper job={job} active={syncing} />
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: '1.125rem' }}>
                  {paused
                    ? <button type="button" onClick={runLoop} disabled={busy} style={buttonStyle('primary', busy)}>{Icons.sync(15)} Continuar</button>
                    : <button type="button" onClick={pause} style={buttonStyle('ghost')}>{Icons.pause(14)} Pausar</button>}
                  <button type="button" onClick={cancel} disabled={busy} style={buttonStyle('ghost', busy)}>Cancelar</button>
                </div>
              </>
            ) : (
              <>
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ minWidth: 0, flex: '1 1 260px' }}>
                    <p style={{ fontSize: '0.9375rem', fontWeight: 700, color: C.fg }}>
                      {job?.status === 'done' ? 'Tudo sincronizado'
                        : resumable ? 'Sincronização interrompida'
                        : status.lastSyncAt ? 'Pronto para sincronizar de novo'
                        : 'Pronto para a primeira sincronização'}
                    </p>
                    <p style={{ fontSize: '0.8125rem', color: C.muted, marginTop: 2, lineHeight: 1.5 }}>
                      {resumable && job
                        ? job.phase === 'details'
                          ? `Parou em ${job.stats.details.done} de ${job.stats.details.total} fichas. Ao sincronizar, continua das que faltam.`
                          : 'O que já foi importado não é duplicado ao sincronizar de novo.'
                        : status.lastSyncAt
                          ? `Última sincronização completa em ${formatDateTime(status.lastSyncAt)}.`
                          : 'A primeira carga lê todos os cadastros e pode levar mais de uma hora, com a aba aberta.'}
                    </p>
                  </div>
                  <button type="button" onClick={runLoop} disabled={busy} style={buttonStyle('primary', busy)}>
                    {Icons.sync(15)} {resumable ? 'Continuar sincronização' : 'Sincronizar agora'}
                  </button>
                </div>
                {status.lastSyncAt && (
                  <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: '0.8125rem', color: C.fg, lineHeight: 1.5, marginTop: '0.875rem', cursor: 'pointer' }}>
                    <input type="checkbox" checked={full} onChange={e => setFull(e.target.checked)} style={{ marginTop: 3 }} />
                    <span>
                      Reler também as fichas já importadas
                      <span style={{ color: C.muted }}> — busca exames e registros novos de animais antigos; leva o tempo de uma carga completa.</span>
                    </span>
                  </label>
                )}
              </>
            )}
          </div>

          {job?.status === 'error' && (
            <div style={{ marginTop: '1rem' }}>
              <Banner kind="error">{job.error ?? 'A sincronização foi interrompida.'}</Banner>
            </div>
          )}
          {job?.status === 'done' && (
            <div style={{ marginTop: '1rem' }}>
              <Banner kind="success">
                Sincronização concluída{job.finishedAt ? ` em ${formatDateTime(job.finishedAt)}` : ''}.{' '}
                <a href="/vet/registros" style={{ color: 'inherit', fontWeight: 700 }}>Ver em Registros →</a>
              </Banner>
            </div>
          )}

          {job && job.stats.owners.found > 0 && (
            <>
              <Stats job={job} />
              <Issues job={job} />
            </>
          )}

          <Feed entries={feed} />

          {/* Conta conectada */}
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: '1.5rem', paddingTop: '1rem', borderTop: `1px solid ${C.border}` }}>
            <div style={{ fontSize: '0.8125rem', color: C.muted, minWidth: 0, flex: '1 1 260px' }}>
              Conta do portal: <strong style={{ color: C.fg }}>{status.username}</strong>
              <span style={{ display: 'block', fontSize: '0.75rem', marginTop: 2, lineHeight: 1.45 }}>
                Animais importados só aparecem para o proprietário depois que você ativa o compartilhamento em Registros.
              </span>
            </div>
            {!running && (
              <button type="button" onClick={disconnect} disabled={busy} style={{ ...buttonStyle('danger', busy), padding: '0.4rem 0.75rem', fontSize: '0.8125rem' }}>
                Desconectar
              </button>
            )}
          </div>
        </>
      )}

      {status.configured && (
        <details style={{ marginTop: '1.25rem', borderTop: `1px solid ${C.border}`, paddingTop: '1rem' }}>
          <summary style={{ fontSize: '0.875rem', fontWeight: 700, color: C.fg, cursor: 'pointer' }}>
            O que é importado (de-para)
          </summary>
          <SgqDePara />
        </details>
      )}
    </div>
  );
}
