import { useState, useRef } from 'react';
import { createClient } from '../../lib/supabase';

const C = {
  blue:   'hsl(221 83% 53%)',
  fg:     'hsl(var(--foreground))',
  muted:  'hsl(var(--muted-foreground))',
  card:   'hsl(var(--card))',
  border: 'hsl(var(--border))',
  bg:     'hsl(var(--background))',
  red:    'hsl(0 84.2% 55%)',
};

const inputBase: React.CSSProperties = {
  width: '100%', padding: '0.625rem 0.875rem', borderRadius: '0.625rem',
  border: `1px solid ${C.border}`, background: C.bg, color: C.fg,
  fontSize: '0.875rem', outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.15s',
};

const VET_SPECIALTIES = [
  'Clínica Geral Equina', 'Cirurgia Equina', 'Reprodução Equina',
  'Nutrição Equina', 'Odontologia Equina', 'Fisioterapia Equina',
  'Diagnóstico por Imagem', 'Outra',
];

interface VetProfileProps {
  initialName:     string;
  initialPhone:    string;
  initialEmail:    string;
  initialCrmv:     string;
  initialSpecialty: string;
  avatarUrl:       string | null;
  createdAt:       string;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function VetProfile({
  initialName, initialPhone, initialEmail,
  initialCrmv, initialSpecialty, avatarUrl, createdAt,
}: VetProfileProps) {
  const [tab, setTab]           = useState<'perfil' | 'seguranca'>('perfil');
  const [name, setName]         = useState(initialName);
  const [phone, setPhone]       = useState(initialPhone);
  const [crmv, setCrmv]         = useState(initialCrmv);
  const [specialty, setSpecialty] = useState(initialSpecialty);
  const [avatar, setAvatar]     = useState<string | null>(avatarUrl);
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);
  const [focused, setFocused]   = useState<string | null>(null);
  const [pwdCurrent, setPwdCurrent] = useState('');
  const [pwdNew, setPwdNew]     = useState('');
  const [pwdConfirm, setPwdConfirm] = useState('');
  const [pwdError, setPwdError] = useState('');
  const [pwdSaved, setPwdSaved] = useState(false);
  const [pwdSaving, setPwdSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const fs = (field: string): React.CSSProperties =>
    focused === field
      ? { ...inputBase, border: `1px solid ${C.blue}`, boxShadow: `0 0 0 3px hsl(221 83% 53% / 0.12)` }
      : inputBase;

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }

