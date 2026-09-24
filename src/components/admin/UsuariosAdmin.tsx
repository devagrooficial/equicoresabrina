import { useState, useMemo, useEffect } from 'react';
import { createClient } from '../../lib/supabase';

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

type Plan = 'free' | 'starter' | 'pro' | 'haras';
type UserStatus = 'ACTIVE' | 'SUSPENDED';

interface User {
  id: string; name: string; email: string; phone: string;
  plan: Plan; status: UserStatus; equines: number;
  joined: string; state: string;
}

const PLAN_LABEL: Record<Plan, string> = { free: 'Gratuito', starter: 'Starter', pro: 'Pro', haras: 'Haras' };

const planCfg: Record<Plan, { bg: string; text: string }> = {
  free: { bg: 'hsl(var(--muted))', text: C.muted },
  starter: { bg: C.blueLight, text: C.blueText },
  pro: { bg: C.greenLight, text: C.green },
  haras: { bg: C.purpleLight, text: C.purpleText },
};

const statusCfg: Record<UserStatus, { label: string; bg: string; text: string; dot: string }> = {
  ACTIVE: { label: 'Ativo', bg: 'hsl(142 71% 45% / 0.12)', text: 'hsl(142 71% 28%)', dot: 'hsl(142 71% 45%)' },
  SUSPENDED: { label: 'Suspenso', bg: C.amberLight, text: C.amberText, dot: C.amber },
};

function nameToColor(name: string) {
  const p = ['hsl(168 60% 35%)', 'hsl(200 70% 40%)', 'hsl(250 60% 50%)', 'hsl(30 80% 45%)', 'hsl(330 65% 45%)'];
  let h = 0; for (const c of name) h += c.charCodeAt(0);
  return p[h % p.length];
}

function formatDate(iso: string) {
  return iso ? new Date(iso).toLocaleDateString('pt-BR') : '—';
}

type FilterStatus = 'all' | UserStatus;
type FilterPlan = 'all' | Plan;

interface DetailModal {
  user: User | null;
}

