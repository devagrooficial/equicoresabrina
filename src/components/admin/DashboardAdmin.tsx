import { useState, useEffect } from 'react';
import { createClient } from '../../lib/supabase';
import { calculateAlertStatus } from '../../lib/alertStatus';

const C = {
  green: 'hsl(168 83% 29%)',
  greenLight: 'hsl(168 83% 29% / 0.1)',
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
  blue: 'hsl(217 91% 50%)',
  blueLight: 'hsl(217 91% 50% / 0.1)',
  blueText: 'hsl(217 91% 32%)',
  purple: 'hsl(270 70% 55%)',
  purpleLight: 'hsl(270 70% 55% / 0.1)',
  purpleText: 'hsl(270 70% 36%)',
};

// ─── SVG Mini Bar Chart ───────────────────────────────────────────────────────

function MiniBarChart({ data, color }: { data: number[]; color: string }) {
  const max = Math.max(...data);
  const W = 80, H = 28, gap = 2;
  const barW = (W - gap * (data.length - 1)) / data.length;
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      {data.map((v, i) => {
        const h = max > 0 ? (v / max) * H : 0;
        return (
          <rect key={i} x={i * (barW + gap)} y={H - h} width={barW} height={h}
            rx={2} fill={color} opacity={i === data.length - 1 ? 1 : 0.5} />
        );
      })}
    </svg>
  );
}

// ─── SVG Donut Chart ──────────────────────────────────────────────────────────

function DonutChart({ segments }: { segments: { value: number; color: string; label: string }[] }) {
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  const R = 44, cx = 50, cy = 50, stroke = 16;
  let cumAngle = -Math.PI / 2;
  const arcs = segments.map((seg) => {
    const frac = total > 0 ? seg.value / total : 0;
    const angle = frac * 2 * Math.PI;
    const x1 = cx + R * Math.cos(cumAngle);
    const y1 = cy + R * Math.sin(cumAngle);
    cumAngle += angle;
    const x2 = cx + R * Math.cos(cumAngle);
    const y2 = cy + R * Math.sin(cumAngle);
    const large = angle > Math.PI ? 1 : 0;
    return { ...seg, d: `M ${x1} ${y1} A ${R} ${R} 0 ${large} 1 ${x2} ${y2}`, frac, angle };
  });
  return (
    <svg width={100} height={100} viewBox="0 0 100 100">
      {arcs.filter(a => a.angle > 0).map((a, i) => (
        <path key={i} d={a.d} fill="none" stroke={a.color} strokeWidth={stroke} strokeLinecap="butt" />
      ))}
      <text x={cx} y={cy + 5} textAnchor="middle" fontSize="11" fontWeight="800" fill={C.fg}>
        {total.toLocaleString('pt-BR')}
      </text>
    </svg>
  );
}

// ─── Trend indicator ─────────────────────────────────────────────────────────

function Trend({ value, suffix = '%' }: { value: number; suffix?: string }) {
  const up = value >= 0;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: '0.75rem', fontWeight: 700, color: up ? 'hsl(142 71% 32%)' : C.redText }}>
      {up ? '↑' : '↓'} {Math.abs(value)}{suffix}
    </span>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({ title, value, sub, trend, trendSuffix, icon, iconColor, iconBg, chart }: {
  title: string; value: string; sub?: string; trend?: number; trendSuffix?: string;
  icon: string; iconColor: string; iconBg: string; chart?: React.ReactNode;
}) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: '1rem', padding: '1.125rem 1.25rem', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.muted }}>{title}</p>
          <p style={{ fontSize: '1.6rem', fontWeight: 900, color: C.fg, letterSpacing: '-0.02em', lineHeight: 1.2, marginTop: 4 }}>{value}</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
            {trend !== undefined && <Trend value={trend} suffix={trendSuffix} />}
            {sub && <p style={{ fontSize: '0.75rem', color: C.muted }}>{sub}</p>}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
          <div style={{ width: 36, height: 36, borderRadius: '0.625rem', display: 'flex', alignItems: 'center', justifyContent: 'center', background: iconBg }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={iconColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: icon }} />
          </div>
          {chart}
        </div>
      </div>
    </div>
  );
}

const PLAN_LABEL: Record<string, string> = { free: 'Gratuito', starter: 'Starter', pro: 'Pro', haras: 'Haras' };
const planColors: Record<string, { bg: string; text: string; dot: string }> = {
  free: { bg: 'hsl(var(--muted))', text: C.muted, dot: C.muted },
  starter: { bg: C.blueLight, text: C.blueText, dot: C.blue },
  pro: { bg: C.greenLight, text: C.green, dot: C.green },
  haras: { bg: C.purpleLight, text: C.purpleText, dot: C.purple },
};

interface RecentUser { name: string; email: string; plan: string; equines: number; joined: string }

function daysAgo(n: number): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - n);
  return d;
}

