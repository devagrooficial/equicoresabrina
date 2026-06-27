import { useState, useEffect } from 'react';
import { createClient } from '../../lib/supabase';
import { maskCpfCnpj, onlyDigits, isValidCPF } from '../../lib/br';

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
  redLight: 'hsl(0 84.2% 55% / 0.08)',
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

const PLAN_FEATURES: Record<string, { name: string; equines: string; storage: string; color: string; bg: string; maxEquines: number; maxStorage: number; price: string }> = {
  free:    { name: 'Gratuito', equines: '2 equinos',    storage: '500 MB',   color: C.muted,                     bg: C.muted_bg,                        maxEquines: 2,     maxStorage: 0.5,  price: 'R$ 0' },
  starter: { name: 'Starter',  equines: '5 equinos',    storage: '2 GB',     color: 'hsl(217 91% 40%)',           bg: 'hsl(217 91% 60% / 0.08)',         maxEquines: 5,     maxStorage: 2,    price: 'R$ 39/mês' },
  pro:     { name: 'Pro',      equines: '15 equinos',   storage: '10 GB',    color: C.green,                     bg: C.greenLight,                      maxEquines: 15,    maxStorage: 10,   price: 'R$ 89/mês' },
  haras:   { name: 'Haras',    equines: 'Ilimitado',    storage: '30 GB',    color: 'hsl(280 60% 40%)',           bg: 'hsl(280 60% 50% / 0.08)',         maxEquines: 9999,  maxStorage: 30,   price: 'R$ 189/mês' },
};

const BR_STATES = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

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

function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button type="button" onClick={onChange} style={{
      width: 44, height: 24, borderRadius: 999, border: 'none', cursor: 'pointer', position: 'relative', padding: 0,
      background: checked ? C.green : 'hsl(var(--muted))', transition: 'background 0.2s', flexShrink: 0,
    }}>
      <div style={{
        width: 18, height: 18, borderRadius: '50%', background: '#fff',
        position: 'absolute', top: 3, left: checked ? 23 : 3, transition: 'left 0.2s',
        boxShadow: '0 1px 3px hsl(0 0% 0% / 0.2)',
      }} />
    </button>
  );
}

// ─── Aba Perfil ────────────────────────────────────────────────────────────────

