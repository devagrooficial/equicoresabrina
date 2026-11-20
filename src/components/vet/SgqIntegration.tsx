import { useEffect, useRef, useState } from 'react';
import { Banner, Field, inputStyle, VET_BLUE } from './formUI';
import type { JobView } from '../../lib/sgq/sync';

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

const C = {
  fg:     'hsl(var(--foreground))',
  muted:  'hsl(var(--muted-foreground))',
  card:   'hsl(var(--card))',
  border: 'hsl(var(--border))',
  green:  'hsl(142 71% 35%)',
  red:    'hsl(0 84.2% 55%)',
};

// Pausa entre passos (o servidor também impõe um mínimo de 2,5 s)
const STEP_DELAY_MS = 2_800;
const STEP_JITTER_MS = 1_500;
const MAX_NETWORK_RETRIES = 3;

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

async function api<T>(path: string, method: 'GET' | 'POST' | 'DELETE', body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? 'Falha na comunicação com o servidor.');
  return data as T;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

function phaseLabel(job: JobView): string {
  switch (job.phase) {
    case 'owners':     return 'Lendo a lista de proprietários…';
    case 'properties': return 'Lendo a lista de propriedades…';
    case 'animals':    return 'Lendo a lista de animais…';
    case 'details':    return `Importando fichas: ${job.stats.details.done} de ${job.stats.details.total}`;
    default:           return 'Concluído';
  }
}

function remainingLabel(job: JobView): string | null {
  if (job.phase !== 'details') return null;
  const left = job.stats.details.total - job.stats.details.done;
  if (left <= 0) return null;
  const minutes = Math.ceil((left * (STEP_DELAY_MS + STEP_JITTER_MS / 2 + 1_200)) / 60_000);
  return minutes <= 1 ? 'menos de 1 minuto restante' : `cerca de ${minutes} minutos restantes`;
}

const buttonStyle = (variant: 'primary' | 'ghost' | 'danger', disabled = false): React.CSSProperties => ({
  padding: '0.625rem 1.25rem', borderRadius: '0.625rem', fontWeight: 600, fontSize: '0.875rem',
  cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.6 : 1,
  border: variant === 'primary' ? 'none' : `1px solid ${variant === 'danger' ? C.red : C.border}`,
  background: variant === 'primary' ? VET_BLUE : 'transparent',
  color: variant === 'primary' ? '#fff' : variant === 'danger' ? C.red : C.fg,
});

function StatLine({ label, found, created, matched, extra }: {
  label: string; found: number; created: number; matched: number; extra?: string;
}) {
  return (
    <li style={{ fontSize: '0.8125rem', color: C.fg, padding: '0.25rem 0' }}>
      <strong>{found}</strong> {label}
      <span style={{ color: C.muted }}>
        {' '}— {created} {created === 1 ? 'novo' : 'novos'}, {matched} já no EquiCore{extra ? `, ${extra}` : ''}
      </span>
    </li>
  );
}

