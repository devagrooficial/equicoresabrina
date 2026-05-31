import { useState, useMemo } from 'react';

const C = {
  green: 'hsl(168 83% 29%)',
  greenLight: 'hsl(168 83% 29% / 0.1)',
  fg: 'hsl(var(--foreground))',
  muted: 'hsl(var(--muted-foreground))',
  card: 'hsl(var(--card))',
  border: 'hsl(var(--border))',
  bg: 'hsl(var(--background))',
  muted_bg: 'hsl(var(--muted))',
  amber: 'hsl(38 92% 50%)',
  amberText: 'hsl(38 92% 28%)',
  amberLight: 'hsl(38 92% 50% / 0.1)',
  red: 'hsl(0 84.2% 55%)',
  redText: 'hsl(0 84.2% 38%)',
  redLight: 'hsl(0 84.2% 55% / 0.08)',
};

interface EquineRow {
  id: string; name: string; owner: string; ownerEmail: string;
  breed: string; sex: string; age: string;
  status: 'ACTIVE' | 'SOLD' | 'DECEASED';
  healthStatus: 'healthy' | 'attention' | 'urgent' | 'critical';
  alerts: number; state: string; created: string;
}

const EQUINES: EquineRow[] = [
  { id: '1', name: 'Trovão do Sul', owner: 'Sabrina Santos', ownerEmail: 'sabrina@harasantaclara.com', breed: 'Quarto de Milha', sex: 'Garanhão', age: '7 anos', status: 'ACTIVE', healthStatus: 'attention', alerts: 2, state: 'MT', created: '15/01/2026' },
  { id: '2', name: 'Serena da Serra', owner: 'Sabrina Santos', ownerEmail: 'sabrina@harasantaclara.com', breed: 'Mangalarga Marchador', sex: 'Égua', age: '5 anos', status: 'ACTIVE', healthStatus: 'urgent', alerts: 3, state: 'MT', created: '15/01/2026' },
  { id: '3', name: 'Duque Real', owner: 'Sabrina Santos', ownerEmail: 'sabrina@harasantaclara.com', breed: 'Puro Sangue Inglês', sex: 'Castrado', age: '9 anos', status: 'ACTIVE', healthStatus: 'critical', alerts: 1, state: 'MT', created: '15/01/2026' },
  { id: '4', name: 'Relâmpago Preto', owner: 'Felipe Moraes', ownerEmail: 'felipe@harasmorais.com', breed: 'Quarto de Milha', sex: 'Garanhão', age: '6 anos', status: 'ACTIVE', healthStatus: 'healthy', alerts: 0, state: 'GO', created: '23/05/2026' },
  { id: '5', name: 'Vento da Serra', owner: 'Felipe Moraes', ownerEmail: 'felipe@harasmorais.com', breed: 'Crioulo', sex: 'Castrado', age: '8 anos', status: 'ACTIVE', healthStatus: 'attention', alerts: 1, state: 'GO', created: '23/05/2026' },
  { id: '6', name: 'Estrela Dourada', owner: 'Carla Duarte', ownerEmail: 'carla.duarte@gmail.com', breed: 'Brasileiro de Hipismo', sex: 'Égua', age: '4 anos', status: 'ACTIVE', healthStatus: 'healthy', alerts: 0, state: 'SP', created: '22/05/2026' },
  { id: '7', name: 'Sultan do Norte', owner: 'Rancho Bom Jesus', ownerEmail: 'admin@ranchobomjesus.com.br', breed: 'Árabe', sex: 'Garanhão', age: '10 anos', status: 'ACTIVE', healthStatus: 'healthy', alerts: 0, state: 'TO', created: '21/05/2026' },
  { id: '8', name: 'Princesa das Gerais', owner: 'Ana Letícia Braga', ownerEmail: 'analeticia@equidrome.com', breed: 'Lusitano', sex: 'Égua', age: '6 anos', status: 'ACTIVE', healthStatus: 'attention', alerts: 1, state: 'MG', created: '20/05/2026' },
  { id: '9', name: 'Furacão Baio', owner: 'Granja Santo Antônio', ownerEmail: 'gsa@granjaantonio.com.br', breed: 'Quarto de Milha', sex: 'Garanhão', age: '5 anos', status: 'ACTIVE', healthStatus: 'critical', alerts: 2, state: 'PR', created: '10/01/2026' },
  { id: '10', name: 'Noturno Árabe', owner: 'Haras Boa Esperança', ownerEmail: 'contato@harasboaesperanca.com.br', breed: 'Árabe', sex: 'Garanhão', age: '12 anos', status: 'ACTIVE', healthStatus: 'healthy', alerts: 0, state: 'MS', created: '03/04/2026' },
  { id: '11', name: 'Rosa Campolina', owner: 'Marcela Vieira', ownerEmail: 'marcela.vet@gmail.com', breed: 'Campolina', sex: 'Égua', age: '7 anos', status: 'SOLD', healthStatus: 'healthy', alerts: 0, state: 'SC', created: '27/02/2026' },
  { id: '12', name: 'Trovador Real', owner: 'Juliana Resende', ownerEmail: 'ju.resende@uol.com.br', breed: 'Mangalarga Marchador', sex: 'Garanhão', age: '3 anos', status: 'ACTIVE', healthStatus: 'urgent', alerts: 2, state: 'MG', created: '18/12/2025' },
];

