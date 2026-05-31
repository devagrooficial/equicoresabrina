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
  blue: 'hsl(217 91% 50%)',
  blueLight: 'hsl(217 91% 50% / 0.1)',
  blueText: 'hsl(217 91% 32%)',
  purple: 'hsl(270 70% 55%)',
  purpleLight: 'hsl(270 70% 55% / 0.1)',
  purpleText: 'hsl(270 70% 36%)',
};

type Plan = 'Gratuito' | 'Starter' | 'Pro' | 'Haras';
type UserStatus = 'ACTIVE' | 'SUSPENDED' | 'INACTIVE';

interface User {
  id: string; name: string; email: string; phone: string;
  plan: Plan; status: UserStatus; equines: number;
  joined: string; lastLogin: string; state: string;
  storageUsedMb: number;
}

const USERS: User[] = [
  { id: '1', name: 'Sabrina Santos', email: 'sabrina@harasantaclara.com', phone: '(65) 99123-4567', plan: 'Pro', status: 'ACTIVE', equines: 6, joined: '15/01/2026', lastLogin: 'Agora', state: 'MT', storageUsedMb: 3200 },
  { id: '2', name: 'Felipe Moraes', email: 'felipe@harasmorais.com', phone: '(64) 99876-5432', plan: 'Pro', status: 'ACTIVE', equines: 8, joined: '23/05/2026', lastLogin: '23/05/2026', state: 'GO', storageUsedMb: 5100 },
  { id: '3', name: 'Carla Duarte', email: 'carla.duarte@gmail.com', phone: '(11) 98765-4321', plan: 'Starter', status: 'ACTIVE', equines: 3, joined: '22/05/2026', lastLogin: '24/05/2026', state: 'SP', storageUsedMb: 890 },
  { id: '4', name: 'Rancho Bom Jesus Ltda.', email: 'admin@ranchobomjesus.com.br', phone: '(63) 99000-1234', plan: 'Haras', status: 'ACTIVE', equines: 34, joined: '21/05/2026', lastLogin: '23/05/2026', state: 'TO', storageUsedMb: 18400 },
  { id: '5', name: 'Pedro Cavalcante', email: 'pedro.cav@icloud.com', phone: '(85) 98888-7777', plan: 'Gratuito', status: 'ACTIVE', equines: 1, joined: '20/05/2026', lastLogin: '21/05/2026', state: 'CE', storageUsedMb: 120 },
  { id: '6', name: 'Ana Letícia Braga', email: 'analeticia@equidrome.com', phone: '(31) 97654-3210', plan: 'Pro', status: 'ACTIVE', equines: 12, joined: '20/05/2026', lastLogin: '24/05/2026', state: 'MG', storageUsedMb: 7800 },
  { id: '7', name: 'Haras Boa Esperança', email: 'contato@harasboaesperanca.com.br', phone: '(67) 99321-6547', plan: 'Haras', status: 'ACTIVE', equines: 48, joined: '03/04/2026', lastLogin: '24/05/2026', state: 'MS', storageUsedMb: 24500 },
  { id: '8', name: 'Roberto Figueiredo', email: 'r.figueiredo@hotmail.com', phone: '(82) 99111-2222', plan: 'Starter', status: 'SUSPENDED', equines: 4, joined: '14/03/2026', lastLogin: '10/04/2026', state: 'AL', storageUsedMb: 1200 },
  { id: '9', name: 'Marcela Vieira', email: 'marcela.vet@gmail.com', phone: '(48) 98765-1234', plan: 'Pro', status: 'ACTIVE', equines: 9, joined: '27/02/2026', lastLogin: '22/05/2026', state: 'SC', storageUsedMb: 4300 },
  { id: '10', name: 'Granja Santo Antônio', email: 'gsa@granjaantonio.com.br', phone: '(44) 99456-7890', plan: 'Haras', status: 'ACTIVE', equines: 27, joined: '10/01/2026', lastLogin: '23/05/2026', state: 'PR', storageUsedMb: 15600 },
  { id: '11', name: 'Tiago Esperança', email: 'tiago.esp@yahoo.com', phone: '(75) 98000-4321', plan: 'Gratuito', status: 'INACTIVE', equines: 0, joined: '05/01/2026', lastLogin: '06/01/2026', state: 'BA', storageUsedMb: 0 },
  { id: '12', name: 'Juliana Resende', email: 'ju.resende@uol.com.br', phone: '(34) 99678-0123', plan: 'Starter', status: 'ACTIVE', equines: 2, joined: '18/12/2025', lastLogin: '24/05/2026', state: 'MG', storageUsedMb: 450 },
];