    await supabase.from('profiles').upsert({
      id: user.id, full_name: name, phone, crmv, specialty,
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const ext  = file.name.split('.').pop();
    const path = `avatars/${user.id}.${ext}`;
    const { error: upErr } = await supabase.storage.from('avatars').upload(path, file, { upsert: true });
    if (upErr) return;

    const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path);
    await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', user.id);
    setAvatar(publicUrl);
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwdError('');
    if (pwdNew !== pwdConfirm) { setPwdError('As senhas não coincidem'); return; }
    if (pwdNew.length < 8)     { setPwdError('Mínimo 8 caracteres'); return; }
    setPwdSaving(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password: pwdNew });
    setPwdSaving(false);
    if (error) { setPwdError(error.message); return; }
    setPwdSaved(true);
    setPwdNew(''); setPwdCurrent(''); setPwdConfirm('');
    setTimeout(() => setPwdSaved(false), 2500);
  }

  const TAB_STYLE = (active: boolean): React.CSSProperties => ({
    padding: '0.5rem 1rem', borderRadius: '0.5rem', fontSize: '0.875rem', fontWeight: 600,
    cursor: 'pointer', border: 'none', background: active ? C.blue : 'transparent',
    color: active ? '#fff' : C.muted, transition: 'all 0.15s',
  });

  return (
    <main style={{ maxWidth: 680, margin: '0 auto', padding: '2rem 1.5rem' }}>

      {/* Avatar + nome */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', marginBottom: '2rem' }}>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          style={{ width: 72, height: 72, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, cursor: 'pointer', border: `2px solid ${C.border}`, background: avatar ? undefined : `linear-gradient(135deg, ${C.blue}, hsl(221 83% 38%))`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '1.25rem', fontWeight: 800, position: 'relative' }}
          title="Alterar foto"
        >
          {avatar
            ? <img src={avatar} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : getInitials(name)
          }
        </button>
        <input ref={fileRef} type="file" accept="image/*" onChange={handleAvatarChange} style={{ display: 'none' }} />
        <div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 800, color: C.fg, marginBottom: '0.25rem' }}>
            {name || 'Veterinário'}
          </h1>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {crmv && (
              <span style={{ fontSize: '0.75rem', fontWeight: 600, padding: '2px 8px', borderRadius: 999, background: `hsl(221 83% 53% / 0.1)`, color: C.blue }}>
                CRMV {crmv}
              </span>
            )}
            {specialty && (
              <span style={{ fontSize: '0.75rem', fontWeight: 500, padding: '2px 8px', borderRadius: 999, background: 'hsl(var(--muted))', color: C.muted }}>
                {specialty}
              </span>
            )}
            <span style={{ fontSize: '0.75rem', color: C.muted }}>
              Médico Veterinário
            </span>
          </div>
          {createdAt && (
            <p style={{ fontSize: '0.75rem', color: C.muted, marginTop: '0.25rem' }}>
              Desde {new Date(createdAt).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
            </p>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: '1.5rem', background: 'hsl(var(--muted))', padding: 4, borderRadius: '0.75rem' }}>
        <button type="button" style={TAB_STYLE(tab === 'perfil')}    onClick={() => setTab('perfil')}>Perfil</button>
        <button type="button" style={TAB_STYLE(tab === 'seguranca')} onClick={() => setTab('seguranca')}>Segurança</button>
      </div>

      {/* Tab: Perfil */}
      {tab === 'perfil' && (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: '1rem', padding: '1.5rem' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 700, color: C.fg, marginBottom: '1.25rem' }}>Informações Profissionais</h2>
          <form onSubmit={handleSave}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.875rem', marginBottom: '1.25rem' }}>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 500, color: C.fg, marginBottom: '0.375rem' }}>Nome completo</label>
                <input type="text" value={name} onChange={e => setName(e.target.value)} onFocus={() => setFocused('name')} onBlur={() => setFocused(null)} placeholder="Dr. João Silva" style={fs('name')} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 500, color: C.fg, marginBottom: '0.375rem' }}>E-mail</label>
                <input type="email" value={initialEmail} readOnly style={{ ...inputBase, background: 'hsl(var(--muted))', cursor: 'not-allowed', color: C.muted }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 500, color: C.fg, marginBottom: '0.375rem' }}>Telefone</label>
                <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} onFocus={() => setFocused('phone')} onBlur={() => setFocused(null)} placeholder="(65) 99999-9999" style={fs('phone')} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 500, color: C.fg, marginBottom: '0.375rem' }}>CRMV</label>
                <input type="text" value={crmv} onChange={e => setCrmv(e.target.value)} onFocus={() => setFocused('crmv')} onBlur={() => setFocused(null)} placeholder="MT-12345" style={fs('crmv')} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 500, color: C.fg, marginBottom: '0.375rem' }}>Especialidade</label>
                <select value={specialty} onChange={e => setSpecialty(e.target.value)} onFocus={() => setFocused('specialty')} onBlur={() => setFocused(null)} style={{ ...fs('specialty'), appearance: 'auto' }}>
                  <option value="">Selecione</option>
                  {VET_SPECIALTIES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button type="submit" disabled={saving} style={{ padding: '0.625rem 1.5rem', borderRadius: '0.625rem', background: saving ? 'hsl(221 83% 60%)' : C.blue, color: '#fff', fontWeight: 600, fontSize: '0.875rem', border: 'none', cursor: saving ? 'not-allowed' : 'pointer' }}>
                {saving ? 'Salvando…' : 'Salvar alterações'}
              </button>
              {saved && <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'hsl(142 71% 35%)' }}>✓ Salvo</span>}
            </div>
          </form>
        </div>
      )}

      {/* Tab: Segurança */}
      {tab === 'seguranca' && (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: '1rem', padding: '1.5rem' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 700, color: C.fg, marginBottom: '1.25rem' }}>Alterar Senha</h2>
          <form onSubmit={handleChangePassword}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem', marginBottom: '1.25rem', maxWidth: 360 }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 500, color: C.fg, marginBottom: '0.375rem' }}>Senha atual</label>
                <input type="password" value={pwdCurrent} onChange={e => setPwdCurrent(e.target.value)} onFocus={() => setFocused('pc')} onBlur={() => setFocused(null)} placeholder="••••••••" style={fs('pc')} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 500, color: C.fg, marginBottom: '0.375rem' }}>Nova senha</label>
                <input type="password" value={pwdNew} onChange={e => setPwdNew(e.target.value)} onFocus={() => setFocused('pn')} onBlur={() => setFocused(null)} placeholder="Mínimo 8 caracteres" style={fs('pn')} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 500, color: C.fg, marginBottom: '0.375rem' }}>Confirmar nova senha</label>
                <input type="password" value={pwdConfirm} onChange={e => setPwdConfirm(e.target.value)} onFocus={() => setFocused('pk')} onBlur={() => setFocused(null)} placeholder="••••••••" style={fs('pk')} />
              </div>
            </div>
            {pwdError && <p style={{ fontSize: '0.8125rem', color: C.red, marginBottom: '0.875rem', fontWeight: 500 }}>{pwdError}</p>}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button type="submit" disabled={pwdSaving} style={{ padding: '0.625rem 1.5rem', borderRadius: '0.625rem', background: pwdSaving ? 'hsl(221 83% 60%)' : C.blue, color: '#fff', fontWeight: 600, fontSize: '0.875rem', border: 'none', cursor: pwdSaving ? 'not-allowed' : 'pointer' }}>
                {pwdSaving ? 'Salvando…' : 'Alterar senha'}
              </button>
              {pwdSaved && <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'hsl(142 71% 35%)' }}>✓ Senha alterada</span>}
            </div>
          </form>
        </div>
      )}

    </main>
  );
}