const healthCfg = {
  healthy: { label: 'Saúde em Dia', bg: 'hsl(142 71% 45% / 0.12)', text: 'hsl(142 71% 28%)', dot: 'hsl(142 71% 45%)' },
  attention: { bg: C.amberLight, text: C.amberText, dot: C.amber, label: 'Atenção' },
  urgent: { bg: 'hsl(340 82% 52% / 0.1)', text: 'hsl(340 82% 32%)', dot: 'hsl(340 82% 52%)', label: 'Urgente' },
  critical: { bg: C.redLight, text: C.redText, dot: C.red, label: 'Crítico' },
};

const statusCfg = {
  ACTIVE: { label: 'Ativo', bg: 'hsl(142 71% 45% / 0.12)', text: 'hsl(142 71% 28%)' },
  SOLD: { label: 'Vendido', bg: C.amberLight, text: C.amberText },
  DECEASED: { label: 'Falecido', bg: 'hsl(var(--muted))', text: C.muted },
};

function nameToColor(name: string) {
  const p = ['hsl(168 60% 35%)', 'hsl(200 70% 40%)', 'hsl(250 60% 50%)', 'hsl(30 80% 45%)', 'hsl(330 65% 45%)', 'hsl(48 80% 38%)'];
  let h = 0; for (const c of name) h += c.charCodeAt(0);
  return p[h % p.length];
}

