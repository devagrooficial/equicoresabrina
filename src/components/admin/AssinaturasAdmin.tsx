import { useState } from 'react';

const C = {
  green: 'hsl(168 83% 29%)',
  greenLight: 'hsl(168 83% 29% / 0.1)',
  greenBorder: 'hsl(168 83% 29% / 0.25)',
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

type SubTab = 'assinaturas' | 'planos' | 'cupons';

const SUBSCRIPTIONS = [
  { id: 's1', user: 'Sabrina Santos', email: 'sabrina@harasantaclara.com', plan: 'Pro', status: 'ACTIVE', billing: 'Mensal', amount: 89, nextBilling: '24/06/2026', started: '24/01/2026' },
  { id: 's2', user: 'Rancho Bom Jesus', email: 'admin@ranchobomjesus.com.br', plan: 'Haras', status: 'ACTIVE', billing: 'Anual', amount: 1890, nextBilling: '21/05/2027', started: '21/05/2026' },
  { id: 's3', user: 'Felipe Moraes', email: 'felipe@harasmorais.com', plan: 'Pro', status: 'ACTIVE', billing: 'Mensal', amount: 89, nextBilling: '23/06/2026', started: '23/05/2026' },
  { id: 's4', user: 'Ana Letícia Braga', email: 'analeticia@equidrome.com', plan: 'Pro', status: 'ACTIVE', billing: 'Mensal', amount: 89, nextBilling: '20/06/2026', started: '20/05/2026' },
  { id: 's5', user: 'Haras Boa Esperança', email: 'contato@harasboaesperanca.com.br', plan: 'Haras', status: 'ACTIVE', billing: 'Mensal', amount: 189, nextBilling: '03/06/2026', started: '03/04/2026' },
  { id: 's6', user: 'Roberto Figueiredo', email: 'r.figueiredo@hotmail.com', plan: 'Starter', status: 'PAST_DUE', billing: 'Mensal', amount: 39, nextBilling: '10/05/2026', started: '14/03/2026' },
  { id: 's7', user: 'Granja Santo Antônio', email: 'gsa@granjaantonio.com.br', plan: 'Haras', status: 'ACTIVE', billing: 'Anual', amount: 2016, nextBilling: '10/01/2027', started: '10/01/2026' },
  { id: 's8', user: 'Carla Duarte', email: 'carla.duarte@gmail.com', plan: 'Starter', status: 'ACTIVE', billing: 'Mensal', amount: 39, nextBilling: '22/06/2026', started: '22/05/2026' },
];

const PLANS_DATA = [
  { id: 'p1', name: 'Gratuito', slug: 'free', equines: 2, storage: '500 MB', monthly: 0, yearly: 0, users: 540, active: true },
  { id: 'p2', name: 'Starter', slug: 'starter', equines: 5, storage: '2 GB', monthly: 39, yearly: 390, users: 312, active: true },
  { id: 'p3', name: 'Pro', slug: 'pro', equines: 15, storage: '10 GB', monthly: 89, yearly: 890, users: 187, active: true },
  { id: 'p4', name: 'Haras', slug: 'haras', equines: -1, storage: '30 GB', monthly: 189, yearly: 1890, users: 89, active: true },
];

const COUPONS = [
  { id: 'c1', code: 'LANCAMENTO30', type: 'percent', value: 30, uses: 47, maxUses: 100, valid: '31/12/2026', active: true },
  { id: 'c2', code: 'BEMVINDO50', type: 'fixed', value: 50, uses: 12, maxUses: null, valid: '30/06/2026', active: true },
  { id: 'c3', code: 'PARCEIRO20', type: 'percent', value: 20, uses: 89, maxUses: null, valid: '31/12/2026', active: true },
  { id: 'c4', code: 'NATAL2025', type: 'percent', value: 40, uses: 156, maxUses: 200, valid: '31/01/2026', active: false },
];

const planCfg: Record<string, { bg: string; text: string }> = {
  Gratuito: { bg: C.muted_bg, text: C.muted },
  Starter: { bg: C.blueLight, text: C.blueText },
  Pro: { bg: C.greenLight, text: C.green },
  Haras: { bg: C.purpleLight, text: C.purpleText },
};

const subStatusCfg: Record<string, { label: string; bg: string; text: string }> = {
  ACTIVE: { label: 'Ativo', bg: 'hsl(142 71% 45% / 0.12)', text: 'hsl(142 71% 28%)' },
  PAST_DUE: { label: 'Em atraso', bg: C.amberLight, text: C.amberText },
  CANCELED: { label: 'Cancelado', bg: C.redLight, text: C.redText },
};

function TabBtn({ id, label, current, onClick }: { id: SubTab; label: string; current: SubTab; onClick: (t: SubTab) => void }) {
  const active = id === current;
  return (
    <button onClick={() => onClick(id)} style={{ padding: '8px 18px', borderRadius: '0.625rem', fontSize: '0.875rem', fontWeight: 600, border: 'none', cursor: 'pointer', transition: 'all 0.15s', background: active ? C.card : 'transparent', color: active ? C.fg : C.muted, boxShadow: active ? '0 1px 4px hsl(0 0% 0% / 0.08)' : 'none' }}>
      {label}
    </button>
  );
}

function AssinaturasTab() {
  const [search, setSearch] = useState('');
  const filtered = search ? SUBSCRIPTIONS.filter(s => s.user.toLowerCase().includes(search.toLowerCase()) || s.email.toLowerCase().includes(search.toLowerCase())) : SUBSCRIPTIONS;
  const mrr = SUBSCRIPTIONS.filter(s => s.status === 'ACTIVE').reduce((sum, s) => sum + (s.billing === 'Anual' ? s.amount / 12 : s.amount), 0);

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12, marginBottom: '1.25rem' }}>
        {[
          { label: 'MRR', value: `R$ ${mrr.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}`, color: C.green, bg: C.greenLight },
          { label: 'Assinaturas Ativas', value: String(SUBSCRIPTIONS.filter(s => s.status === 'ACTIVE').length), color: 'hsl(142 71% 28%)', bg: 'hsl(142 71% 45% / 0.12)' },
          { label: 'Em Atraso', value: String(SUBSCRIPTIONS.filter(s => s.status === 'PAST_DUE').length), color: C.amberText, bg: C.amberLight },
        ].map(m => (
          <div key={m.label} style={{ padding: '1rem', borderRadius: '0.875rem', background: m.bg }}>
            <p style={{ fontSize: '1.4rem', fontWeight: 900, color: m.color }}>{m.value}</p>
            <p style={{ fontSize: '0.6875rem', fontWeight: 700, color: m.color, textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 2, opacity: 0.8 }}>{m.label}</p>
          </div>
        ))}
      </div>

      <div style={{ position: 'relative', maxWidth: 360, marginBottom: '1rem' }}>
        <div style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: C.muted }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
        </div>
        <input type="search" placeholder="Buscar assinante…" value={search} onChange={e => setSearch(e.target.value)}
          style={{ width: '100%', padding: '0.5rem 0.875rem 0.5rem 2.25rem', borderRadius: '0.625rem', border: `1px solid ${C.border}`, background: C.bg, color: C.fg, fontSize: '0.875rem', outline: 'none', boxSizing: 'border-box' }} />
      </div>

      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: '1rem', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Assinante', 'Plano', 'Status', 'Ciclo', 'Valor', 'Próx. cobrança'].map(h => (
                  <th key={h} style={{ textAlign: 'left', fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.muted, padding: '10px 12px', borderBottom: `1px solid ${C.border}`, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(s => {
                const pc = planCfg[s.plan] ?? { bg: C.muted_bg, text: C.muted };
                const sc = subStatusCfg[s.status] ?? { label: s.status, bg: C.muted_bg, text: C.muted };
                return (
                  <tr key={s.id} style={{ cursor: 'default' }}>
                    <td style={{ padding: '11px 12px', borderBottom: `1px solid ${C.border}` }}>
                      <p style={{ fontSize: '0.8125rem', fontWeight: 600, color: C.fg }}>{s.user}</p>
                      <p style={{ fontSize: '0.6875rem', color: C.muted }}>{s.email}</p>
                    </td>
                    <td style={{ padding: '11px 12px', borderBottom: `1px solid ${C.border}` }}>
                      <span style={{ fontSize: '0.6875rem', fontWeight: 700, padding: '2px 9px', borderRadius: 999, background: pc.bg, color: pc.text }}>{s.plan}</span>
                    </td>
                    <td style={{ padding: '11px 12px', borderBottom: `1px solid ${C.border}` }}>
                      <span style={{ fontSize: '0.6875rem', fontWeight: 700, padding: '2px 9px', borderRadius: 999, background: sc.bg, color: sc.text }}>{sc.label}</span>
                    </td>
                    <td style={{ padding: '11px 12px', borderBottom: `1px solid ${C.border}`, fontSize: '0.8125rem', color: C.muted }}>{s.billing}</td>
                    <td style={{ padding: '11px 12px', borderBottom: `1px solid ${C.border}`, fontSize: '0.875rem', fontWeight: 700, color: C.fg }}>R$ {s.amount.toLocaleString('pt-BR')}</td>
                    <td style={{ padding: '11px 12px', borderBottom: `1px solid ${C.border}`, fontSize: '0.8125rem', color: C.muted }}>{s.nextBilling}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function PlanosTab() {
  const [plans, setPlans] = useState(PLANS_DATA);
  const [editing, setEditing] = useState<string | null>(null);
  const [editVals, setEditVals] = useState<{ monthly: string; yearly: string }>({ monthly: '', yearly: '' });

  function startEdit(p: typeof PLANS_DATA[0]) {
    setEditing(p.id);
    setEditVals({ monthly: String(p.monthly), yearly: String(p.yearly) });
  }

  function saveEdit(id: string) {
    setPlans(prev => prev.map(p => p.id === id ? { ...p, monthly: Number(editVals.monthly), yearly: Number(editVals.yearly) } : p));
    setEditing(null);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {plans.map(p => {
        const pc = planCfg[p.name] ?? { bg: C.muted_bg, text: C.muted };
        const isEditing = editing === p.id;
        return (
          <div key={p.id} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: '1rem', padding: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
                <div style={{ width: 44, height: 44, borderRadius: '0.75rem', background: pc.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: '1.125rem', fontWeight: 900, color: pc.text }}>{p.name[0]}</span>
                </div>
                <div>
                  <p style={{ fontSize: '1rem', fontWeight: 800, color: C.fg }}>{p.name}</p>
                  <p style={{ fontSize: '0.75rem', color: C.muted }}>
                    {p.equines === -1 ? 'Ilimitado' : p.equines} equinos · {p.storage} · {p.users} assinantes
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap' }}>
                {isEditing ? (
                  <>
                    <div>
                      <p style={{ fontSize: '0.6875rem', color: C.muted, fontWeight: 600, marginBottom: 4 }}>Mensal (R$)</p>
                      <input type="number" value={editVals.monthly} onChange={e => setEditVals(v => ({ ...v, monthly: e.target.value }))}
                        style={{ width: 90, padding: '6px 10px', borderRadius: 8, border: `1.5px solid ${C.green}`, background: C.bg, color: C.fg, fontSize: '0.875rem', fontWeight: 700, outline: 'none' }} />
                    </div>
                    <div>
                      <p style={{ fontSize: '0.6875rem', color: C.muted, fontWeight: 600, marginBottom: 4 }}>Anual (R$)</p>
                      <input type="number" value={editVals.yearly} onChange={e => setEditVals(v => ({ ...v, yearly: e.target.value }))}
                        style={{ width: 90, padding: '6px 10px', borderRadius: 8, border: `1.5px solid ${C.green}`, background: C.bg, color: C.fg, fontSize: '0.875rem', fontWeight: 700, outline: 'none' }} />
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
                      <button onClick={() => saveEdit(p.id)} style={{ padding: '6px 16px', borderRadius: 8, background: C.green, color: '#fff', fontWeight: 700, fontSize: '0.8125rem', border: 'none', cursor: 'pointer' }}>Salvar</button>
                      <button onClick={() => setEditing(null)} style={{ padding: '6px 12px', borderRadius: 8, background: C.muted_bg, color: C.fg, fontWeight: 600, fontSize: '0.8125rem', border: 'none', cursor: 'pointer' }}>Cancelar</button>
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ fontSize: '0.6875rem', color: C.muted, fontWeight: 600 }}>Mensal</p>
                      <p style={{ fontSize: '1.125rem', fontWeight: 900, color: C.fg }}>{p.monthly === 0 ? 'Grátis' : `R$ ${p.monthly}`}</p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ fontSize: '0.6875rem', color: C.muted, fontWeight: 600 }}>Anual</p>
                      <p style={{ fontSize: '1.125rem', fontWeight: 900, color: C.fg }}>{p.yearly === 0 ? 'Grátis' : `R$ ${p.yearly}`}</p>
                    </div>
                    <button onClick={() => startEdit(p)} style={{ padding: '6px 16px', borderRadius: 8, background: C.greenLight, color: C.green, fontWeight: 700, fontSize: '0.8125rem', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                      Editar preços
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CuponsTab() {
  const [coupons, setCoupons] = useState(COUPONS);
  const [showForm, setShowForm] = useState(false);
  const [newCode, setNewCode] = useState('');
  const [newType, setNewType] = useState('percent');
  const [newValue, setNewValue] = useState('');
  const [newMaxUses, setNewMaxUses] = useState('');
  const [newValid, setNewValid] = useState('');

  function toggleActive(id: string) {
    setCoupons(prev => prev.map(c => c.id === id ? { ...c, active: !c.active } : c));
  }

  function addCoupon(e: React.FormEvent) {
    e.preventDefault();
    setCoupons(prev => [{ id: `c${Date.now()}`, code: newCode.toUpperCase(), type: newType, value: Number(newValue), uses: 0, maxUses: newMaxUses ? Number(newMaxUses) : null, valid: newValid || '—', active: true }, ...prev]);
    setNewCode(''); setNewType('percent'); setNewValue(''); setNewMaxUses(''); setNewValid(''); setShowForm(false);
  }

  const inp: React.CSSProperties = { padding: '0.5rem 0.875rem', borderRadius: '0.625rem', border: `1px solid ${C.border}`, background: C.bg, color: C.fg, fontSize: '0.875rem', outline: 'none', width: '100%', boxSizing: 'border-box' };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
        <button onClick={() => setShowForm(v => !v)} style={{ padding: '0.5rem 1.125rem', borderRadius: '0.75rem', background: C.green, color: '#fff', fontWeight: 600, fontSize: '0.875rem', border: 'none', cursor: 'pointer' }}>
          {showForm ? 'Cancelar' : '+ Novo cupom'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={addCoupon} style={{ background: C.card, border: `1.5px solid ${C.greenBorder}`, borderRadius: '1rem', padding: '1.25rem', marginBottom: '1rem' }}>
          <p style={{ fontSize: '0.875rem', fontWeight: 700, color: C.fg, marginBottom: '1rem' }}>Criar novo cupom</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '0.875rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 500, color: C.fg, marginBottom: 4 }}>Código *</label>
              <input type="text" required value={newCode} onChange={e => setNewCode(e.target.value.toUpperCase())} placeholder="PROMO20" style={inp} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 500, color: C.fg, marginBottom: 4 }}>Tipo *</label>
              <select value={newType} onChange={e => setNewType(e.target.value)} style={{ ...inp, appearance: 'auto' }}>
                <option value="percent">Percentual (%)</option>
                <option value="fixed">Valor fixo (R$)</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 500, color: C.fg, marginBottom: 4 }}>Valor *</label>
              <input type="number" required min={1} value={newValue} onChange={e => setNewValue(e.target.value)} placeholder={newType === 'percent' ? '30' : '50'} style={inp} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 500, color: C.fg, marginBottom: 4 }}>Máx. de usos</label>
              <input type="number" min={1} value={newMaxUses} onChange={e => setNewMaxUses(e.target.value)} placeholder="Ilimitado" style={inp} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 500, color: C.fg, marginBottom: 4 }}>Válido até</label>
              <input type="date" value={newValid} onChange={e => setNewValid(e.target.value)} style={inp} />
            </div>
          </div>
          <button type="submit" style={{ marginTop: '1rem', padding: '0.5rem 1.5rem', borderRadius: '0.625rem', background: C.green, color: '#fff', fontWeight: 700, fontSize: '0.875rem', border: 'none', cursor: 'pointer' }}>Criar cupom</button>
        </form>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {coupons.map(c => (
          <div key={c.id} style={{ background: C.card, border: `1px solid ${c.active ? C.border : C.border}`, borderRadius: '0.875rem', padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, opacity: c.active ? 1 : 0.5 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, flex: 1, flexWrap: 'wrap' }}>
              <code style={{ fontSize: '0.9375rem', fontWeight: 800, color: C.green, background: C.greenLight, padding: '4px 12px', borderRadius: 6, letterSpacing: '0.04em' }}>{c.code}</code>
              <div style={{ display: 'flex', gap: 12 }}>
                <div>
                  <p style={{ fontSize: '0.6875rem', color: C.muted, fontWeight: 600 }}>Desconto</p>
                  <p style={{ fontSize: '0.9rem', fontWeight: 800, color: C.fg }}>{c.type === 'percent' ? `${c.value}%` : `R$ ${c.value}`}</p>
                </div>
                <div>
                  <p style={{ fontSize: '0.6875rem', color: C.muted, fontWeight: 600 }}>Usos</p>
                  <p style={{ fontSize: '0.9rem', fontWeight: 800, color: C.fg }}>{c.uses}{c.maxUses ? ` / ${c.maxUses}` : ''}</p>
                </div>
                <div>
                  <p style={{ fontSize: '0.6875rem', color: C.muted, fontWeight: 600 }}>Válido até</p>
                  <p style={{ fontSize: '0.9rem', fontWeight: 800, color: C.fg }}>{c.valid}</p>
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <span style={{ fontSize: '0.6875rem', fontWeight: 700, padding: '2px 9px', borderRadius: 999, background: c.active ? 'hsl(142 71% 45% / 0.12)' : C.muted_bg, color: c.active ? 'hsl(142 71% 28%)' : C.muted }}>
                {c.active ? 'Ativo' : 'Inativo'}
              </span>
              <button onClick={() => toggleActive(c.id)} style={{ padding: '4px 12px', borderRadius: 6, fontSize: '0.75rem', fontWeight: 600, background: C.muted_bg, color: C.fg, border: 'none', cursor: 'pointer' }}>
                {c.active ? 'Desativar' : 'Ativar'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AssinaturasAdmin() {
  const [tab, setTab] = useState<SubTab>('assinaturas');
  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.25rem', fontWeight: 800, color: C.fg, letterSpacing: '-0.02em' }}>Assinaturas</h1>
        <p style={{ fontSize: '0.8125rem', color: C.muted, marginTop: 2 }}>Gerenciamento de planos, cobranças e cupons</p>
      </div>
      <div style={{ display: 'flex', gap: 4, padding: 4, background: C.muted_bg, borderRadius: '0.875rem', width: 'fit-content', marginBottom: '1.5rem' }}>
        <TabBtn id="assinaturas" label="Assinaturas" current={tab} onClick={setTab} />
        <TabBtn id="planos" label="Planos" current={tab} onClick={setTab} />
        <TabBtn id="cupons" label="Cupons" current={tab} onClick={setTab} />
      </div>
      {tab === 'assinaturas' && <AssinaturasTab />}
      {tab === 'planos' && <PlanosTab />}
      {tab === 'cupons' && <CuponsTab />}
    </div>
  );
}
