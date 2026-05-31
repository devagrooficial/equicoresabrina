import { useState } from 'react';

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

// ─── Mock data ────────────────────────────────────────────────────────────────

const MRR_DATA = [8200, 9100, 9800, 10400, 11200, 12340];
const NEW_USERS_DATA = [12, 18, 9, 22, 17, 14, 19, 11, 25, 16, 13, 20];

const PLAN_SEGMENTS = [
  { value: 540, color: C.muted, label: 'Gratuito' },
  { value: 312, color: C.blue, label: 'Starter' },
  { value: 187, color: C.green, label: 'Pro' },
  { value: 89, color: C.purple, label: 'Haras' },
];

const RECENT_USERS = [
  { name: 'Felipe Moraes', email: 'felipe@harasmorais.com', plan: 'Pro', equines: 8, joined: '23/05/2026', status: 'ACTIVE' },
  { name: 'Carla Duarte', email: 'carla.duarte@gmail.com', plan: 'Starter', equines: 3, joined: '22/05/2026', status: 'ACTIVE' },
  { name: 'Rancho Bom Jesus', email: 'admin@ranchobomjesus.com.br', plan: 'Haras', equines: 34, joined: '21/05/2026', status: 'ACTIVE' },
  { name: 'Pedro Cavalcante', email: 'pedro.cav@icloud.com', plan: 'Gratuito', equines: 1, joined: '20/05/2026', status: 'ACTIVE' },
  { name: 'Ana Letícia Braga', email: 'analeticia@equidrome.com', plan: 'Pro', equines: 12, joined: '20/05/2026', status: 'ACTIVE' },
];

const ACTIVITY_LOG = [
  { time: '11:42', event: 'Novo usuário', detail: 'Felipe Moraes — Plano Pro', color: C.green },
  { time: '10:18', event: 'Pagamento recebido', detail: 'Rancho Bom Jesus — R$ 189,00', color: 'hsl(142 71% 32%)' },
  { time: '09:55', event: 'Saque solicitado', detail: 'Afiliado: Marcos Vell — R$ 240,00', color: C.amber },
  { time: '09:30', event: 'Assinatura cancelada', detail: 'user@email.com — Plano Starter', color: C.redText },
  { time: '08:14', event: 'Novo usuário', detail: 'Ana Letícia Braga — Plano Pro', color: C.green },
  { time: '07:03', event: 'Pagamento recebido', detail: 'Felipe Moraes — R$ 89,00', color: 'hsl(142 71% 32%)' },
];

const planColors: Record<string, { bg: string; text: string }> = {
  Gratuito: { bg: 'hsl(var(--muted))', text: C.muted },
  Starter: { bg: C.blueLight, text: C.blueText },
  Pro: { bg: C.greenLight, text: C.green },
  Haras: { bg: C.purpleLight, text: C.purpleText },
};

export default function DashboardAdmin() {
  const [period, setPeriod] = useState<'hoje' | '7d' | '30d'>('30d');
  const newUsersCount = period === 'hoje' ? 12 : period === '7d' ? 47 : 189;

  return (
    <div>
      <style>{`
        .admin-kpi-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
        @media (min-width: 1100px) { .admin-kpi-grid { grid-template-columns: repeat(3, 1fr); } }
        @media (min-width: 1400px) { .admin-kpi-grid { grid-template-columns: repeat(6, 1fr); } }
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
          <p style={{ fontSize: '0.8125rem', color: C.muted, marginTop: 2 }}>24 de maio de 2026 · Métricas em tempo real</p>
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
        <KpiCard title="MRR" value="R$ 12.340" sub="vs. mês anterior" trend={+10.2} trendSuffix="%" iconColor={C.green} iconBg={C.greenLight}
          icon='<line x1="12" x2="12" y1="2" y2="22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>'
          chart={<MiniBarChart data={MRR_DATA} color={C.green} />}
        />
        <KpiCard title="Churn Mensal" value="2,3%" sub="vs. 3,1% anterior" trend={-0.8} trendSuffix="%" iconColor={C.amber} iconBg={C.amberLight}
          icon='<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/>'
        />
        <KpiCard title={`Novos Usuários (${period})`} value={String(newUsersCount)} sub="cadastros confirmados" trend={+14.5} trendSuffix="%" iconColor={C.blue} iconBg={C.blueLight}
          icon='<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6"/><path d="M22 11h-6"/>'
          chart={<MiniBarChart data={NEW_USERS_DATA.slice(-7)} color={C.blue} />}
        />
        <KpiCard title="Total de Usuários" value="1.128" sub="ativos na plataforma" iconColor={C.fg} iconBg="hsl(var(--muted))"
          icon='<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>'
        />
        <KpiCard title="Equinos Cadastrados" value="1.847" sub="em todos os usuários" iconColor={C.green} iconBg={C.greenLight}
          icon='<path d="M13 2C11 2 10 3 10 5v2H7L5 9v2l2 1v4l-2 2v2h4v-2l2-1 2 1v2h4v-2l-2-2v-4l2-1V9l-2-2h-3V5c0-2-1-3-1-3z"/>'
        />
        <KpiCard title="Alertas Críticos" value="23" sub="na plataforma toda" trend={-3} trendSuffix="" iconColor={C.red} iconBg={C.redLight}
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
          <div style={{ overflowX: 'auto' }}>
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
                {RECENT_USERS.map((u) => {
                  const pc = planColors[u.plan] ?? { bg: 'hsl(var(--muted))', text: C.muted };
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
                        <span style={{ fontSize: '0.6875rem', fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: pc.bg, color: pc.text }}>{u.plan}</span>
                      </td>
                      <td style={{ color: C.muted }}>{u.equines}</td>
                      <td style={{ color: C.muted, fontSize: '0.75rem' }}>{u.joined}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Plans donut */}
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: '1rem', padding: '1rem 1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.875rem' }}>
              <p style={{ fontSize: '0.875rem', fontWeight: 700, color: C.fg }}>Distribuição de Planos</p>
              <a href="/admin/assinaturas" style={{ fontSize: '0.75rem', color: C.green, textDecoration: 'none', fontWeight: 600 }}>Detalhes →</a>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <DonutChart segments={PLAN_SEGMENTS} />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {PLAN_SEGMENTS.map((s) => (
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

          {/* Activity log */}
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: '1rem', overflow: 'hidden', flex: 1 }}>
            <div style={{ padding: '1rem 1.25rem', borderBottom: `1px solid ${C.border}` }}>
              <p style={{ fontSize: '0.875rem', fontWeight: 700, color: C.fg }}>Log de Atividades (hoje)</p>
            </div>
            <div style={{ padding: '0.5rem 0' }}>
              {ACTIVITY_LOG.map((log, i) => (
                <div key={i} style={{ display: 'flex', gap: 12, padding: '0.5rem 1.25rem', alignItems: 'flex-start' }}>
                  <span style={{ fontSize: '0.6875rem', color: C.muted, fontWeight: 600, minWidth: 36, marginTop: 1, flexShrink: 0 }}>{log.time}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: '0.75rem', fontWeight: 700, color: log.color }}>{log.event}</p>
                    <p style={{ fontSize: '0.6875rem', color: C.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{log.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
