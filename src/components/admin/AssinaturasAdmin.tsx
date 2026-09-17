import { useState, useEffect } from 'react';
import { createClient } from '../../lib/supabase';

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

interface SubscriptionRow {
  id: string;
  owner_name: string | null;
  owner_email: string | null;
  farm_name: string | null;
  status: string;
  price_cents: number | null;
  currency: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  created_at: string;
}

interface BillingSettings {
  monthly_price_cents: number;
  currency: string;
  trial_days: number;
  product_name: string;
}

const COUPONS = [
  { id: 'c1', code: 'LANCAMENTO30', type: 'percent', value: 30, uses: 47, maxUses: 100, valid: '31/12/2026', active: true },
  { id: 'c2', code: 'BEMVINDO50', type: 'fixed', value: 50, uses: 12, maxUses: null, valid: '30/06/2026', active: true },
  { id: 'c3', code: 'PARCEIRO20', type: 'percent', value: 20, uses: 89, maxUses: null, valid: '31/12/2026', active: true },
  { id: 'c4', code: 'NATAL2025', type: 'percent', value: 40, uses: 156, maxUses: 200, valid: '31/01/2026', active: false },
];

const subStatusCfg: Record<string, { label: string; bg: string; text: string }> = {
  active:              { label: 'Ativo',              bg: 'hsl(142 71% 45% / 0.12)', text: 'hsl(142 71% 28%)' },
  trialing:            { label: 'Período de teste',   bg: C.blueLight,               text: C.blueText },
  past_due:            { label: 'Em atraso',          bg: C.amberLight,              text: C.amberText },
  unpaid:              { label: 'Não pago',           bg: C.amberLight,              text: C.amberText },
  incomplete:          { label: 'Pendente',           bg: C.amberLight,              text: C.amberText },
  incomplete_expired:  { label: 'Expirado',           bg: C.redLight,                text: C.redText },
  canceled:            { label: 'Cancelado',          bg: C.redLight,                text: C.redText },
};

function formatMoney(cents: number | null, currency: string | null): string {
  if (cents == null) return '—';
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: (currency ?? 'brl').toUpperCase() });
}

function TabBtn({ id, label, current, onClick }: { id: SubTab; label: string; current: SubTab; onClick: (t: SubTab) => void }) {
  const active = id === current;
  return (
    <button onClick={() => onClick(id)} style={{ padding: '8px 18px', borderRadius: '0.625rem', fontSize: '0.875rem', fontWeight: 600, border: 'none', cursor: 'pointer', transition: 'all 0.15s', background: active ? C.card : 'transparent', color: active ? C.fg : C.muted, boxShadow: active ? '0 1px 4px hsl(0 0% 0% / 0.08)' : 'none' }}>
      {label}
    </button>
  );
}