const planCfg: Record<Plan, { bg: string; text: string }> = {
  Gratuito: { bg: 'hsl(var(--muted))', text: C.muted },
  Starter: { bg: C.blueLight, text: C.blueText },
  Pro: { bg: C.greenLight, text: C.green },
  Haras: { bg: C.purpleLight, text: C.purpleText },
};

const statusCfg: Record<UserStatus, { label: string; bg: string; text: string; dot: string }> = {
  ACTIVE: { label: 'Ativo', bg: 'hsl(142 71% 45% / 0.12)', text: 'hsl(142 71% 28%)', dot: 'hsl(142 71% 45%)' },
  SUSPENDED: { label: 'Suspenso', bg: C.amberLight, text: C.amberText, dot: C.amber },
  INACTIVE: { label: 'Inativo', bg: 'hsl(var(--muted))', text: C.muted, dot: C.muted },
};

function nameToColor(name: string) {
  const p = ['hsl(168 60% 35%)', 'hsl(200 70% 40%)', 'hsl(250 60% 50%)', 'hsl(30 80% 45%)', 'hsl(330 65% 45%)'];
  let h = 0; for (const c of name) h += c.charCodeAt(0);
  return p[h % p.length];
}

type FilterStatus = 'all' | UserStatus;
type FilterPlan = 'all' | Plan;

interface DetailModal {
  user: User | null;
}

