import { useState, useMemo, useEffect } from 'react';
import { createClient } from '../../lib/supabase';

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
};

type EquineStatus = 'healthy' | 'attention' | 'urgent' | 'critical';

interface EquineData {
  id: string;
  name: string;
  nickname?: string;
  breed: string;
  sex: string;
  coat: string;
  age: string;
  status: EquineStatus;
  statusLabel: string;
  alertsCount: number;
  purpose: string[];
  registration: string;
  property: string;
}

const BREED_LABEL: Record<string, string> = {
  QUARTO_DE_MILHA: 'Quarto de Milha', MANGALARGA_MARCHADOR: 'Mangalarga Marchador',
  PURO_SANGUE_INGLES: 'Puro Sangue Inglês', LUSITANO: 'Lusitano',
  BRASILEIRO_DE_HIPISMO: 'Brasileiro de Hipismo', CRIOULO: 'Crioulo',
  CAMPOLINA: 'Campolina', APPALOOSA: 'Appaloosa', PAINT_HORSE: 'Paint Horse',
  ANDALUZ: 'Andaluz', ARABE: 'Árabe', HAFLINGER: 'Haflinger',
  FRIESIO: 'Frísio', ARDENÊS: 'Ardenês', OTHER: 'Outra raça',
};
const SEX_LABEL: Record<string, string> = {
  GARANHAO: 'Garanhão', CASTRADO: 'Castrado', EGUA: 'Égua',
  POTRANCA: 'Potranca', POTRO: 'Potro', POTRO_CASTRADO: 'Potro castrado',
};
const COAT_LABEL: Record<string, string> = {
  ALAZAO: 'Alazão', TORDILHO: 'Tordilho', RUAO: 'Ruão', BAYO: 'Baio',
  ZAINO: 'Zaino', ROSILHO: 'Rosilho', PAMPA: 'Pampa', MALHADO: 'Malhado',
  PRETO: 'Preto', BRANCO: 'Branco', ISABELA: 'Isabela', PALOMINO: 'Palomino', OTHER: 'Outro',
};
const PURPOSE_LABEL: Record<string, string> = {
  ESPORTE_HIPISMO: 'Hipismo', ESPORTE_VAQUEJADA: 'Vaquejada', ESPORTE_LACO: 'Laço',
  ESPORTE_POLO: 'Polo', ESPORTE_ENDURO: 'Enduro', ESPORTE_CCE: 'CCE',
  ESPORTE_DRESSAGE: 'Dressage', REPRODUCAO: 'Reprodução', TRABALHO: 'Trabalho',
  LAZER: 'Lazer', EXPOSICAO: 'Exposição', CRIACAO: 'Criação',
};

function calcAge(birthDate: string | null, estimatedAge: number | null): string {
  if (birthDate) {
    const months = Math.floor((Date.now() - new Date(birthDate).getTime()) / (1000 * 60 * 60 * 24 * 30.44));
    if (months < 24) return `${months} meses`;
    return `${Math.floor(months / 12)} anos`;
  }
  if (estimatedAge) {
    return estimatedAge < 24 ? `${estimatedAge} meses` : `${Math.floor(estimatedAge / 12)} anos`;
  }
  return '—';
}

function dbToEquineData(row: any): EquineData {
  const reg = [row.reg_abqm, row.reg_abccm, row.reg_abpsi, row.reg_abccc, row.reg_other].find(Boolean) ?? '';
  const statusLabels: Record<string, string> = { healthy: 'Saúde em dia', attention: 'Atenção', urgent: 'Urgente', critical: 'Crítico' };
  return {
    id: row.id,
    name: row.name,
    nickname: row.nickname ?? undefined,
    breed: BREED_LABEL[row.breed] ?? row.breed,
    sex: SEX_LABEL[row.sex] ?? row.sex,
    coat: COAT_LABEL[row.coat] ?? row.coat,
    age: calcAge(row.birth_date, row.estimated_age),
    status: (row.health_status as EquineStatus) ?? 'healthy',
    statusLabel: statusLabels[row.health_status] ?? 'Saúde em dia',
    alertsCount: 0,
    purpose: (row.purpose ?? []).map((p: string) => PURPOSE_LABEL[p] ?? p),
    registration: reg,
    property: row.stable ?? '',
  };
}

function nameToColor(name: string): string {
  const palettes = ['hsl(168 60% 35%)', 'hsl(200 70% 40%)', 'hsl(250 60% 50%)', 'hsl(30 80% 45%)', 'hsl(330 65% 45%)', 'hsl(48 80% 38%)'];
  let h = 0;
  for (let i = 0; i < name.length; i++) h += name.charCodeAt(i);
  return palettes[h % palettes.length];
}