export default function DashboardAdmin() {
  const supabase = createClient();
  const [period, setPeriod] = useState<'hoje' | '7d' | '30d'>('30d');
  const [loading, setLoading] = useState(true);

  const [totalUsers, setTotalUsers] = useState(0);
  const [totalEquines, setTotalEquines] = useState(0);
  const [criticalAlerts, setCriticalAlerts] = useState(0);
  const [mrr, setMrr] = useState(0);
  const [activeSubs, setActiveSubs] = useState(0);
  const [newUsersByPeriod, setNewUsersByPeriod] = useState({ hoje: 0, '7d': 0, '30d': 0 });
  const [newUsersDaily, setNewUsersDaily] = useState<number[]>([]);
  const [planSegments, setPlanSegments] = useState<{ value: number; color: string; label: string }[]>([]);
  const [recentUsers, setRecentUsers] = useState<RecentUser[]>([]);

  useEffect(() => {
    async function load() {
      const [{ data: profiles }, { data: equinos }, { data: alerts }, { data: subs }] = await Promise.all([
        supabase.from('profiles').select('id, full_name, email, plan, created_at').eq('role', 'dono').order('created_at', { ascending: false }),
        supabase.from('equinos').select('id, user_id'),
        supabase.from('equine_alerts').select('due_date, status_override, resolved_at'),
        supabase.from('subscriptions').select('status, price_cents'),
      ]);

      const profs = (profiles as any[]) ?? [];
      const eqs = (equinos as any[]) ?? [];

      setTotalUsers(profs.length);
      setTotalEquines(eqs.length);

      const equinesByUser = new Map<string, number>();
      for (const e of eqs) equinesByUser.set(e.user_id, (equinesByUser.get(e.user_id) ?? 0) + 1);

      const today0 = daysAgo(0);
      const d7 = daysAgo(7);
      const d30 = daysAgo(30);
      setNewUsersByPeriod({
        hoje: profs.filter(p => new Date(p.created_at) >= today0).length,
        '7d': profs.filter(p => new Date(p.created_at) >= d7).length,
        '30d': profs.filter(p => new Date(p.created_at) >= d30).length,
      });

      const daily: number[] = [];
      for (let i = 6; i >= 0; i--) {
        const start = daysAgo(i);
        const end = daysAgo(i - 1);
        daily.push(profs.filter(p => { const c = new Date(p.created_at); return c >= start && c < end; }).length);
      }
      setNewUsersDaily(daily);

      const segCounts: Record<string, number> = { free: 0, starter: 0, pro: 0, haras: 0 };
      for (const p of profs) segCounts[p.plan as string] = (segCounts[p.plan as string] ?? 0) + 1;
      setPlanSegments([
        { value: segCounts.free, color: C.muted, label: PLAN_LABEL.free },
        { value: segCounts.starter, color: C.blue, label: PLAN_LABEL.starter },
        { value: segCounts.pro, color: C.green, label: PLAN_LABEL.pro },
        { value: segCounts.haras, color: C.purple, label: PLAN_LABEL.haras },
      ]);

      setRecentUsers(profs.slice(0, 5).map(p => ({
        name: p.full_name ?? '—',
        email: p.email ?? '—',
        plan: p.plan ?? 'free',
        equines: equinesByUser.get(p.id) ?? 0,
        joined: p.created_at,
      })));

      const alertRows = (alerts as any[]) ?? [];
      const critical = alertRows.filter(a => {
        if (a.status_override === 'NAO_POSSUI' || a.resolved_at || !a.due_date) return false;
        const key = calculateAlertStatus(a.due_date).key;
        return key === 'VENCIDA' || key === 'CRITICO';
      }).length;
      setCriticalAlerts(critical);

      const subRows = (subs as any[]) ?? [];
      setMrr(subRows.filter(s => s.status === 'active').reduce((sum, s) => sum + (s.price_cents ?? 0), 0) / 100);
      setActiveSubs(subRows.filter(s => s.status === 'active' || s.status === 'trialing').length);

      setLoading(false);
    }
    load();
  }, []);

  const newUsersCount = newUsersByPeriod[period];

  if (loading) return <p style={{ color: C.muted, fontSize: '0.875rem', padding: '2rem 0' }}>Carregando…</p>;

  return (
    <div>
      <style>{`
        .admin-kpi-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
        @media (min-width: 1100px) { .admin-kpi-grid { grid-template-columns: repeat(3, 1fr); } }
        @media (min-width: 1400px) { .admin-kpi-grid { grid-template-columns: repeat(5, 1fr); } }
        .admin-bottom-grid { display: grid; grid-template-columns: 1fr; gap: 16px; }
        @media (min-width: 1024px) { .admin-bottom-grid { grid-template-columns: 3fr 2fr; } }
        .users-table { width: 100%; border-collapse: collapse; }
        .users-table th { text-align: left; font-size: 0.6875rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: ${C.muted}; padding: 8px 10px; border-bottom: 1px solid ${C.border}; white-space: nowrap; }
        .users-table td { padding: 10px 10px; border-bottom: 1px solid ${C.border}; font-size: 0.8125rem; color: ${C.fg}; vertical-align: middle; }
        .users-table tr:last-child td { border-bottom: none; }
        .users-table tr:hover td { background: hsl(var(--muted) / 0.4); }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 800, color: C.fg, letterSpacing: '-0.02em' }}>Dashboard Admin</h1>
          <p style={{ fontSize: '0.8125rem', color: C.muted, marginTop: 2 }}>
            {new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })} · Métricas em tempo real
          </p>
        </div>
        <div style={{ display: 'flex', gap: 6, background: 'hsl(var(--muted))', padding: 4, borderRadius: 10 }}>
          {(['hoje', '7d', '30d'] as const).map(p => (
            <button key={p} onClick={() => setPeriod(p)} style={{ padding: '5px 12px', borderRadius: 7, fontSize: '0.75rem', fontWeight: 700, border: 'none', cursor: 'pointer', background: period === p ? C.card : 'transparent', color: period === p ? C.fg : C.muted, boxShadow: period === p ? '0 1px 4px hsl(0 0% 0% / 0.08)' : 'none' }}>
              {p === 'hoje' ? 'Hoje' : p}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Grid */}
      <div className="admin-kpi-grid" style={{ marginBottom: '1.25rem' }}>
        <KpiCard title="MRR" value={mrr.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} sub={`${activeSubs} assinaturas ativas`} iconColor={C.green} iconBg={C.greenLight}
          icon='<line x1="12" x2="12" y1="2" y2="22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>'
        />
        <KpiCard title={`Novos Usuários (${period})`} value={String(newUsersCount)} sub="cadastros confirmados" iconColor={C.blue} iconBg={C.blueLight}
          icon='<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6"/><path d="M22 11h-6"/>'
          chart={<MiniBarChart data={newUsersDaily} color={C.blue} />}
        />
        <KpiCard title="Total de Usuários" value={totalUsers.toLocaleString('pt-BR')} sub="donos de haras" iconColor={C.fg} iconBg="hsl(var(--muted))"
          icon='<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>'
        />
        <KpiCard title="Equinos Cadastrados" value={totalEquines.toLocaleString('pt-BR')} sub="em todos os usuários" iconColor={C.green} iconBg={C.greenLight}
          icon='<path d="M13 2C11 2 10 3 10 5v2H7L5 9v2l2 1v4l-2 2v2h4v-2l2-1 2 1v2h4v-2l-2-2v-4l2-1V9l-2-2h-3V5c0-2-1-3-1-3z"/>'
        />
        <KpiCard title="Alertas Críticos" value={String(criticalAlerts)} sub="vencidos ou a vencer em 3 dias" iconColor={C.red} iconBg={C.redLight}
          icon='<circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/>'
        />
      </div>

      {/* Bottom grid */}
      <div className="admin-bottom-grid">

        {/* Recent signups */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: '1rem', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 1.25rem', borderBottom: `1px solid ${C.border}` }}>
            <p style={{ fontSize: '0.875rem', fontWeight: 700, color: C.fg }}>Cadastros Recentes</p>
            <a href="/admin/usuarios" style={{ fontSize: '0.75rem', color: C.green, textDecoration: 'none', fontWeight: 600 }}>Ver todos →</a>
          </div>
          <div style={{ overflowX: 'auto', overflowY: 'hidden' }}>
            <table className="users-table">
              <thead>
                <tr>
                  <th>Usuário</th>
                  <th>Plano</th>
                  <th>Equinos</th>
                  <th>Cadastro</th>
                </tr>
              </thead>
              <tbody>
                {recentUsers.length === 0 ? (
                  <tr><td colSpan={4} style={{ textAlign: 'center', padding: '1.5rem', color: C.muted }}>Nenhum cadastro ainda</td></tr>
                ) : recentUsers.map((u) => {
                  const pc = planColors[u.plan] ?? planColors.free;
                  const initials = u.name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
                  return (
                    <tr key={u.email}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 28, height: 28, borderRadius: '50%', background: C.green, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '0.625rem', fontWeight: 800, flexShrink: 0 }}>{initials}</div>
                          <div>
                            <p style={{ fontWeight: 600, fontSize: '0.8125rem', color: C.fg }}>{u.name}</p>
                            <p style={{ fontSize: '0.6875rem', color: C.muted }}>{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span style={{ fontSize: '0.6875rem', fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: pc.bg, color: pc.text }}>{PLAN_LABEL[u.plan] ?? u.plan}</span>
                      </td>
                      <td style={{ color: C.muted }}>{u.equines}</td>
                      <td style={{ color: C.muted, fontSize: '0.75rem' }}>{new Date(u.joined).toLocaleDateString('pt-BR')}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Plans donut */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: '1rem', padding: '1rem 1.25rem', alignSelf: 'flex-start' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.875rem' }}>
            <p style={{ fontSize: '0.875rem', fontWeight: 700, color: C.fg }}>Distribuição de Planos</p>
            <a href="/admin/assinaturas" style={{ fontSize: '0.75rem', color: C.green, textDecoration: 'none', fontWeight: 600 }}>Detalhes →</a>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <DonutChart segments={planSegments} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {planSegments.map((s) => (
                <div key={s.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
                    <span style={{ fontSize: '0.75rem', color: C.muted }}>{s.label}</span>
                  </div>
                  <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: C.fg }}>{s.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
