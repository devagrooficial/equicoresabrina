import { useState } from 'react';

const C = {
  green: 'hsl(168 83% 29%)',
  greenLight: 'hsl(168 83% 29% / 0.08)',
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
};

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '0.5625rem 0.875rem', borderRadius: '0.625rem',
  border: `1px solid ${C.border}`, background: C.bg, color: C.fg,
  fontSize: '0.875rem', outline: 'none', boxSizing: 'border-box',
};

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '0.8125rem', fontWeight: 500, color: C.fg, marginBottom: '0.375rem',
};

type Tab = 'perfil' | 'plano' | 'notificacoes' | 'seguranca';

const TABS: { id: Tab; label: string }[] = [
  { id: 'perfil', label: 'Meu Perfil' },
  { id: 'plano', label: 'Plano e Faturamento' },
  { id: 'notificacoes', label: 'Notificações' },
  { id: 'seguranca', label: 'Segurança' },
];

const PLAN_FEATURES: Record<string, { name: string; equines: string; storage: string; color: string; bg: string }> = {
  free: { name: 'Gratuito', equines: '2 equinos', storage: '500 MB', color: C.muted, bg: C.muted_bg },
  starter: { name: 'Starter', equines: '5 equinos', storage: '2 GB', color: 'hsl(217 91% 40%)', bg: 'hsl(217 91% 60% / 0.08)' },
  pro: { name: 'Pro', equines: '15 equinos', storage: '10 GB', color: C.green, bg: C.greenLight },
  haras: { name: 'Haras', equines: 'Ilimitado', storage: '30 GB', color: 'hsl(280 60% 40%)', bg: 'hsl(280 60% 50% / 0.08)' },
};

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: '1rem', overflow: 'hidden', marginBottom: '1rem' }}>
      <div style={{ padding: '1rem 1.25rem', borderBottom: `1px solid ${C.border}` }}>
        <p style={{ fontSize: '0.875rem', fontWeight: 700, color: C.fg }}>{title}</p>
      </div>
      <div style={{ padding: '1.25rem' }}>{children}</div>
    </div>
  );
}