function JobSummary({ job }: { job: JobView }) {
  const { owners, properties, animals, details, issues } = job.stats;
  const listsRead = job.phase === 'details' || job.phase === 'done';
  return (
    <div style={{ marginTop: '1rem' }}>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {(job.phase !== 'owners') && (
          <StatLine label="proprietários no portal" found={owners.found} created={owners.created} matched={owners.matched}
                    extra={owners.noCpf ? `${owners.noCpf} sem CPF/CNPJ` : undefined} />
        )}
        {(job.phase === 'animals' || listsRead) && (
          <StatLine label="propriedades no portal" found={properties.found} created={properties.created} matched={properties.matched} />
        )}
        {listsRead && (
          <StatLine label="animais no portal" found={animals.found} created={animals.created} matched={animals.matched}
                    extra={animals.skipped ? `${animals.skipped} não importados` : undefined} />
        )}
      </ul>
      {details.errors > 0 && (
        <p style={{ fontSize: '0.8125rem', color: C.red, marginTop: '0.5rem' }}>
          {details.errors} {details.errors === 1 ? 'ficha não pôde ser lida' : 'fichas não puderam ser lidas'} — serão tentadas de novo na próxima sincronização.
        </p>
      )}
      {issues.length > 0 && (
        <details style={{ marginTop: '0.75rem' }}>
          <summary style={{ fontSize: '0.8125rem', fontWeight: 600, color: C.fg, cursor: 'pointer' }}>
            Pendências para revisar ({issues.length})
          </summary>
          <ul style={{ margin: '0.5rem 0 0', paddingLeft: '1.1rem' }}>
            {issues.map((issue, i) => (
              <li key={i} style={{ fontSize: '0.8125rem', color: C.muted, padding: '0.125rem 0' }}>{issue}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

export default function SgqIntegration() {
  const [status, setStatus]     = useState<Status | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError]       = useState<string | null>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [consent, setConsent]   = useState(false);
  const [busy, setBusy]         = useState(false);
  const [syncing, setSyncing]   = useState(false);
  const loopActive = useRef(false);

  useEffect(() => {
    api<Status>('/api/sgq/status', 'GET')
      .then(setStatus)
      .catch(err => setLoadError(err.message));
    // Sair da tela pausa o laço; o job continua salvo no servidor
    return () => { loopActive.current = false; };
  }, []);

  const setJob = (job: JobView | null) => setStatus(prev => (prev ? { ...prev, job } : prev));

  async function runLoop() {
    if (loopActive.current) return;
    loopActive.current = true;
    setSyncing(true);
    setError(null);
    let failures = 0;

    try {
      const started = await api<{ job: JobView }>('/api/sgq/sync', 'POST', { action: 'start' });
      setJob(started.job);

      while (loopActive.current) {
        let res: { job: JobView | null; wait?: boolean };
        try {
          res = await api('/api/sgq/sync', 'POST', { action: 'tick' });
          failures = 0;
        } catch (err) {
          // Queda de rede momentânea: tenta mais algumas vezes antes de pausar
          if (++failures > MAX_NETWORK_RETRIES) throw err;
          await sleep(5_000 * failures);
          continue;
        }

        if (!res.job) break;
        setJob(res.job);
        if (res.job.status !== 'running') {
          if (res.job.status === 'done') {
            setStatus(prev => (prev ? { ...prev, lastSyncAt: res.job!.finishedAt } : prev));
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
    }
  }

  function pause() {
    loopActive.current = false;
  }

  async function cancel() {
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
    return <div style={card}><p style={{ fontSize: '0.875rem', color: C.muted }}>Carregando integração…</p></div>;
  }

  const job = status.job;
  const jobRunning = job?.status === 'running';
  const paused = jobRunning && !syncing;
  const progress = job && job.phase === 'details' && job.stats.details.total > 0
    ? Math.round((job.stats.details.done / job.stats.details.total) * 100)
    : null;

  return (
    <div style={card}>
      <h2 style={{ fontSize: '1rem', fontWeight: 700, color: C.fg, marginBottom: '0.25rem' }}>
        Portal Central de Requisições (SGQ)
      </h2>
      <p style={{ fontSize: '0.8125rem', color: C.muted, marginBottom: '1.25rem', lineHeight: 1.5 }}>
        Importa para o EquiCore os proprietários, propriedades e animais já cadastrados na sua conta do portal SGQ.
        Nada é alterado no portal, e cadastros que você já tem aqui não são sobrescritos.
      </p>

      {error && <Banner kind="error">{error}</Banner>}

      {!status.configured && (
        <Banner kind="error">Integração ainda não habilitada no servidor. Fale com o suporte do EquiCore.</Banner>
      )}

      {/* ── Conectar ───────────────────────────────────────────── */}
      {status.configured && !status.connected && (
        <form onSubmit={connect} style={{ maxWidth: 420 }}>
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
              posso tratar os dados dos proprietários nele registrados (LGPD). A senha fica criptografada e posso
              remover a conexão quando quiser.
            </span>
          </label>
          <button type="submit" disabled={busy} style={buttonStyle('primary', busy)}>
            {busy ? 'Verificando login…' : 'Conectar'}
          </button>
        </form>
      )}

      {/* ── Conectado ──────────────────────────────────────────── */}
      {status.configured && status.connected && (
        <>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: '1.25rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, padding: '2px 8px', borderRadius: 999, background: 'hsl(142 71% 45% / 0.12)', color: C.green }}>
              Conectado
            </span>
            <span style={{ fontSize: '0.8125rem', color: C.fg }}>{status.username}</span>
            <span style={{ fontSize: '0.8125rem', color: C.muted }}>
              · {status.lastSyncAt ? `última sincronização em ${formatDateTime(status.lastSyncAt)}` : 'nunca sincronizado'}
            </span>
          </div>

          {jobRunning && job && (
            <div style={{ marginBottom: '1.25rem' }}>
              <p style={{ fontSize: '0.875rem', fontWeight: 600, color: C.fg, marginBottom: '0.5rem' }}>
                {paused ? 'Sincronização pausada' : phaseLabel(job)}
              </p>
              {progress !== null && (
                <div role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}
                     style={{ height: 8, borderRadius: 999, background: 'hsl(var(--muted))', overflow: 'hidden', marginBottom: '0.5rem' }}>
                  <div style={{ width: `${progress}%`, height: '100%', background: VET_BLUE, transition: 'width 0.4s' }} />
                </div>
              )}
              <p style={{ fontSize: '0.8125rem', color: C.muted, lineHeight: 1.5 }}>
                {paused
                  ? `Parou em: ${phaseLabel(job).replace(/…$/, '')}. O progresso está salvo.`
                  : <>A leitura é feita devagar, uma página por vez{remainingLabel(job) ? ` — ${remainingLabel(job)}` : ''}. Mantenha esta aba aberta; se fechar, você retoma depois de onde parou.</>}
              </p>
            </div>
          )}

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {!jobRunning && (
              <button type="button" onClick={runLoop} disabled={busy} style={buttonStyle('primary', busy)}>
                Sincronizar agora
              </button>
            )}
            {paused && (
              <button type="button" onClick={runLoop} disabled={busy} style={buttonStyle('primary', busy)}>
                Continuar sincronização
              </button>
            )}
            {jobRunning && syncing && (
              <button type="button" onClick={pause} style={buttonStyle('ghost')}>Pausar</button>
            )}
            {jobRunning && (
              <button type="button" onClick={cancel} disabled={busy} style={buttonStyle('ghost', busy)}>Cancelar</button>
            )}
            {!jobRunning && (
              <button type="button" onClick={disconnect} disabled={busy} style={buttonStyle('danger', busy)}>
                Desconectar
              </button>
            )}
          </div>

          {job && job.status === 'error' && (
            <div style={{ marginTop: '1.25rem' }}>
              <Banner kind="error">{job.error ?? 'A sincronização foi interrompida.'}</Banner>
            </div>
          )}
          {job && job.status === 'done' && (
            <div style={{ marginTop: '1.25rem' }}>
              <Banner kind="success">Sincronização concluída{job.finishedAt ? ` em ${formatDateTime(job.finishedAt)}` : ''}.</Banner>
            </div>
          )}

          {job && job.status !== 'cancelled' && <JobSummary job={job} />}

          <p style={{ fontSize: '0.75rem', color: C.muted, marginTop: '1.25rem', lineHeight: 1.5 }}>
            Animais importados só ficam visíveis ao proprietário depois que você ativar o compartilhamento em Registros.
            Proprietários sem CPF/CNPJ no portal não são importados, porque o CPF é o que liga o dono ao cadastro dele no EquiCore.
          </p>
        </>
      )}
    </div>
  );
}