function statusCfg(status: EquineStatus) {
  switch (status) {
    case 'healthy': return { bg: 'hsl(142 71% 45% / 0.12)', text: 'hsl(142 71% 28%)', dot: 'hsl(142 71% 45%)' };
    case 'attention': return { bg: C.amberLight, text: C.amberText, dot: C.amber };
    case 'urgent': return { bg: 'hsl(340 82% 52% / 0.1)', text: 'hsl(340 82% 32%)', dot: 'hsl(340 82% 52%)' };
    case 'critical': return { bg: C.redLight, text: C.redText, dot: C.red };
  }
}

function PlusIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>;
}

function SearchIcon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>;
}

function ChevronRight() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>;
}

function AlertBell() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>;
}

type FilterKey = 'all' | 'healthy' | 'attention' | 'urgent' | 'critical';

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'Todos' },
  { key: 'healthy', label: 'Saúde em Dia' },
  { key: 'attention', label: 'Atenção' },
  { key: 'urgent', label: 'Urgente' },
  { key: 'critical', label: 'Crítico' },
];

export default function PlantelList() {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterKey>('all');
  const [equines, setEquines] = useState<EquineData[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from('equinos')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setEquines((data ?? []).map(dbToEquineData));
        setLoadingData(false);
      });
  }, []);

  const filtered = useMemo(() => {
    let list = equines;
    if (filter !== 'all') list = list.filter((e) => e.status === filter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((e) =>
        e.name.toLowerCase().includes(q) ||
        e.nickname?.toLowerCase().includes(q) ||
        e.breed.toLowerCase().includes(q)
      );
    }
    return list;
  }, [search, filter, equines]);

  const counts = useMemo(() => ({
    all: equines.length,
    healthy: equines.filter(e => e.status === 'healthy').length,
    attention: equines.filter(e => e.status === 'attention').length,
    urgent: equines.filter(e => e.status === 'urgent').length,
    critical: equines.filter(e => e.status === 'critical').length,
  }), [equines]);

  return (
    <div>
      <style>{`
        .plantel-card { display: flex; align-items: center; gap: 16px; padding: 14px 16px; border-radius: 14px; border: 1px solid ${C.border}; background: ${C.card}; text-decoration: none; color: inherit; transition: all 0.18s; cursor: pointer; }
        .plantel-card:hover { border-color: hsl(168 83% 29% / 0.35); background: hsl(var(--muted) / 0.4); box-shadow: 0 4px 16px hsl(0 0% 0% / 0.05); transform: translateY(-1px); }
        .plantel-card:hover .card-arrow { opacity: 1; }
        .card-arrow { opacity: 0; transition: opacity 0.18s; }
        .filter-btn { padding: 6px 14px; border-radius: 999px; font-size: 12px; font-weight: 600; border: 1px solid transparent; cursor: pointer; transition: all 0.15s; white-space: nowrap; }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.5rem', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 800, color: C.fg, letterSpacing: '-0.02em' }}>Plantel</h1>
          <p style={{ fontSize: '0.8125rem', color: C.muted, marginTop: 2 }}>
            {loadingData ? 'Carregando…' : `${counts.all} equinos cadastrados · ${counts.critical + counts.urgent} requerem atenção`}
          </p>
        </div>
        <a
          href="/dashboard/plantel/novo"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '0.5625rem 1rem', borderRadius: '0.75rem', background: C.green, color: '#fff', fontWeight: 600, fontSize: '0.875rem', textDecoration: 'none', flexShrink: 0, transition: 'background 0.15s' }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'hsl(168 83% 24%)'}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = C.green}
        >
          <PlusIcon />
          Novo Equino
        </a>
      </div>

      {/* Summary pills */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: '1.25rem' }}>
        {[
          { label: 'Total', value: counts.all, color: C.fg, bg: 'hsl(var(--muted))' },
          { label: 'Saudáveis', value: counts.healthy, color: 'hsl(142 71% 28%)', bg: 'hsl(142 71% 45% / 0.12)' },
          { label: 'Atenção', value: counts.attention, color: C.amberText, bg: C.amberLight },
          { label: 'Urgente', value: counts.urgent, color: 'hsl(340 82% 32%)', bg: 'hsl(340 82% 52% / 0.1)' },
          { label: 'Crítico', value: counts.critical, color: C.redText, bg: C.redLight },
        ].map((p) => (
          <span key={p.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 12px', borderRadius: 999, background: p.bg, fontSize: '0.75rem', fontWeight: 700 }}>
            <span style={{ color: p.color }}>{p.value}</span>
            <span style={{ color: C.muted, fontWeight: 500 }}>{p.label}</span>
          </span>
        ))}
      </div>

      {/* Search + filters */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: '1.25rem' }}>
        {/* Search */}
        <div style={{ position: 'relative', maxWidth: 360 }}>
          <div style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: C.muted }}>
            <SearchIcon />
          </div>
          <input
            type="search"
            placeholder="Buscar por nome ou raça…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: '100%', padding: '0.5625rem 0.875rem 0.5625rem 2.25rem', borderRadius: '0.75rem', border: `1px solid ${C.border}`, background: C.bg, color: C.fg, fontSize: '0.875rem', outline: 'none', boxSizing: 'border-box' }}
          />
        </div>

        {/* Filter tabs */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {FILTERS.map((f) => (
            <button
              key={f.key}
              className="filter-btn"
              onClick={() => setFilter(f.key)}
              style={{
                background: filter === f.key ? C.green : 'transparent',
                color: filter === f.key ? '#fff' : C.muted,
                borderColor: filter === f.key ? C.green : C.border,
              }}
            >
              {f.label}
              {f.key !== 'all' && counts[f.key] > 0 && (
                <span style={{ marginLeft: 5, background: filter === f.key ? 'hsl(168 83% 20% / 0.4)' : 'hsl(var(--muted))', padding: '1px 6px', borderRadius: 999, fontSize: 10 }}>
                  {counts[f.key]}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Equine list */}
      {loadingData ? (
        <div style={{ textAlign: 'center', padding: '3rem 1rem', color: C.muted }}>
          <p style={{ fontSize: '0.875rem' }}>Carregando equinos…</p>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem 1rem', color: C.muted }}>
          <p style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>🐴</p>
          <p style={{ fontWeight: 600, color: C.fg, marginBottom: '0.25rem' }}>Nenhum equino encontrado</p>
          <p style={{ fontSize: '0.875rem' }}>Tente ajustar os filtros ou a busca</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map((equine) => {
            const sc = statusCfg(equine.status);
            const initials = equine.name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase();
            return (
              <a key={equine.id} href={`/dashboard/equino/${equine.id}`} className="plantel-card">
                {/* Avatar */}
                <div style={{ width: 48, height: 48, borderRadius: '0.75rem', background: nameToColor(equine.name), display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: '0.875rem', flexShrink: 0 }}>
                  {initials}
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <p style={{ fontSize: '0.9rem', fontWeight: 700, color: C.fg, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {equine.name}
                    </p>
                    {equine.nickname && equine.nickname !== equine.name.split(' ')[0] && (
                      <span style={{ fontSize: '0.75rem', color: C.muted, fontStyle: 'italic' }}>"{equine.nickname}"</span>
                    )}
                  </div>
                  <p style={{ fontSize: '0.75rem', color: C.muted, marginTop: 2 }}>
                    {equine.breed} · {equine.sex} · {equine.coat} · {equine.age}
                  </p>
                  <p style={{ fontSize: '0.6875rem', color: C.muted, marginTop: 1 }}>
                    {equine.registration} · {equine.property}
                  </p>
                </div>

                {/* Purpose badges */}
                <div style={{ display: 'flex', gap: 4, flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end', maxWidth: 160 }}>
                  {equine.purpose.slice(0, 2).map((p) => (
                    <span key={p} style={{ fontSize: '0.6875rem', fontWeight: 600, padding: '2px 8px', borderRadius: 999, background: C.greenLight, color: C.green }}>
                      {p}
                    </span>
                  ))}
                </div>

                {/* Status + alerts */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: '0.6875rem', fontWeight: 700, padding: '3px 10px', borderRadius: 999, background: sc.bg, color: sc.text, whiteSpace: 'nowrap', letterSpacing: '0.04em' }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: sc.dot, flexShrink: 0 }} />
                    {equine.statusLabel.toUpperCase()}
                  </span>
                  {equine.alertsCount > 0 && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.6875rem', color: C.muted }}>
                      <AlertBell /> {equine.alertsCount} alerta{equine.alertsCount > 1 ? 's' : ''}
                    </span>
                  )}
                </div>

                <span className="card-arrow" style={{ color: C.muted, flexShrink: 0 }}>
                  <ChevronRight />
                </span>
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}