function ProfileTab() {
  const [name, setName] = useState('Sabrina Santos');
  const [phone, setPhone] = useState('(65) 99123-4567');
  const [farmName, setFarmName] = useState('Haras Santa Clara');
  const [farmCity, setFarmCity] = useState('Cuiabá');
  const [farmState, setFarmState] = useState('MT');
  const [saved, setSaved] = useState(false);

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <form onSubmit={handleSave}>
      {/* Avatar section */}
      <SectionCard title="Foto do perfil">
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'linear-gradient(135deg, hsl(168 83% 32%), hsl(168 83% 20%))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '1.25rem', fontWeight: 800, flexShrink: 0 }}>
            SS
          </div>
          <div>
            <button type="button" style={{ padding: '0.5rem 1rem', borderRadius: '0.625rem', background: C.muted_bg, color: C.fg, fontWeight: 600, fontSize: '0.8125rem', border: `1px solid ${C.border}`, cursor: 'pointer' }}>
              Alterar foto
            </button>
            <p style={{ fontSize: '0.75rem', color: C.muted, marginTop: 4 }}>JPG, PNG ou HEIC. Máx. 5 MB.</p>
          </div>
        </div>
      </SectionCard>

      {/* Personal data */}
      <SectionCard title="Dados pessoais">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.875rem' }}>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={labelStyle}>Nome completo</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} style={inputStyle} />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={labelStyle}>E-mail</label>
            <input type="email" value="sabrina@harasantaclara.com.br" disabled style={{ ...inputStyle, opacity: 0.6, cursor: 'not-allowed' }} />
            <p style={{ fontSize: '0.75rem', color: C.muted, marginTop: 4 }}>Para alterar o e-mail, entre em contato com o suporte.</p>
          </div>
          <div>
            <label style={labelStyle}>Telefone</label>
            <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="(65) 99999-9999" style={inputStyle} />
          </div>
        </div>
      </SectionCard>

      {/* Farm data */}
      <SectionCard title="Dados do haras / propriedade">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.875rem' }}>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={labelStyle}>Nome do haras</label>
            <input type="text" value={farmName} onChange={e => setFarmName(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Cidade</label>
            <input type="text" value={farmCity} onChange={e => setFarmCity(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Estado</label>
            <select value={farmState} onChange={e => setFarmState(e.target.value)} style={{ ...inputStyle, appearance: 'auto' }}>
              {['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'].map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>
      </SectionCard>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {saved && <p style={{ fontSize: '0.875rem', color: C.green, fontWeight: 600 }}>✓ Dados salvos com sucesso!</p>}
        <div style={{ marginLeft: 'auto' }}>
          <button type="submit" style={{ padding: '0.625rem 1.5rem', borderRadius: '0.75rem', background: C.green, color: '#fff', fontWeight: 600, fontSize: '0.875rem', border: 'none', cursor: 'pointer' }}>
            Salvar alterações
          </button>
        </div>
      </div>
    </form>
  );
}

function PlanoTab() {
  const currentPlan = 'pro';
  const plan = PLAN_FEATURES[currentPlan];
  const usedEquines = 6;
  const usedStorage = 3.2;

  return (
    <div>
      {/* Current plan */}
      <SectionCard title="Plano atual">
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 48, height: 48, borderRadius: '0.75rem', background: plan.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${plan.color}33` }}>
              <span style={{ fontSize: '1.25rem', fontWeight: 900, color: plan.color }}>P</span>
            </div>
            <div>
              <p style={{ fontSize: '1.25rem', fontWeight: 800, color: C.fg }}>{plan.name}</p>
              <p style={{ fontSize: '0.8125rem', color: C.muted }}>Faturamento mensal · Próximo vencimento: 24/06/2026</p>
            </div>
          </div>
          <a href="/dashboard/assinatura" style={{ padding: '0.5rem 1.25rem', borderRadius: '0.625rem', border: `1px solid ${C.border}`, color: C.fg, fontSize: '0.875rem', fontWeight: 600, textDecoration: 'none', background: C.muted_bg }}>
            Gerenciar plano
          </a>
        </div>

        {/* Usage */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 20 }}>
          {[
            { label: 'Equinos', used: usedEquines, max: 15, unit: 'equinos', pct: (usedEquines / 15) * 100 },
            { label: 'Armazenamento', used: usedStorage, max: 10, unit: 'GB', pct: (usedStorage / 10) * 100 },
          ].map((u) => (
            <div key={u.label}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: C.fg }}>{u.label}</span>
                <span style={{ fontSize: '0.8125rem', color: C.muted }}>{u.used} / {u.max} {u.unit}</span>
              </div>
              <div style={{ height: 6, borderRadius: 999, background: 'hsl(var(--muted))', overflow: 'hidden' }}>
                <div style={{ height: '100%', borderRadius: 999, width: `${u.pct}%`, background: u.pct > 80 ? C.amber : C.green, transition: 'width 0.3s' }} />
              </div>
              <p style={{ fontSize: '0.6875rem', color: C.muted, marginTop: 4 }}>{u.pct.toFixed(0)}% utilizado</p>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* Invoices */}
      <SectionCard title="Últimas faturas">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {[
            { date: '24/05/2026', amount: 'R$ 89,00', status: 'Pago', id: 'INV-2026-05' },
            { date: '24/04/2026', amount: 'R$ 89,00', status: 'Pago', id: 'INV-2026-04' },
            { date: '24/03/2026', amount: 'R$ 89,00', status: 'Pago', id: 'INV-2026-03' },
          ].map((inv) => (
            <div key={inv.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 0', borderBottom: `1px solid ${C.border}` }}>
              <div>
                <p style={{ fontSize: '0.875rem', fontWeight: 600, color: C.fg }}>{inv.id}</p>
                <p style={{ fontSize: '0.75rem', color: C.muted }}>{inv.date}</p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: '0.875rem', fontWeight: 700, color: C.fg }}>{inv.amount}</span>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '2px 10px', borderRadius: 999, background: 'hsl(142 71% 45% / 0.12)', color: 'hsl(142 71% 28%)' }}>{inv.status}</span>
                <a href="#" style={{ fontSize: '0.75rem', color: C.green, textDecoration: 'none' }}>PDF</a>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      <div style={{ padding: '1rem', borderRadius: '0.75rem', background: C.redLight, border: `1px solid ${C.red}33` }}>
        <p style={{ fontSize: '0.875rem', fontWeight: 700, color: C.redText, marginBottom: 4 }}>Cancelar assinatura</p>
        <p style={{ fontSize: '0.8125rem', color: C.redText }}>Ao cancelar, você manterá acesso até o fim do período atual. Seus dados ficam salvos por 30 dias.</p>
        <button style={{ marginTop: 10, padding: '0.5rem 1rem', borderRadius: '0.625rem', background: 'transparent', border: `1px solid ${C.red}`, color: C.redText, fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer' }}>
          Cancelar assinatura
        </button>
      </div>
    </div>
  );
}

function NotificacoesTab() {
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [vaccineDays, setVaccineDays] = useState([30, 15, 7, 3]);
  const [docDays, setDocDays] = useState([30, 15, 7]);

  function toggleDay(list: number[], set: (v: number[]) => void, day: number) {
    set(list.includes(day) ? list.filter(d => d !== day) : [...list, day].sort((a, b) => b - a));
  }

  const Toggle = ({ checked, onChange }: { checked: boolean; onChange: () => void }) => (
    <button type="button" onClick={onChange} style={{
      width: 44, height: 24, borderRadius: 999, border: 'none', cursor: 'pointer', position: 'relative', padding: 0,
      background: checked ? C.green : 'hsl(var(--muted))', transition: 'background 0.2s',
    }}>
      <div style={{
        width: 18, height: 18, borderRadius: '50%', background: '#fff',
        position: 'absolute', top: 3, left: checked ? 23 : 3, transition: 'left 0.2s',
        boxShadow: '0 1px 3px hsl(0 0% 0% / 0.2)',
      }} />
    </button>
  );

  return (
    <div>
      <SectionCard title="Canais de notificação">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {[
            { label: 'E-mail', desc: 'Alertas enviados para sabrina@harasantaclara.com.br', checked: emailEnabled, onChange: () => setEmailEnabled(v => !v) },
            { label: 'Push / Navegador', desc: 'Notificações no navegador (requer permissão)', checked: pushEnabled, onChange: () => setPushEnabled(v => !v) },
          ].map((item) => (
            <div key={item.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
              <div>
                <p style={{ fontSize: '0.875rem', fontWeight: 600, color: C.fg }}>{item.label}</p>
                <p style={{ fontSize: '0.75rem', color: C.muted }}>{item.desc}</p>
              </div>
              <Toggle checked={item.checked} onChange={item.onChange} />
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Antecedência para vacinas">
        <p style={{ fontSize: '0.8125rem', color: C.muted, marginBottom: 12 }}>Notificar com quantos dias de antecedência:</p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {[60, 30, 15, 7, 3, 1].map(d => (
            <button key={d} type="button" onClick={() => toggleDay(vaccineDays, setVaccineDays, d)}
              style={{ padding: '5px 14px', borderRadius: 999, fontSize: '0.8125rem', fontWeight: 700, border: `1.5px solid ${vaccineDays.includes(d) ? C.green : C.border}`, background: vaccineDays.includes(d) ? C.greenLight : 'transparent', color: vaccineDays.includes(d) ? C.green : C.muted, cursor: 'pointer' }}>
              {d}d
            </button>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Antecedência para documentos">
        <p style={{ fontSize: '0.8125rem', color: C.muted, marginBottom: 12 }}>Notificar com quantos dias de antecedência:</p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {[60, 30, 15, 7, 3].map(d => (
            <button key={d} type="button" onClick={() => toggleDay(docDays, setDocDays, d)}
              style={{ padding: '5px 14px', borderRadius: 999, fontSize: '0.8125rem', fontWeight: 700, border: `1.5px solid ${docDays.includes(d) ? C.green : C.border}`, background: docDays.includes(d) ? C.greenLight : 'transparent', color: docDays.includes(d) ? C.green : C.muted, cursor: 'pointer' }}>
              {d}d
            </button>
          ))}
        </div>
      </SectionCard>

      <button style={{ padding: '0.625rem 1.5rem', borderRadius: '0.75rem', background: C.green, color: '#fff', fontWeight: 600, fontSize: '0.875rem', border: 'none', cursor: 'pointer' }}>
        Salvar preferências
      </button>
    </div>
  );
}

function SegurancaTab() {
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');

  return (
    <div>
      <SectionCard title="Alterar senha">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem', maxWidth: 400 }}>
          {[
            { label: 'Senha atual', value: currentPwd, onChange: setCurrentPwd },
            { label: 'Nova senha', value: newPwd, onChange: setNewPwd },
            { label: 'Confirmar nova senha', value: confirmPwd, onChange: setConfirmPwd },
          ].map((f) => (
            <div key={f.label}>
              <label style={labelStyle}>{f.label}</label>
              <input type="password" value={f.value} onChange={e => f.onChange(e.target.value)} placeholder="••••••••" style={inputStyle} />
            </div>
          ))}
          <p style={{ fontSize: '0.75rem', color: C.muted }}>Mínimo 8 caracteres. Use letras, números e símbolos para maior segurança.</p>
          <button style={{ padding: '0.625rem 1.25rem', borderRadius: '0.625rem', background: C.green, color: '#fff', fontWeight: 600, fontSize: '0.875rem', border: 'none', cursor: 'pointer', width: 'fit-content' }}>
            Atualizar senha
          </button>
        </div>
      </SectionCard>

      <SectionCard title="Sessões ativas">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[
            { device: 'Chrome — macOS', ip: '189.4.xxx.xxx', last: 'Agora mesmo', current: true },
            { device: 'Safari — iPhone 14', ip: '189.4.xxx.xxx', last: 'Há 2 horas', current: false },
          ].map((s) => (
            <div key={s.device} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem', borderRadius: '0.75rem', border: `1px solid ${C.border}`, background: s.current ? C.greenLight : 'transparent' }}>
              <div>
                <p style={{ fontSize: '0.875rem', fontWeight: 600, color: C.fg }}>{s.device}</p>
                <p style={{ fontSize: '0.75rem', color: C.muted }}>IP: {s.ip} · {s.last}</p>
              </div>
              {s.current
                ? <span style={{ fontSize: '0.75rem', fontWeight: 700, color: C.green, background: C.greenLight, padding: '2px 10px', borderRadius: 999 }}>Atual</span>
                : <button style={{ fontSize: '0.75rem', fontWeight: 600, color: C.redText, background: 'transparent', border: 'none', cursor: 'pointer' }}>Encerrar</button>
              }
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Excluir conta">
        <p style={{ fontSize: '0.875rem', color: C.muted, marginBottom: 12 }}>Esta ação é permanente e não pode ser desfeita. Todos os seus dados serão removidos.</p>
        <button style={{ padding: '0.5rem 1.25rem', borderRadius: '0.625rem', background: 'transparent', border: `1px solid ${C.red}`, color: C.redText, fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer' }}>
          Excluir minha conta
        </button>
      </SectionCard>
    </div>
  );
}

export default function ProfilePage() {
  const [tab, setTab] = useState<Tab>('perfil');

  return (
    <div style={{ maxWidth: 760, margin: '0 auto' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.25rem', fontWeight: 800, color: C.fg, letterSpacing: '-0.02em' }}>Minha Conta</h1>
        <p style={{ fontSize: '0.8125rem', color: C.muted, marginTop: 2 }}>Gerencie seus dados, plano e configurações</p>
      </div>

      {/* Tab navigation */}
      <div style={{ display: 'flex', gap: 2, padding: 4, background: C.muted_bg, borderRadius: '0.875rem', marginBottom: '1.5rem', overflowX: 'auto' }}>
        {TABS.map(t => {
          const active = tab === t.id;
          return (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              padding: '7px 16px', borderRadius: '0.625rem', fontSize: '0.8125rem', fontWeight: 600, border: 'none', cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.18s',
              background: active ? C.card : 'transparent', color: active ? C.fg : C.muted,
              boxShadow: active ? '0 1px 4px hsl(0 0% 0% / 0.08)' : 'none',
            }}>
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === 'perfil' && <ProfileTab />}
      {tab === 'plano' && <PlanoTab />}
      {tab === 'notificacoes' && <NotificacoesTab />}
      {tab === 'seguranca' && <SegurancaTab />}
    </div>
  );
}