export default function UsuariosAdmin() {
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [filterPlan, setFilterPlan] = useState<FilterPlan>('all');
  const [detail, setDetail] = useState<DetailModal>({ user: null });
  const [users, setUsers] = useState(USERS);
  const [page, setPage] = useState(1);
  const PER_PAGE = 8;

  const filtered = useMemo(() => {
    let list = users;
    if (filterStatus !== 'all') list = list.filter(u => u.status === filterStatus);
    if (filterPlan !== 'all') list = list.filter(u => u.plan === filterPlan);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(u => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
    }
    return list;
  }, [users, filterStatus, filterPlan, search]);

  const paginated = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const totalPages = Math.ceil(filtered.length / PER_PAGE);

  function toggleStatus(id: string) {
    setUsers(prev => prev.map(u => u.id === id ? { ...u, status: u.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE' } : u));
  }

  function changePlan(id: string, plan: Plan) {
    setUsers(prev => prev.map(u => u.id === id ? { ...u, plan } : u));
    setDetail({ user: null });
  }

  const counts = { all: users.length, ACTIVE: users.filter(u => u.status === 'ACTIVE').length, SUSPENDED: users.filter(u => u.status === 'SUSPENDED').length, INACTIVE: users.filter(u => u.status === 'INACTIVE').length };

  return (
    <div>
      <style>{`
        .ut { width: 100%; border-collapse: collapse; }
        .ut th { text-align: left; font-size: 0.6875rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: ${C.muted}; padding: 10px 12px; border-bottom: 1px solid ${C.border}; white-space: nowrap; }
        .ut td { padding: 11px 12px; border-bottom: 1px solid ${C.border}; font-size: 0.8125rem; vertical-align: middle; }
        .ut tr:last-child td { border-bottom: none; }
        .ut tbody tr:hover td { background: hsl(var(--muted) / 0.4); }
        .action-btn { padding: 4px 10px; border-radius: 6px; font-size: 0.75rem; font-weight: 600; border: none; cursor: pointer; transition: all 0.15s; }
        .filter-pill { padding: 5px 12px; border-radius: 999px; font-size: 0.75rem; font-weight: 600; border: 1px solid transparent; cursor: pointer; transition: all 0.15s; white-space: nowrap; }
        .overlay { position: fixed; inset: 0; background: hsl(0 0% 0% / 0.4); z-index: 50; display: flex; align-items: center; justify-content: center; padding: 1rem; }
        .modal { background: hsl(var(--card)); border: 1px solid ${C.border}; border-radius: 1.25rem; padding: 1.5rem; width: 100%; max-width: 480px; max-height: 90vh; overflow-y: auto; }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.5rem', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 800, color: C.fg, letterSpacing: '-0.02em' }}>Usuários</h1>
          <p style={{ fontSize: '0.8125rem', color: C.muted, marginTop: 2 }}>{counts.all} usuários · {counts.ACTIVE} ativos · {counts.SUSPENDED} suspensos</p>
        </div>
        <button style={{ padding: '0.5625rem 1.125rem', borderRadius: '0.75rem', background: C.green, color: '#fff', fontWeight: 600, fontSize: '0.875rem', border: 'none', cursor: 'pointer' }}>
          + Convidar usuário
        </button>
      </div>

      {/* Summary pills */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: '1rem' }}>
        {[
          { key: 'all', label: 'Todos', count: counts.all },
          { key: 'ACTIVE', label: 'Ativos', count: counts.ACTIVE },
          { key: 'SUSPENDED', label: 'Suspensos', count: counts.SUSPENDED },
          { key: 'INACTIVE', label: 'Inativos', count: counts.INACTIVE },
        ].map(f => (
          <button key={f.key} className="filter-pill" onClick={() => { setFilterStatus(f.key as FilterStatus); setPage(1); }}
            style={{ background: filterStatus === f.key ? C.green : 'transparent', color: filterStatus === f.key ? '#fff' : C.muted, borderColor: filterStatus === f.key ? C.green : C.border }}>
            {f.label} <span style={{ marginLeft: 4, opacity: 0.8 }}>{f.count}</span>
          </button>
        ))}
      </div>

      {/* Search + plan filter */}
      <div style={{ display: 'flex', gap: 10, marginBottom: '1rem', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <div style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: C.muted }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
          </div>
          <input type="search" placeholder="Buscar por nome ou e-mail…" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            style={{ width: '100%', padding: '0.5rem 0.875rem 0.5rem 2.25rem', borderRadius: '0.625rem', border: `1px solid ${C.border}`, background: C.bg, color: C.fg, fontSize: '0.875rem', outline: 'none', boxSizing: 'border-box' }} />
        </div>
        <select value={filterPlan} onChange={e => { setFilterPlan(e.target.value as FilterPlan); setPage(1); }}
          style={{ padding: '0.5rem 0.875rem', borderRadius: '0.625rem', border: `1px solid ${C.border}`, background: C.bg, color: C.fg, fontSize: '0.875rem', cursor: 'pointer' }}>
          <option value="all">Todos os planos</option>
          <option value="Gratuito">Gratuito</option>
          <option value="Starter">Starter</option>
          <option value="Pro">Pro</option>
          <option value="Haras">Haras</option>
        </select>
      </div>

      {/* Table */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: '1rem', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="ut">
            <thead>
              <tr>
                <th>Usuário</th>
                <th>Plano</th>
                <th>Status</th>
                <th>Equinos</th>
                <th>Estado</th>
                <th>Último acesso</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: C.muted }}>Nenhum usuário encontrado</td></tr>
              ) : paginated.map((u) => {
                const pc = planCfg[u.plan];
                const sc = statusCfg[u.status];
                const initials = u.name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
                return (
                  <tr key={u.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 32, height: 32, borderRadius: '50%', background: nameToColor(u.name), display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '0.6875rem', fontWeight: 800, flexShrink: 0 }}>{initials}</div>
                        <div>
                          <p style={{ fontWeight: 600, color: C.fg }}>{u.name}</p>
                          <p style={{ fontSize: '0.6875rem', color: C.muted }}>{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.6875rem', fontWeight: 700, padding: '2px 9px', borderRadius: 999, background: pc.bg, color: pc.text }}>{u.plan}</span>
                    </td>
                    <td>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: '0.6875rem', fontWeight: 700, padding: '2px 9px', borderRadius: 999, background: sc.bg, color: sc.text }}>
                        <span style={{ width: 5, height: 5, borderRadius: '50%', background: sc.dot }} />{sc.label}
                      </span>
                    </td>
                    <td style={{ color: C.muted }}>{u.equines}</td>
                    <td style={{ color: C.muted }}>{u.state}</td>
                    <td style={{ color: C.muted, fontSize: '0.75rem' }}>{u.lastLogin}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="action-btn" onClick={() => setDetail({ user: u })} style={{ background: C.greenLight, color: C.green }}>Ver</button>
                        <button className="action-btn" onClick={() => toggleStatus(u.id)} style={{ background: u.status === 'ACTIVE' ? C.amberLight : 'hsl(142 71% 45% / 0.12)', color: u.status === 'ACTIVE' ? C.amberText : 'hsl(142 71% 28%)' }}>
                          {u.status === 'ACTIVE' ? 'Suspender' : 'Ativar'}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.875rem 1.25rem', borderTop: `1px solid ${C.border}` }}>
            <p style={{ fontSize: '0.8125rem', color: C.muted }}>
              {Math.min((page - 1) * PER_PAGE + 1, filtered.length)}–{Math.min(page * PER_PAGE, filtered.length)} de {filtered.length} usuários
            </p>
            <div style={{ display: 'flex', gap: 4 }}>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                style={{ padding: '5px 12px', borderRadius: 6, background: C.muted_bg, color: page === 1 ? C.muted : C.fg, border: 'none', cursor: page === 1 ? 'not-allowed' : 'pointer', fontSize: '0.8125rem', fontWeight: 600 }}>← Ant.</button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                <button key={p} onClick={() => setPage(p)} style={{ padding: '5px 10px', borderRadius: 6, background: page === p ? C.green : C.muted_bg, color: page === p ? '#fff' : C.fg, border: 'none', cursor: 'pointer', fontSize: '0.8125rem', fontWeight: 600 }}>{p}</button>
              ))}
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                style={{ padding: '5px 12px', borderRadius: 6, background: C.muted_bg, color: page === totalPages ? C.muted : C.fg, border: 'none', cursor: page === totalPages ? 'not-allowed' : 'pointer', fontSize: '0.8125rem', fontWeight: 600 }}>Próx. →</button>
            </div>
          </div>
        )}
      </div>

      {/* User detail modal */}
      {detail.user && (
        <div className="overlay" onClick={() => setDetail({ user: null })}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <h2 style={{ fontSize: '1.125rem', fontWeight: 800, color: C.fg }}>Detalhes do Usuário</h2>
              <button onClick={() => setDetail({ user: null })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted, fontSize: '1.25rem' }}>×</button>
            </div>

            {(() => {
              const u = detail.user!;
              const pc = planCfg[u.plan];
              const sc = statusCfg[u.status];
              const storagePct = ((u.plan === 'Gratuito' ? 500 : u.plan === 'Starter' ? 2048 : u.plan === 'Pro' ? 10240 : 30720) > 0)
                ? (u.storageUsedMb / (u.plan === 'Gratuito' ? 500 : u.plan === 'Starter' ? 2048 : u.plan === 'Pro' ? 10240 : 30720)) * 100
                : 0;
              return (
                <>
                  <div style={{ display: 'flex', gap: 14, marginBottom: '1.25rem' }}>
                    <div style={{ width: 56, height: 56, borderRadius: '50%', background: nameToColor(u.name), display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '1rem', fontWeight: 800, flexShrink: 0 }}>
                      {u.name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()}
                    </div>
                    <div>
                      <p style={{ fontSize: '1.125rem', fontWeight: 800, color: C.fg }}>{u.name}</p>
                      <p style={{ fontSize: '0.8125rem', color: C.muted }}>{u.email}</p>
                      <p style={{ fontSize: '0.8125rem', color: C.muted }}>{u.phone}</p>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.25rem' }}>
                    {[
                      { label: 'Plano', value: <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '2px 9px', borderRadius: 999, background: pc.bg, color: pc.text }}>{u.plan}</span> },
                      { label: 'Status', value: <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '2px 9px', borderRadius: 999, background: sc.bg, color: sc.text }}>{sc.label}</span> },
                      { label: 'Equinos', value: u.equines },
                      { label: 'Estado', value: u.state },
                      { label: 'Cadastro', value: u.joined },
                      { label: 'Último acesso', value: u.lastLogin },
                    ].map(row => (
                      <div key={row.label} style={{ padding: '0.625rem', borderRadius: '0.625rem', background: C.muted_bg }}>
                        <p style={{ fontSize: '0.6875rem', color: C.muted, fontWeight: 600, marginBottom: 4 }}>{row.label}</p>
                        {typeof row.value === 'string' || typeof row.value === 'number'
                          ? <p style={{ fontSize: '0.875rem', fontWeight: 700, color: C.fg }}>{row.value}</p>
                          : row.value
                        }
                      </div>
                    ))}
                  </div>

                  {/* Storage */}
                  <div style={{ marginBottom: '1.25rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <p style={{ fontSize: '0.8125rem', fontWeight: 600, color: C.fg }}>Armazenamento</p>
                      <p style={{ fontSize: '0.75rem', color: C.muted }}>{(u.storageUsedMb / 1024).toFixed(1)} GB usado</p>
                    </div>
                    <div style={{ height: 6, borderRadius: 999, background: C.muted_bg, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${Math.min(storagePct, 100)}%`, background: storagePct > 80 ? C.amber : C.green, borderRadius: 999 }} />
                    </div>
                  </div>

                  {/* Change plan */}
                  <div style={{ marginBottom: '1rem' }}>
                    <p style={{ fontSize: '0.8125rem', fontWeight: 600, color: C.fg, marginBottom: 8 }}>Alterar plano</p>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {(['Gratuito', 'Starter', 'Pro', 'Haras'] as Plan[]).map(p => (
                        <button key={p} onClick={() => changePlan(u.id, p)} style={{ flex: 1, padding: '6px 4px', borderRadius: 8, fontSize: '0.6875rem', fontWeight: 700, border: `1.5px solid ${u.plan === p ? C.green : C.border}`, background: u.plan === p ? C.greenLight : 'transparent', color: u.plan === p ? C.green : C.muted, cursor: 'pointer' }}>{p}</button>
                      ))}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => toggleStatus(u.id)} style={{ flex: 1, padding: '0.625rem', borderRadius: '0.625rem', background: u.status === 'ACTIVE' ? C.amberLight : 'hsl(142 71% 45% / 0.12)', color: u.status === 'ACTIVE' ? C.amberText : 'hsl(142 71% 28%)', fontWeight: 600, fontSize: '0.875rem', border: 'none', cursor: 'pointer' }}>
                      {u.status === 'ACTIVE' ? 'Suspender conta' : 'Reativar conta'}
                    </button>
                    <button onClick={() => setDetail({ user: null })} style={{ flex: 1, padding: '0.625rem', borderRadius: '0.625rem', background: C.muted_bg, color: C.fg, fontWeight: 600, fontSize: '0.875rem', border: 'none', cursor: 'pointer' }}>Fechar</button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
