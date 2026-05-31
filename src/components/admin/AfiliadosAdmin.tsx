import { useState } from 'react';

const C = {
  green: 'hsl(168 83% 29%)',
  greenLight: 'hsl(168 83% 29% / 0.12)',
  fg: 'hsl(var(--foreground))',
  muted: 'hsl(var(--muted-foreground))',
  border: 'hsl(var(--border))',
  card: 'hsl(var(--card))',
  bg: 'hsl(var(--background))',
};

function Svg({ d, size = 16 }: { d: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: d }} />
  );
}

const STATUS_COLORS: Record<string, { bg: string; color: string; label: string }> = {
  ACTIVE: { bg: 'hsl(168 83% 29% / 0.12)', color: 'hsl(168 83% 29%)', label: 'Ativo' },
  INACTIVE: { bg: 'hsl(var(--muted))', color: 'hsl(var(--muted-foreground))', label: 'Inativo' },
  SUSPENDED: { bg: 'hsl(0 84% 60% / 0.12)', color: 'hsl(0 84% 55%)', label: 'Suspenso' },
};

const WITHDRAWAL_STATUS: Record<string, { bg: string; color: string; label: string }> = {
  PENDING: { bg: 'hsl(38 92% 50% / 0.12)', color: 'hsl(38 92% 40%)', label: 'Pendente' },
  APPROVED: { bg: 'hsl(168 83% 29% / 0.12)', color: 'hsl(168 83% 29%)', label: 'Aprovado' },
  REJECTED: { bg: 'hsl(0 84% 60% / 0.12)', color: 'hsl(0 84% 55%)', label: 'Rejeitado' },
};

const MOCK_AFFILIATES = [
  { id: 1, name: 'Rodrigo Cavalcante', email: 'rodrigo@example.com', code: 'ROD2024', status: 'ACTIVE', referrals: 47, converted: 31, earned: 4650, pending: 890, commission: 15, joined: '2024-08-12' },
  { id: 2, name: 'Fernanda Melo', email: 'fernanda@example.com', code: 'FER2024', status: 'ACTIVE', referrals: 38, converted: 24, earned: 3120, pending: 640, commission: 15, joined: '2024-09-03' },
  { id: 3, name: 'Carlos Drummond', email: 'carlos@example.com', code: 'CAR2024', status: 'ACTIVE', referrals: 29, converted: 18, earned: 2340, pending: 0, commission: 15, joined: '2024-10-15' },
  { id: 4, name: 'Patrícia Vieira', email: 'patricia@example.com', code: 'PAT2024', status: 'ACTIVE', referrals: 22, converted: 15, earned: 1950, pending: 450, commission: 15, joined: '2024-11-02' },
  { id: 5, name: 'Marcos Teixeira', email: 'marcos@example.com', code: 'MAR2024', status: 'INACTIVE', referrals: 8, converted: 4, earned: 520, pending: 0, commission: 15, joined: '2024-07-20' },
  { id: 6, name: 'Juliana Rocha', email: 'juliana@example.com', code: 'JUL2025', status: 'ACTIVE', referrals: 15, converted: 10, earned: 1300, pending: 300, commission: 15, joined: '2025-01-08' },
  { id: 7, name: 'André Nascimento', email: 'andre@example.com', code: 'AND2025', status: 'SUSPENDED', referrals: 5, converted: 2, earned: 260, pending: 260, commission: 15, joined: '2025-02-14' },
  { id: 8, name: 'Beatriz Santos', email: 'beatriz@example.com', code: 'BEA2025', status: 'ACTIVE', referrals: 11, converted: 7, earned: 910, pending: 210, commission: 15, joined: '2025-03-01' },
];

const MOCK_WITHDRAWALS = [
  { id: 1, affiliate: 'Rodrigo Cavalcante', code: 'ROD2024', amount: 890, method: 'PIX', pixKey: 'rodrigo@example.com', status: 'PENDING', requestedAt: '2025-05-20' },
  { id: 2, affiliate: 'Fernanda Melo', code: 'FER2024', amount: 640, method: 'TED', bank: 'Nubank / 260', agency: '0001', account: '12345678-9', status: 'PENDING', requestedAt: '2025-05-21' },
  { id: 3, affiliate: 'Patrícia Vieira', code: 'PAT2024', amount: 450, method: 'PIX', pixKey: '11987654321', status: 'PENDING', requestedAt: '2025-05-22' },
  { id: 4, affiliate: 'Juliana Rocha', code: 'JUL2025', amount: 300, method: 'PIX', pixKey: 'juliana@example.com', status: 'PENDING', requestedAt: '2025-05-23' },
  { id: 5, affiliate: 'Beatriz Santos', code: 'BEA2025', amount: 210, method: 'PIX', pixKey: '22988776655', status: 'PENDING', requestedAt: '2025-05-23' },
  { id: 6, affiliate: 'André Nascimento', code: 'AND2025', amount: 260, method: 'TED', bank: 'Bradesco / 237', agency: '1234', account: '00987654-3', status: 'PENDING', requestedAt: '2025-05-24' },
];