function AssinaturasTab() {
  const supabase = createClient();
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState<SubscriptionRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('subscriptions')
        .select('id, owner_name, owner_email, farm_name, status, price_cents, currency, current_period_end, cancel_at_period_end, created_at')
        .order('created_at', { ascending: false });
      setRows((data as SubscriptionRow[]) ?? []);
      setLoading(false);
    }
    load();
  }, []);

  const filtered = search
    ? rows.filter(s => (s.owner_name ?? '').toLowerCase().includes(search.toLowerCase()) || (s.owner_email ?? '').toLowerCase().includes(search.toLowerCase()))
    : rows;

  const mrr = rows.filter(s => s.status === 'active').reduce((sum, s) => sum + (s.price_cents ?? 0), 0) / 100;
  const activeCount = rows.filter(s => s.status === 'active' || s.status === 'trialing').length;
  const pastDueCount = rows.filter(s => s.status === 'past_due' || s.status === 'unpaid' || s.status === 'incomplete').length;

  if (loading) return <p style={{ color: C.muted, fontSize: '0.875rem', padding: '2rem 0' }}>Carregando…</p>;

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12, marginBottom: '1.25rem' }}>
        {[
          { label: 'MRR', value: mrr.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }), color: C.green, bg: C.greenLight },
          { label: 'Assinaturas Ativas', value: String(activeCount), color: 'hsl(142 71% 28%)', bg: 'hsl(142 71% 45% / 0.12)' },
          { label: 'Em Atraso', value: String(pastDueCount), color: C.amberText, bg: C.amberLight },
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
                {['Assinante', 'Status', 'Valor', 'Próx. cobrança'].map(h => (
                  <th key={h} style={{ textAlign: 'left', fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.muted, padding: '10px 12px', borderBottom: `1px solid ${C.border}`, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ padding: '2rem 12px', textAlign: 'center', color: C.muted, fontSize: '0.8125rem' }}>
                    Nenhuma assinatura ainda.
                  </td>
                </tr>
              )}
              {filtered.map(s => {
                const sc = subStatusCfg[s.status] ?? { label: s.status, bg: C.muted_bg, text: C.muted };
                return (
                  <tr key={s.id} style={{ cursor: 'default' }}>
                    <td style={{ padding: '11px 12px', borderBottom: `1px solid ${C.border}` }}>
                      <p style={{ fontSize: '0.8125rem', fontWeight: 600, color: C.fg }}>{s.owner_name ?? s.farm_name ?? '—'}</p>
                      <p style={{ fontSize: '0.6875rem', color: C.muted }}>{s.owner_email ?? '—'}</p>
                    </td>
                    <td style={{ padding: '11px 12px', borderBottom: `1px solid ${C.border}` }}>
                      <span style={{ fontSize: '0.6875rem', fontWeight: 700, padding: '2px 9px', borderRadius: 999, background: sc.bg, color: sc.text }}>{sc.label}</span>
                      {s.cancel_at_period_end && (
                        <span style={{ marginLeft: 6, fontSize: '0.625rem', color: C.muted }}>cancela ao fim do período</span>
                      )}
                    </td>
                    <td style={{ padding: '11px 12px', borderBottom: `1px solid ${C.border}`, fontSize: '0.875rem', fontWeight: 700, color: C.fg }}>{formatMoney(s.price_cents, s.currency)}</td>
                    <td style={{ padding: '11px 12px', borderBottom: `1px solid ${C.border}`, fontSize: '0.8125rem', color: C.muted }}>
                      {s.current_period_end ? new Date(s.current_period_end).toLocaleDateString('pt-BR') : '—'}
                    </td>
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

function PrecoTab() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [productName, setProductName] = useState('EquiCore Haras');
  const [priceReais, setPriceReais] = useState('0');
  const [trialDays, setTrialDays] = useState('0');

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('billing_settings')
        .select('monthly_price_cents, currency, trial_days, product_name')
        .eq('id', 1)
        .maybeSingle();
      if (data) {
        setProductName(data.product_name);
        setPriceReais((data.monthly_price_cents / 100).toFixed(2));
        setTrialDays(String(data.trial_days));
      }
      setLoading(false);
    }
    load();
  }, []);

  async function save() {
    setSaving(true);
    const cents = Math.round(Number(priceReais.replace(',', '.')) * 100);
    const { error } = await supabase
      .from('billing_settings')
      .update({ monthly_price_cents: cents, trial_days: Number(trialDays), product_name: productName })
      .eq('id', 1);
    setSaving(false);
    if (!error) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    }
  }

  const inputStyle: React.CSSProperties = { width: '100%', border: `1px solid ${C.border}`, borderRadius: 8, padding: '0.5625rem 0.75rem', fontSize: '0.875rem', background: C.bg, color: C.fg, outline: 'none', boxSizing: 'border-box' };

  if (loading) return <p style={{ color: C.muted, fontSize: '0.875rem', padding: '2rem 0' }}>Carregando…</p>;

  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: '1rem', overflow: 'hidden', maxWidth: 480 }}>
      <div style={{ padding: '1.25rem 1.5rem', borderBottom: `1px solid ${C.border}` }}>
        <p style={{ fontSize: '1rem', fontWeight: 800, color: C.fg }}>Valor da assinatura</p>
        <p style={{ fontSize: '0.8125rem', color: C.muted, marginTop: 2 }}>
          Cobrado mensalmente do dono do haras. O veterinário nunca é cobrado.
        </p>
      </div>
      <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <div>
          <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, color: C.fg, marginBottom: 6 }}>Nome do produto</label>
          <input value={productName} onChange={e => setProductName(e.target.value)} style={inputStyle} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, color: C.fg, marginBottom: 6 }}>Preço mensal (R$)</label>
            <input type="number" min="0" step="0.01" value={priceReais} onChange={e => setPriceReais(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, color: C.fg, marginBottom: 6 }}>Dias de teste grátis</label>
            <input type="number" min="0" max="90" value={trialDays} onChange={e => setTrialDays(e.target.value)} style={inputStyle} />
          </div>
        </div>
        <p style={{ fontSize: '0.75rem', color: C.muted }}>
          Assinantes ativos mantêm o valor já contratado — a mudança vale para novas assinaturas a partir de agora.
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={save} disabled={saving} style={{ padding: '0.5625rem 1.25rem', borderRadius: 8, background: C.green, color: '#fff', fontWeight: 700, fontSize: '0.875rem', border: 'none', cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.7 : 1 }}>
            {saving ? 'Salvando…' : 'Salvar'}
          </button>
          {saved && <span style={{ fontSize: '0.8125rem', color: C.green, fontWeight: 600 }}>Salvo</span>}
        </div>
      </div>
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
        <p style={{ fontSize: '0.8125rem', color: C.muted, marginTop: 2 }}>Gerenciamento de assinatura, preço e cupons</p>
      </div>
      <div style={{ display: 'flex', gap: 4, padding: 4, background: C.muted_bg, borderRadius: '0.875rem', width: 'fit-content', marginBottom: '1.5rem' }}>
        <TabBtn id="assinaturas" label="Assinaturas" current={tab} onClick={setTab} />
        <TabBtn id="planos" label="Preço" current={tab} onClick={setTab} />
        <TabBtn id="cupons" label="Cupons" current={tab} onClick={setTab} />
      </div>
      {tab === 'assinaturas' && <AssinaturasTab />}
      {tab === 'planos' && <PrecoTab />}
      {tab === 'cupons' && <CuponsTab />}
    </div>
  );
}