function ProfileTab({ userId, email }: { userId: string; email: string }) {
  const supabase = createClient();

  const [name, setName]           = useState('');
  const [cpf, setCpf]             = useState('');
  const [phone, setPhone]         = useState('');
  const [farmName, setFarmName]   = useState('');
  const [farmCity, setFarmCity]   = useState('');
  const [farmState, setFarmState] = useState('MT');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [toast, setToast]         = useState<{ ok: boolean; msg: string } | null>(null);

  useEffect(() => {
    async function load() {
      let { data, error } = await supabase
        .from('profiles')
        .select('full_name, cpf, phone, farm_name, farm_city, farm_state, avatar_url, plan')
        .eq('id', userId)
        .single();

      // Coluna cpf ainda não existe (migration vet_module.sql pendente)
      if (error) {
        const retry = await supabase
          .from('profiles')
          .select('full_name, phone, farm_name, farm_city, farm_state, avatar_url, plan')
          .eq('id', userId)
          .single();
        data = retry.data ? { ...retry.data, cpf: null } : null;
      }

      if (data) {
        setName(data.full_name ?? '');
        setCpf(data.cpf ? maskCpfCnpj(data.cpf) : '');
        setPhone(data.phone ?? '');
        setFarmName(data.farm_name ?? '');
        setFarmCity(data.farm_city ?? '');
        setFarmState(data.farm_state ?? 'MT');
        setAvatarUrl(data.avatar_url ?? null);
      }
      setLoading(false);
    }
    load();
  }, [userId]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (cpf && !isValidCPF(cpf)) {
      setToast({ ok: false, msg: 'CPF inválido. Verifique os dígitos.' });
      setTimeout(() => setToast(null), 3000);
      return;
    }
    setSaving(true);
    const basePayload = {
      id: userId,
      full_name: name,
      phone: phone || null,
      farm_name: farmName || null,
      farm_city: farmCity || null,
      farm_state: farmState || null,
    };
    let { error } = await supabase.from('profiles').upsert({
      ...basePayload,
      cpf: cpf ? onlyDigits(cpf) : null,
    });
    // Coluna cpf ainda não existe (migration vet_module.sql pendente)
    if (error && /cpf/i.test(error.message)) {
      ({ error } = await supabase.from('profiles').upsert(basePayload));
    }
    setSaving(false);
    if (error) {
      setToast({ ok: false, msg: 'Erro ao salvar: ' + error.message });
    } else {
      setToast({ ok: true, msg: '✓ Dados salvos com sucesso!' });
    }
    setTimeout(() => setToast(null), 3000);
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setToast({ ok: false, msg: 'Arquivo muito grande. Máx. 5 MB.' });
      setTimeout(() => setToast(null), 3000);
      return;
    }
    const ext = file.name.split('.').pop();
    const path = `${userId}/avatar.${ext}`;
    const { error: uploadError } = await supabase.storage.from('avatars').upload(path, file, { upsert: true });
    if (uploadError) {
      setToast({ ok: false, msg: 'Erro ao enviar foto.' });
      setTimeout(() => setToast(null), 3000);
      return;
    }
    const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
    const publicUrl = urlData.publicUrl + `?t=${Date.now()}`;
    await supabase.from('profiles').upsert({ id: userId, avatar_url: publicUrl });
    setAvatarUrl(publicUrl);
    setToast({ ok: true, msg: '✓ Foto atualizada!' });
    setTimeout(() => setToast(null), 3000);
  }

  if (loading) return <p style={{ color: C.muted, fontSize: '0.875rem', padding: '2rem 0' }}>Carregando…</p>;

  const initials = getInitials(name);

  return (
    <form onSubmit={handleSave}>
      {/* Avatar */}
      <SectionCard title="Foto do perfil">
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {avatarUrl ? (
            <img src={avatarUrl} alt={name} style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: `2px solid ${C.border}` }} />
          ) : (
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'linear-gradient(135deg, hsl(168 83% 32%), hsl(168 83% 20%))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '1.25rem', fontWeight: 800, flexShrink: 0, letterSpacing: '-0.02em' }}>
              {initials}
            </div>
          )}
          <div>
            <label style={{ padding: '0.5rem 1rem', borderRadius: '0.625rem', background: C.muted_bg, color: C.fg, fontWeight: 600, fontSize: '0.8125rem', border: `1px solid ${C.border}`, cursor: 'pointer', display: 'inline-block' }}>
              Alterar foto
              <input type="file" accept="image/jpeg,image/png,image/heic" onChange={handleAvatarChange} style={{ display: 'none' }} />
            </label>
            <p style={{ fontSize: '0.75rem', color: C.muted, marginTop: 4 }}>JPG, PNG ou HEIC. Máx. 5 MB.</p>
          </div>
        </div>
      </SectionCard>

      {/* Dados pessoais */}
      <SectionCard title="Dados pessoais">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.875rem' }}>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={labelStyle}>Nome completo</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Seu nome" style={inputStyle} />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={labelStyle}>E-mail</label>
            <input type="email" value={email} disabled style={{ ...inputStyle, opacity: 0.6, cursor: 'not-allowed' }} />
            <p style={{ fontSize: '0.75rem', color: C.muted, marginTop: 4 }}>Para alterar o e-mail, entre em contato com o suporte.</p>
          </div>
          <div>
            <label style={labelStyle}>Telefone</label>
            <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="(65) 99999-9999" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>CPF</label>
            <input type="text" inputMode="numeric" value={cpf} onChange={e => setCpf(maskCpfCnpj(e.target.value))} placeholder="000.000.000-00" style={inputStyle} />
            <p style={{ fontSize: '0.75rem', color: C.muted, marginTop: 4 }}>
              Usado para associar a você os equinos cadastrados por veterinários.
            </p>
          </div>
        </div>
      </SectionCard>

      {/* Dados do haras */}
      <SectionCard title="Dados do haras / propriedade">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.875rem' }}>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={labelStyle}>Nome do haras</label>
            <input type="text" value={farmName} onChange={e => setFarmName(e.target.value)} placeholder="Haras Santa Clara (opcional)" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Cidade</label>
            <input type="text" value={farmCity} onChange={e => setFarmCity(e.target.value)} placeholder="Cuiabá" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Estado</label>
            <select value={farmState} onChange={e => setFarmState(e.target.value)} style={{ ...inputStyle, appearance: 'auto' }}>
              {BR_STATES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
      </SectionCard>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {toast && (
          <p style={{ fontSize: '0.875rem', fontWeight: 600, color: toast.ok ? C.green : C.redText }}>
            {toast.msg}
          </p>
        )}
        <div style={{ marginLeft: 'auto' }}>
          <button type="submit" disabled={saving} style={{ padding: '0.625rem 1.5rem', borderRadius: '0.75rem', background: saving ? 'hsl(168 83% 40%)' : C.green, color: '#fff', fontWeight: 600, fontSize: '0.875rem', border: 'none', cursor: saving ? 'not-allowed' : 'pointer' }}>
            {saving ? 'Salvando…' : 'Salvar alterações'}
          </button>
        </div>
      </div>
    </form>
  );
}