function Badge({ status, map }: { status: string; map: Record<string, { bg: string; color: string; label: string }> }) {
  const s = map[status] ?? { bg: 'hsl(var(--muted))', color: 'hsl(var(--muted-foreground))', label: status };
  return (
    <span style={{ background: s.bg, color: s.color, fontSize: '0.6875rem', fontWeight: 700, padding: '2px 8px', borderRadius: 99, whiteSpace: 'nowrap' }}>
      {s.label}
    </span>
  );
}

function brl(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
}

export default function AfiliadosAdmin() {
  const [tab, setTab] = useState<'affiliates' | 'withdrawals'>('affiliates');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [affiliates, setAffiliates] = useState(MOCK_AFFILIATES);
  const [withdrawals, setWithdrawals] = useState(MOCK_WITHDRAWALS);
  const [page, setPage] = useState(1);
  const [detailOpen, setDetailOpen] = useState<typeof MOCK_AFFILIATES[0] | null>(null);
  const [rejectOpen, setRejectOpen] = useState<typeof MOCK_WITHDRAWALS[0] | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const PER_PAGE = 8;

  const filtered = affiliates.filter(a => {
    const matchSearch = !search || a.name.toLowerCase().includes(search.toLowerCase()) || a.email.toLowerCase().includes(search.toLowerCase()) || a.code.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'ALL' || a.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const currentPage = Math.min(page, totalPages);
  const pageAffiliates = filtered.slice((currentPage - 1) * PER_PAGE, currentPage * PER_PAGE);

  const pendingWithdrawals = withdrawals.filter(w => w.status === 'PENDING');

  const totalEarned = affiliates.reduce((s, a) => s + a.earned, 0);
  const totalPending = affiliates.reduce((s, a) => s + a.pending, 0);
  const totalActive = affiliates.filter(a => a.status === 'ACTIVE').length;
  const totalConverted = affiliates.reduce((s, a) => s + a.converted, 0);

  function approveWithdrawal(id: number) {
    setWithdrawals(w => w.map(x => x.id === id ? { ...x, status: 'APPROVED' } : x));
  }

  function rejectWithdrawal(id: number, reason: string) {
    setWithdrawals(w => w.map(x => x.id === id ? { ...x, status: 'REJECTED' } : x));
    setRejectOpen(null);
    setRejectReason('');
  }

  function toggleStatus(id: number) {
    setAffiliates(a => a.map(x => {
      if (x.id !== id) return x;
      return { ...x, status: x.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE' };
    }));
  }

  const TABS = [
    { key: 'affiliates', label: 'Afiliados', count: affiliates.length },
    { key: 'withdrawals', label: 'Saques Pendentes', count: pendingWithdrawals.length, alert: pendingWithdrawals.length > 0 },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 800, color: C.fg }}>Afiliados</h1>
          <p style={{ fontSize: '0.8125rem', color: C.muted, marginTop: 2 }}>Gerenciar programa de afiliados e saques</p>
        </div>
        <button style={{ background: C.green, color: '#fff', border: 'none', borderRadius: 8, padding: '0.5rem 1rem', fontSize: '0.8125rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Svg d='<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>' size={14} />
          Exportar
        </button>
      </div>

      {/* KPI row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
        {[
          { label: 'Afiliados Ativos', value: totalActive, icon: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>' },
          { label: 'Total Convertidos', value: totalConverted, icon: '<polyline points="20 6 9 17 4 12"/>' },
          { label: 'Comissões Pagas', value: brl(totalEarned), icon: '<line x1="12" x2="12" y1="2" y2="22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>' },
          { label: 'Saques Pendentes', value: brl(totalPending), icon: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>', alert: totalPending > 0 },
        ].map(kpi => (
          <div key={kpi.label} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: kpi.alert ? 'hsl(38 92% 50% / 0.12)' : C.greenLight, display: 'flex', alignItems: 'center', justifyContent: 'center', color: kpi.alert ? 'hsl(38 92% 40%)' : C.green, flexShrink: 0 }}>
              <Svg d={kpi.icon} size={18} />
            </div>
            <div>
              <p style={{ fontSize: '0.6875rem', color: C.muted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{kpi.label}</p>
              <p style={{ fontSize: '1.125rem', fontWeight: 800, color: C.fg, marginTop: 2 }}>{kpi.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14 }}>
        <div style={{ display: 'flex', gap: 0, borderBottom: `1px solid ${C.border}`, padding: '0 1.25rem' }}>
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key as any)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.875rem 0.25rem', marginRight: '1.5rem', fontSize: '0.875rem', fontWeight: 700, color: tab === t.key ? C.green : C.muted, borderBottom: tab === t.key ? `2px solid ${C.green}` : '2px solid transparent', display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.15s' }}
            >
              {t.label}
              {t.count !== undefined && (
                <span style={{ fontSize: '0.625rem', fontWeight: 800, minWidth: 18, height: 18, borderRadius: 99, background: t.alert ? 'hsl(0 84% 55%)' : 'hsl(var(--muted))', color: t.alert ? '#fff' : C.muted, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px' }}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {tab === 'affiliates' && (
          <div>
            {/* Filters */}
            <div style={{ display: 'flex', gap: 10, padding: '1rem 1.25rem', borderBottom: `1px solid ${C.border}`, flexWrap: 'wrap' }}>
              <input
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
                placeholder="Buscar por nome, e-mail ou código..."
                style={{ flex: 1, minWidth: 200, border: `1px solid ${C.border}`, borderRadius: 8, padding: '0.5rem 0.75rem', fontSize: '0.8125rem', background: C.bg, color: C.fg, outline: 'none' }}
              />
              {(['ALL', 'ACTIVE', 'INACTIVE', 'SUSPENDED'] as const).map(s => (
                <button key={s} onClick={() => { setStatusFilter(s); setPage(1); }} style={{ padding: '0.4375rem 0.875rem', borderRadius: 99, border: `1px solid ${statusFilter === s ? C.green : C.border}`, background: statusFilter === s ? C.greenLight : 'transparent', color: statusFilter === s ? C.green : C.muted, fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer' }}>
                  {s === 'ALL' ? 'Todos' : STATUS_COLORS[s]?.label ?? s}
                </button>
              ))}
            </div>

            {/* Table */}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                    {['Afiliado', 'Código', 'Status', 'Indicações', 'Convertidos', 'Ganhos', 'Pendente', 'Comissão', 'Ações'].map(h => (
                      <th key={h} style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.6875rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: C.muted, whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pageAffiliates.map(a => (
                    <tr key={a.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                      <td style={{ padding: '0.875rem 1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg, hsl(168 83% 32%), hsl(168 83% 20%))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '0.625rem', fontWeight: 800, flexShrink: 0 }}>
                            {a.name.split(' ').map(n => n[0]).slice(0, 2).join('')}
                          </div>
                          <div>
                            <p style={{ fontWeight: 700, color: C.fg }}>{a.name}</p>
                            <p style={{ fontSize: '0.75rem', color: C.muted }}>{a.email}</p>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '0.875rem 1rem' }}>
                        <code style={{ fontSize: '0.75rem', fontWeight: 700, background: C.greenLight, color: C.green, padding: '2px 8px', borderRadius: 6 }}>{a.code}</code>
                      </td>
                      <td style={{ padding: '0.875rem 1rem' }}><Badge status={a.status} map={STATUS_COLORS} /></td>
                      <td style={{ padding: '0.875rem 1rem', fontWeight: 700, color: C.fg, textAlign: 'right' }}>{a.referrals}</td>
                      <td style={{ padding: '0.875rem 1rem', textAlign: 'right' }}>
                        <span style={{ fontWeight: 700, color: C.fg }}>{a.converted}</span>
                        <span style={{ color: C.muted, fontSize: '0.75rem' }}> / {a.referrals}</span>
                      </td>
                      <td style={{ padding: '0.875rem 1rem', fontWeight: 700, color: C.green, textAlign: 'right' }}>{brl(a.earned)}</td>
                      <td style={{ padding: '0.875rem 1rem', fontWeight: 700, color: a.pending > 0 ? 'hsl(38 92% 40%)' : C.muted, textAlign: 'right' }}>{brl(a.pending)}</td>
                      <td style={{ padding: '0.875rem 1rem', textAlign: 'right', color: C.muted }}>{a.commission}%</td>
                      <td style={{ padding: '0.875rem 1rem' }}>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                          <button onClick={() => setDetailOpen(a)} style={{ background: C.greenLight, color: C.green, border: 'none', borderRadius: 6, padding: '0.375rem 0.625rem', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}>Ver</button>
                          <button onClick={() => toggleStatus(a.id)} style={{ background: a.status === 'ACTIVE' ? 'hsl(0 84% 60% / 0.1)' : C.greenLight, color: a.status === 'ACTIVE' ? 'hsl(0 84% 55%)' : C.green, border: 'none', borderRadius: 6, padding: '0.375rem 0.625rem', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}>
                            {a.status === 'ACTIVE' ? 'Suspender' : 'Ativar'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.875rem 1.25rem', borderTop: `1px solid ${C.border}` }}>
                <p style={{ fontSize: '0.8125rem', color: C.muted }}>
                  {filtered.length} afiliado{filtered.length !== 1 ? 's' : ''} · Página {currentPage} de {totalPages}
                </p>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button disabled={currentPage <= 1} onClick={() => setPage(p => p - 1)} style={{ padding: '0.375rem 0.75rem', borderRadius: 6, border: `1px solid ${C.border}`, background: 'transparent', color: currentPage <= 1 ? C.muted : C.fg, cursor: currentPage <= 1 ? 'not-allowed' : 'pointer', fontSize: '0.8125rem' }}>Anterior</button>
                  <button disabled={currentPage >= totalPages} onClick={() => setPage(p => p + 1)} style={{ padding: '0.375rem 0.75rem', borderRadius: 6, border: `1px solid ${C.border}`, background: 'transparent', color: currentPage >= totalPages ? C.muted : C.fg, cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer', fontSize: '0.8125rem' }}>Próxima</button>
                </div>
              </div>
            )}
          </div>
        )}

        {tab === 'withdrawals' && (
          <div>
            {pendingWithdrawals.length === 0 ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: C.muted }}>
                <Svg d='<polyline points="20 6 9 17 4 12"/>' size={40} />
                <p style={{ marginTop: 12, fontWeight: 600 }}>Nenhum saque pendente</p>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                      {['Afiliado', 'Valor', 'Método', 'Dados Bancários', 'Status', 'Solicitado em', 'Ações'].map(h => (
                        <th key={h} style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.6875rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: C.muted, whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {withdrawals.map(w => (
                      <tr key={w.id} style={{ borderBottom: `1px solid ${C.border}`, opacity: w.status !== 'PENDING' ? 0.6 : 1 }}>
                        <td style={{ padding: '0.875rem 1rem' }}>
                          <div>
                            <p style={{ fontWeight: 700, color: C.fg }}>{w.affiliate}</p>
                            <code style={{ fontSize: '0.75rem', color: C.muted }}>{w.code}</code>
                          </div>
                        </td>
                        <td style={{ padding: '0.875rem 1rem', fontWeight: 800, color: C.green, fontSize: '0.9375rem' }}>{brl(w.amount)}</td>
                        <td style={{ padding: '0.875rem 1rem' }}>
                          <span style={{ background: C.greenLight, color: C.green, fontSize: '0.6875rem', fontWeight: 700, padding: '2px 8px', borderRadius: 99 }}>{w.method}</span>
                        </td>
                        <td style={{ padding: '0.875rem 1rem', color: C.muted, fontSize: '0.75rem' }}>
                          {w.method === 'PIX' ? <>Chave: <strong style={{ color: C.fg }}>{w.pixKey}</strong></> : <>{w.bank}<br />Ag: {w.agency} · Cc: {w.account}</>}
                        </td>
                        <td style={{ padding: '0.875rem 1rem' }}><Badge status={w.status} map={WITHDRAWAL_STATUS} /></td>
                        <td style={{ padding: '0.875rem 1rem', color: C.muted, whiteSpace: 'nowrap' }}>{new Date(w.requestedAt).toLocaleDateString('pt-BR')}</td>
                        <td style={{ padding: '0.875rem 1rem' }}>
                          {w.status === 'PENDING' && (
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button onClick={() => approveWithdrawal(w.id)} style={{ background: C.greenLight, color: C.green, border: 'none', borderRadius: 6, padding: '0.375rem 0.625rem', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}>Aprovar</button>
                              <button onClick={() => { setRejectOpen(w); setRejectReason(''); }} style={{ background: 'hsl(0 84% 60% / 0.1)', color: 'hsl(0 84% 55%)', border: 'none', borderRadius: 6, padding: '0.375rem 0.625rem', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}>Rejeitar</button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Affiliate Detail Modal */}
      {detailOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem' }}>
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, width: '100%', maxWidth: 480, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.25rem 1.5rem', borderBottom: `1px solid ${C.border}` }}>
              <h2 style={{ fontSize: '1rem', fontWeight: 800, color: C.fg }}>Detalhes do Afiliado</h2>
              <button onClick={() => setDetailOpen(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted, fontSize: '1.25rem', lineHeight: 1 }}>×</button>
            </div>
            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'linear-gradient(135deg, hsl(168 83% 32%), hsl(168 83% 20%))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '0.875rem', fontWeight: 800 }}>
                  {detailOpen.name.split(' ').map(n => n[0]).slice(0, 2).join('')}
                </div>
                <div>
                  <p style={{ fontWeight: 800, color: C.fg, fontSize: '1rem' }}>{detailOpen.name}</p>
                  <p style={{ color: C.muted, fontSize: '0.8125rem' }}>{detailOpen.email}</p>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                {[
                  { label: 'Código', value: detailOpen.code },
                  { label: 'Status', value: STATUS_COLORS[detailOpen.status]?.label ?? detailOpen.status },
                  { label: 'Indicações', value: detailOpen.referrals },
                  { label: 'Convertidos', value: detailOpen.converted },
                  { label: 'Total Ganhos', value: brl(detailOpen.earned) },
                  { label: 'Saldo Pendente', value: brl(detailOpen.pending) },
                  { label: 'Comissão', value: `${detailOpen.commission}%` },
                  { label: 'Membro desde', value: new Date(detailOpen.joined).toLocaleDateString('pt-BR') },
                ].map(item => (
                  <div key={item.label} style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: '0.75rem' }}>
                    <p style={{ fontSize: '0.6875rem', color: C.muted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{item.label}</p>
                    <p style={{ fontWeight: 700, color: C.fg, marginTop: 2 }}>{item.value}</p>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => { toggleStatus(detailOpen.id); setDetailOpen(null); }} style={{ flex: 1, background: detailOpen.status === 'ACTIVE' ? 'hsl(0 84% 60% / 0.1)' : C.greenLight, color: detailOpen.status === 'ACTIVE' ? 'hsl(0 84% 55%)' : C.green, border: 'none', borderRadius: 8, padding: '0.625rem', fontSize: '0.8125rem', fontWeight: 700, cursor: 'pointer' }}>
                  {detailOpen.status === 'ACTIVE' ? 'Suspender Afiliado' : 'Ativar Afiliado'}
                </button>
                <button onClick={() => setDetailOpen(null)} style={{ flex: 1, background: 'hsl(var(--muted))', color: C.fg, border: 'none', borderRadius: 8, padding: '0.625rem', fontSize: '0.8125rem', fontWeight: 700, cursor: 'pointer' }}>
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reject Withdrawal Modal */}
      {rejectOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem' }}>
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, width: '100%', maxWidth: 400, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.25rem 1.5rem', borderBottom: `1px solid ${C.border}` }}>
              <h2 style={{ fontSize: '1rem', fontWeight: 800, color: C.fg }}>Rejeitar Saque</h2>
              <button onClick={() => setRejectOpen(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted, fontSize: '1.25rem', lineHeight: 1 }}>×</button>
            </div>
            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <p style={{ fontSize: '0.875rem', color: C.muted }}>
                Rejeitar saque de <strong style={{ color: C.fg }}>{brl(rejectOpen.amount)}</strong> para <strong style={{ color: C.fg }}>{rejectOpen.affiliate}</strong>.
              </p>
              <div>
                <label style={{ fontSize: '0.8125rem', fontWeight: 700, color: C.fg, display: 'block', marginBottom: 6 }}>Motivo da Rejeição</label>
                <textarea
                  value={rejectReason}
                  onChange={e => setRejectReason(e.target.value)}
                  rows={3}
                  placeholder="Explique o motivo da rejeição..."
                  style={{ width: '100%', border: `1px solid ${C.border}`, borderRadius: 8, padding: '0.625rem 0.75rem', fontSize: '0.8125rem', background: C.bg, color: C.fg, outline: 'none', resize: 'vertical', boxSizing: 'border-box' }}
                />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => rejectWithdrawal(rejectOpen.id, rejectReason)} style={{ flex: 1, background: 'hsl(0 84% 55%)', color: '#fff', border: 'none', borderRadius: 8, padding: '0.625rem', fontSize: '0.8125rem', fontWeight: 700, cursor: 'pointer' }}>
                  Confirmar Rejeição
                </button>
                <button onClick={() => setRejectOpen(null)} style={{ flex: 1, background: 'hsl(var(--muted))', color: C.fg, border: 'none', borderRadius: 8, padding: '0.625rem', fontSize: '0.8125rem', fontWeight: 700, cursor: 'pointer' }}>
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