export default function EquinesAdmin() {
  const [search, setSearch] = useState('');
  const [filterHealth, setFilterHealth] = useState<'all' | 'healthy' | 'attention' | 'urgent' | 'critical'>('all');
  const [filterBreed, setFilterBreed] = useState('all');
  const [page, setPage] = useState(1);
  const PER_PAGE = 10;

  const breeds = ['all', ...Array.from(new Set(EQUINES.map(e => e.breed))).sort()];

  const filtered = useMemo(() => {
    let list = EQUINES;
    if (filterHealth !== 'all') list = list.filter(e => e.healthStatus === filterHealth);
    if (filterBreed !== 'all') list = list.filter(e => e.breed === filterBreed);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(e => e.name.toLowerCase().includes(q) || e.owner.toLowerCase().includes(q) || e.breed.toLowerCase().includes(q));
    }
    return list;
  }, [filterHealth, filterBreed, search]);

  const paginated = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const totalPages = Math.ceil(filtered.length / PER_PAGE);

  const counts = {
    all: EQUINES.length,
    healthy: EQUINES.filter(e => e.healthStatus === 'healthy').length,
    attention: EQUINES.filter(e => e.healthStatus === 'attention').length,
    urgent: EQUINES.filter(e => e.healthStatus === 'urgent').length,
    critical: EQUINES.filter(e => e.healthStatus === 'critical').length,
    totalAlerts: EQUINES.reduce((s, e) => s + e.alerts, 0),
  };

  return (
    <div>
      <style>{`
        .et { width: 100%; border-collapse: collapse; }
        .et th { text-align: left; font-size: 0.6875rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: ${C.muted}; padding: 10px 12px; border-bottom: 1px solid ${C.border}; white-space: nowrap; }
        .et td { padding: 11px 12px; border-bottom: 1px solid ${C.border}; font-size: 0.8125rem; vertical-align: middle; }
        .et tr:last-child td { border-bottom: none; }
        .et tbody tr:hover td { background: hsl(var(--muted) / 0.4); }
        .fp { padding: 5px 12px; border-radius: 999px; font-size: 0.75rem; font-weight: 600; border: 1px solid transparent; cursor: pointer; transition: all 0.15s; white-space: nowrap; }
      `}</style>

      {/* Header */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.25rem', fontWeight: 800, color: C.fg, letterSpacing: '-0.02em' }}>Equinos</h1>
        <p style={{ fontSize: '0.8125rem', color: C.muted, marginTop: 2 }}>
          {counts.all} equinos cadastrados · {counts.totalAlerts} alertas ativos
        </p>
      </div>

      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 10, marginBottom: '1.25rem' }}>
        {[
          { label: 'Total', value: counts.all, color: C.fg, bg: C.muted_bg },
          { label: 'Saudáveis', value: counts.healthy, color: 'hsl(142 71% 28%)', bg: 'hsl(142 71% 45% / 0.12)' },
          { label: 'Atenção', value: counts.attention, color: C.amberText, bg: C.amberLight },
          { label: 'Urgente', value: counts.urgent, color: 'hsl(340 82% 32%)', bg: 'hsl(340 82% 52% / 0.1)' },
          { label: 'Crítico', value: counts.critical, color: C.redText, bg: C.redLight },
        ].map(s => (
          <div key={s.label} style={{ padding: '0.875rem', borderRadius: '0.875rem', background: s.bg }}>
            <p style={{ fontSize: '1.4rem', fontWeight: 900, color: s.color }}>{s.value}</p>
            <p style={{ fontSize: '0.6875rem', fontWeight: 700, color: s.color, letterSpacing: '0.08em', textTransform: 'uppercase', opacity: 0.8, marginTop: 2 }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: '0.875rem', flexWrap: 'wrap' }}>
        {[
          { key: 'all', label: 'Todos' },
          { key: 'healthy', label: 'Saudáveis' },
          { key: 'attention', label: 'Atenção' },
          { key: 'urgent', label: 'Urgente' },
          { key: 'critical', label: 'Crítico' },
        ].map(f => (
          <button key={f.key} className="fp" onClick={() => { setFilterHealth(f.key as any); setPage(1); }}
            style={{ background: filterHealth === f.key ? C.green : 'transparent', color: filterHealth === f.key ? '#fff' : C.muted, borderColor: filterHealth === f.key ? C.green : C.border }}>
            {f.label}
          </button>
        ))}
      </div>

      {/* Search + breed filter */}
      <div style={{ display: 'flex', gap: 10, marginBottom: '1rem', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <div style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: C.muted }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
          </div>
          <input type="search" placeholder="Buscar por nome, proprietário ou raça…" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            style={{ width: '100%', padding: '0.5rem 0.875rem 0.5rem 2.25rem', borderRadius: '0.625rem', border: `1px solid ${C.border}`, background: C.bg, color: C.fg, fontSize: '0.875rem', outline: 'none', boxSizing: 'border-box' }} />
        </div>
        <select value={filterBreed} onChange={e => { setFilterBreed(e.target.value); setPage(1); }}
          style={{ padding: '0.5rem 0.875rem', borderRadius: '0.625rem', border: `1px solid ${C.border}`, background: C.bg, color: C.fg, fontSize: '0.875rem' }}>
          {breeds.map(b => <option key={b} value={b}>{b === 'all' ? 'Todas as raças' : b}</option>)}
        </select>
      </div>

      {/* Table */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: '1rem', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="et">
            <thead>
              <tr>
                <th>Equino</th>
                <th>Proprietário</th>
                <th>Raça / Sexo</th>
                <th>Saúde</th>
                <th>Status</th>
                <th>Alertas</th>
                <th>Estado</th>
                <th>Cadastrado</th>
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 ? (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: '2rem', color: C.muted }}>Nenhum equino encontrado</td></tr>
              ) : paginated.map(e => {
                const hc = healthCfg[e.healthStatus];
                const sc = statusCfg[e.status];
                const initials = e.name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
                return (
                  <tr key={e.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 32, height: 32, borderRadius: '0.625rem', background: nameToColor(e.name), display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '0.6875rem', fontWeight: 800, flexShrink: 0 }}>{initials}</div>
                        <div>
                          <p style={{ fontWeight: 600, color: C.fg }}>{e.name}</p>
                          <p style={{ fontSize: '0.6875rem', color: C.muted }}>{e.age}</p>
                        </div>
                      </div>
                    </td>
                    <td>
                      <p style={{ color: C.fg, fontWeight: 500 }}>{e.owner}</p>
                      <p style={{ fontSize: '0.6875rem', color: C.muted }}>{e.ownerEmail}</p>
                    </td>
                    <td style={{ color: C.muted }}>
                      <p style={{ color: C.fg }}>{e.breed}</p>
                      <p style={{ fontSize: '0.6875rem' }}>{e.sex}</p>
                    </td>
                    <td>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: '0.6875rem', fontWeight: 700, padding: '2px 9px', borderRadius: 999, background: hc.bg, color: hc.text, whiteSpace: 'nowrap' }}>
                        <span style={{ width: 5, height: 5, borderRadius: '50%', background: hc.dot }} />{hc.label}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.6875rem', fontWeight: 700, padding: '2px 9px', borderRadius: 999, background: sc.bg, color: sc.text }}>{sc.label}</span>
                    </td>
                    <td style={{ color: e.alerts > 0 ? C.redText : C.muted, fontWeight: e.alerts > 0 ? 700 : 400 }}>
                      {e.alerts > 0 ? `⚠ ${e.alerts}` : '—'}
                    </td>
                    <td style={{ color: C.muted }}>{e.state}</td>
                    <td style={{ color: C.muted, fontSize: '0.75rem' }}>{e.created}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.875rem 1.25rem', borderTop: `1px solid ${C.border}` }}>
            <p style={{ fontSize: '0.8125rem', color: C.muted }}>{Math.min((page - 1) * PER_PAGE + 1, filtered.length)}–{Math.min(page * PER_PAGE, filtered.length)} de {filtered.length}</p>
            <div style={{ display: 'flex', gap: 4 }}>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={{ padding: '5px 12px', borderRadius: 6, background: C.muted_bg, color: page === 1 ? C.muted : C.fg, border: 'none', cursor: page === 1 ? 'not-allowed' : 'pointer', fontSize: '0.8125rem', fontWeight: 600 }}>← Ant.</button>
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map(p => (
                <button key={p} onClick={() => setPage(p)} style={{ padding: '5px 10px', borderRadius: 6, background: page === p ? C.green : C.muted_bg, color: page === p ? '#fff' : C.fg, border: 'none', cursor: 'pointer', fontSize: '0.8125rem', fontWeight: 600 }}>{p}</button>
              ))}
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={{ padding: '5px 12px', borderRadius: 6, background: C.muted_bg, color: page === totalPages ? C.muted : C.fg, border: 'none', cursor: page === totalPages ? 'not-allowed' : 'pointer', fontSize: '0.8125rem', fontWeight: 600 }}>Próx. →</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