// ─── Aba Plano ─────────────────────────────────────────────────────────────────

function PlanoTab({ userId }: { userId: string }) {
  const supabase = createClient();
  const [planKey, setPlanKey]       = useState('free');
  const [usedEquines, setUsedEquines] = useState(0);
  const [loading, setLoading]       = useState(true);

  useEffect(() => {
    async function load() {
      const [{ data: profile }, { count }] = await Promise.all([
        supabase.from('profiles').select('plan').eq('id', userId).single(),
        supabase.from('equines').select('id', { count: 'exact', head: true }).eq('owner_id', userId),
      ]);
      if (profile?.plan) setPlanKey(profile.plan);
      setUsedEquines(count ?? 0);
      setLoading(false);
    }
    load();
  }, [userId]);

  if (loading) return <p style={{ color: C.muted, fontSize: '0.875rem', padding: '2rem 0' }}>Carregando…</p>;

  const plan = PLAN_FEATURES[planKey] ?? PLAN_FEATURES.free;
  const equinesPct = planKey === 'haras' ? 0 : Math.min((usedEquines / plan.maxEquines) * 100, 100);

  return (
    <div>
      <SectionCard title="Plano atual">
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 48, height: 48, borderRadius: '0.75rem', background: plan.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${plan.color}33` }}>
              <span style={{ fontSize: '1.25rem', fontWeight: 900, color: plan.color }}>{plan.name[0]}</span>
            </div>
            <div>
              <p style={{ fontSize: '1.25rem', fontWeight: 800, color: C.fg }}>{plan.name}</p>
              <p style={{ fontSize: '0.8125rem', color: C.muted }}>{plan.price} · {plan.equines} · {plan.storage}</p>
            </div>
          </div>
          <a href="/dashboard/assinatura" style={{ padding: '0.5rem 1.25rem', borderRadius: '0.625rem', border: `1px solid ${C.border}`, color: C.fg, fontSize: '0.875rem', fontWeight: 600, textDecoration: 'none', background: C.muted_bg }}>
            Gerenciar plano
          </a>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 20 }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: C.fg }}>Equinos</span>
              <span style={{ fontSize: '0.8125rem', color: C.muted }}>
                {usedEquines} / {planKey === 'haras' ? '∞' : plan.maxEquines}
              </span>
            </div>
            <div style={{ height: 6, borderRadius: 999, background: 'hsl(var(--muted))', overflow: 'hidden' }}>
              <div style={{ height: '100%', borderRadius: 999, width: `${equinesPct}%`, background: equinesPct > 80 ? C.amber : C.green, transition: 'width 0.3s' }} />
            </div>
            <p style={{ fontSize: '0.6875rem', color: C.muted, marginTop: 4 }}>
              {planKey === 'haras' ? 'Ilimitado' : `${equinesPct.toFixed(0)}% utilizado`}
            </p>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Últimas faturas">
        <p style={{ fontSize: '0.8125rem', color: C.muted }}>Histórico de faturas disponível em breve.</p>
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

// ─── Aba Notificações ──────────────────────────────────────────────────────────

function NotificacoesTab() {
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [pushEnabled, setPushEnabled]   = useState(false);
  const [vaccineDays, setVaccineDays]   = useState([30, 15, 7, 3]);
  const [docDays, setDocDays]           = useState([30, 15, 7]);

  function toggleDay(list: number[], set: (v: number[]) => void, day: number) {
    set(list.includes(day) ? list.filter(d => d !== day) : [...list, day].sort((a, b) => b - a));
  }

  return (
    <div>
      <SectionCard title="Canais de notificação">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {[
            { label: 'E-mail', desc: 'Alertas enviados por e-mail', checked: emailEnabled, onChange: () => setEmailEnabled(v => !v) },
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

// ─── Aba Segurança ─────────────────────────────────────────────────────────────

function SegurancaTab() {
  const supabase = createClient();

  const [newPwd, setNewPwd]         = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [saving, setSaving]         = useState(false);
  const [toast, setToast]           = useState<{ ok: boolean; msg: string } | null>(null);

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    if (newPwd.length < 8) {
      setToast({ ok: false, msg: 'A senha deve ter no mínimo 8 caracteres.' });
      setTimeout(() => setToast(null), 3000);
      return;
    }
    if (newPwd !== confirmPwd) {
      setToast({ ok: false, msg: 'As senhas não coincidem.' });
      setTimeout(() => setToast(null), 3000);
      return;
    }
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password: newPwd });
    setSaving(false);
    if (error) {
      setToast({ ok: false, msg: 'Erro: ' + error.message });
    } else {
      setToast({ ok: true, msg: '✓ Senha atualizada com sucesso!' });
      setNewPwd('');
      setConfirmPwd('');
    }
    setTimeout(() => setToast(null), 3000);
  }

  return (
    <div>
      <SectionCard title="Alterar senha">
        <form onSubmit={handlePasswordChange} style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem', maxWidth: 400 }}>
          <div>
            <label style={labelStyle}>Nova senha</label>
            <input type="password" value={newPwd} onChange={e => setNewPwd(e.target.value)} placeholder="Mínimo 8 caracteres" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Confirmar nova senha</label>
            <input type="password" value={confirmPwd} onChange={e => setConfirmPwd(e.target.value)} placeholder="••••••••" style={inputStyle} />
          </div>
          <p style={{ fontSize: '0.75rem', color: C.muted }}>Mínimo 8 caracteres. Use letras, números e símbolos para maior segurança.</p>
          {toast && <p style={{ fontSize: '0.875rem', fontWeight: 600, color: toast.ok ? C.green : C.redText }}>{toast.msg}</p>}
          <button type="submit" disabled={saving} style={{ padding: '0.625rem 1.25rem', borderRadius: '0.625rem', background: saving ? 'hsl(168 83% 40%)' : C.green, color: '#fff', fontWeight: 600, fontSize: '0.875rem', border: 'none', cursor: saving ? 'not-allowed' : 'pointer', width: 'fit-content' }}>
            {saving ? 'Salvando…' : 'Atualizar senha'}
          </button>
        </form>
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

// ─── Root ──────────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const supabase = createClient();
  const [tab, setTab]     = useState<Tab>('perfil');
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail]   = useState('');
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setUserId(data.user.id);
        setEmail(data.user.email ?? '');
      }
      setAuthLoading(false);
    });
  }, []);

  if (authLoading) return null;
  if (!userId) {
    window.location.href = '/login';
    return null;
  }

  return (
    <div style={{ maxWidth: 760, margin: '0 auto' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.25rem', fontWeight: 800, color: C.fg, letterSpacing: '-0.02em' }}>Minha Conta</h1>
        <p style={{ fontSize: '0.8125rem', color: C.muted, marginTop: 2 }}>Gerencie seus dados, plano e configurações</p>
      </div>

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

      {tab === 'perfil'       && <ProfileTab userId={userId} email={email} />}
      {tab === 'plano'        && <PlanoTab userId={userId} />}
      {tab === 'notificacoes' && <NotificacoesTab />}
      {tab === 'seguranca'    && <SegurancaTab />}
    </div>
  );
}