export default function UsuariosAdmin() {
  const supabase = createClient();
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [filterPlan, setFilterPlan] = useState<FilterPlan>('all');
  const [detail, setDetail] = useState<DetailModal>({ user: null });
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const PER_PAGE = 8;

  useEffect(() => {
    async function load() {
      const [{ data: profiles }, { data: equinos }] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, full_name, email, phone, plan, suspended, farm_state, created_at')
          .eq('role', 'dono')
          .order('created_at', { ascending: false }),
        supabase.from('equinos').select('id, user_id'),
      ]);

      const countByUser = new Map<string, number>();
      for (const e of (equinos as any[]) ?? []) countByUser.set(e.user_id, (countByUser.get(e.user_id) ?? 0) + 1);

      setUsers(((profiles as any[]) ?? []).map(p => ({
        id: p.id,
        name: p.full_name ?? '—',
        email: p.email ?? '—',
        phone: p.phone ?? '—',
        plan: (p.plan as Plan) ?? 'free',
        status: p.suspended ? 'SUSPENDED' : 'ACTIVE',
        equines: countByUser.get(p.id) ?? 0,
        joined: p.created_at,
        state: p.farm_state ?? '—',
      })));
      setLoading(false);
    }
    load();
  }, []);

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

  async function toggleStatus(id: string) {
    const user = users.find(u => u.id === id);
    if (!user) return;
    const nextSuspended = user.status !== 'SUSPENDED';
    const { error } = await supabase.from('profiles').update({ suspended: nextSuspended }).eq('id', id);
    if (error) return;
    setUsers(prev => prev.map(u => u.id === id ? { ...u, status: nextSuspended ? 'SUSPENDED' : 'ACTIVE' } : u));
    setDetail(d => d.user?.id === id ? { user: { ...d.user, status: nextSuspended ? 'SUSPENDED' : 'ACTIVE' } } : d);
  }

  async function changePlan(id: string, plan: Plan) {
    const { error } = await supabase.from('profiles').update({ plan }).eq('id', id);
    if (error) return;
    setUsers(prev => prev.map(u => u.id === id ? { ...u, plan } : u));
    setDetail({ user: null });
  }

  const counts = { all: users.length, ACTIVE: users.filter(u => u.status === 'ACTIVE').length, SUSPENDED: users.filter(u => u.status === 'SUSPENDED').length };

  if (loading) return <p style={{ color: C.muted, fontSize: '0.875rem', padding: '2rem 0' }}>Carregando…</p>;

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
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.25rem', fontWeight: 800, color: C.fg, letterSpacing: '-0.02em' }}>Usuários</h1>
        <p style={{ fontSize: '0.8125rem', color: C.muted, marginTop: 2 }}>{counts.all} donos de haras · {counts.ACTIVE} ativos · {counts.SUSPENDED} suspensos</p>
      </div>

      {/* Summary pills */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: '1rem' }}>
        {[
          { key: 'all', label: 'Todos', count: counts.all },
          { key: 'ACTIVE', label: 'Ativos', count: counts.ACTIVE },
          { key: 'SUSPENDED', label: 'Suspensos', count: counts.SUSPENDED },
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
          <option value="free">Gratuito</option>
          <option value="starter">Starter</option>
          <option value="pro">Pro</option>
          <option value="haras">Haras</option>
        </select>
      </div>

      {/* Table */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: '1rem', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto', overflowY: 'hidden' }}>
          <table className="ut">
            <thead>
              <tr>
                <th>Usuário</th>
                <th>Plano</th>
                <th>Status</th>
                <th>Equinos</th>
                <th>Estado</th>
                <th>Cadastro</th>
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
                      <span style={{ fontSize: '0.6875rem', fontWeight: 700, padding: '2px 9px', borderRadius: 999, background: pc.bg, color: pc.text }}>{PLAN_LABEL[u.plan]}</span>
                    </td>
                    <td>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: '0.6875rem', fontWeight: 700, padding: '2px 9px', borderRadius: 999, background: sc.bg, color: sc.text }}>
                        <span style={{ width: 5, height: 5, borderRadius: '50%', background: sc.dot }} />{sc.label}
                      </span>
                    </td>
                    <td style={{ color: C.muted }}>{u.equines}</td>
                    <td style={{ color: C.muted }}>{u.state}</td>
                    <td style={{ color: C.muted, fontSize: '0.75rem' }}>{formatDate(u.joined)}</td>
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
                      { label: 'Plano', value: <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '2px 9px', borderRadius: 999, background: pc.bg, color: pc.text }}>{PLAN_LABEL[u.plan]}</span> },
                      { label: 'Status', value: <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '2px 9px', borderRadius: 999, background: sc.bg, color: sc.text }}>{sc.label}</span> },
                      { label: 'Equinos', value: u.equines },
                      { label: 'Estado', value: u.state },
                      { label: 'Cadastro', value: formatDate(u.joined) },
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

                  {/* Change plan */}
                  <div style={{ marginBottom: '1rem' }}>
                    <p style={{ fontSize: '0.8125rem', fontWeight: 600, color: C.fg, marginBottom: 4 }}>Alterar plano</p>
                    <p style={{ fontSize: '0.6875rem', color: C.muted, marginBottom: 8 }}>
                      Alteração manual — se este dono tiver assinatura Stripe ativa, o próximo evento de cobrança pode sobrescrever isto.
                    </p>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {(['free', 'starter', 'pro', 'haras'] as Plan[]).map(p => (
                        <button key={p} onClick={() => changePlan(u.id, p)} style={{ flex: 1, padding: '6px 4px', borderRadius: 8, fontSize: '0.6875rem', fontWeight: 700, border: `1.5px solid ${u.plan === p ? C.green : C.border}`, background: u.plan === p ? C.greenLight : 'transparent', color: u.plan === p ? C.green : C.muted, cursor: 'pointer' }}>{PLAN_LABEL[p]}</button>
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
