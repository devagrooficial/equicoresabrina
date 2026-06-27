import { useState } from 'react';
import { z } from 'zod';
import { createClient } from '../../lib/supabase';

const C = {
  green: 'hsl(168 83% 29%)',
  fg: 'hsl(var(--foreground))',
  muted: 'hsl(var(--muted-foreground))',
  card: 'hsl(var(--card))',
  border: 'hsl(var(--border))',
  bg: 'hsl(var(--background))',
  red: 'hsl(0 84.2% 55%)',
};

const inputBase: React.CSSProperties = {
  width: '100%',
  padding: '0.625rem 0.875rem',
  borderRadius: '0.625rem',
  border: `1px solid ${C.border}`,
  background: C.bg,
  color: C.fg,
  fontSize: '0.875rem',
  outline: 'none',
  boxSizing: 'border-box',
  transition: 'border-color 0.15s',
};

const step2Schema = z.object({
  full_name: z.string().min(3, 'Nome deve ter pelo menos 3 caracteres'),
  email: z.string().email('E-mail inválido'),
  phone: z.string().optional(),
  farm_name: z.string().optional(),
  crmv: z.string().optional(),
  specialty: z.string().optional(),
  password: z.string()
    .min(8, 'Mínimo 8 caracteres')
    .regex(/[a-zA-Z]/, 'Deve conter pelo menos uma letra')
    .regex(/[0-9]/, 'Deve conter pelo menos um número'),
  confirm_password: z.string(),
}).refine((d) => d.password === d.confirm_password, {
  message: 'As senhas não coincidem',
  path: ['confirm_password'],
});

const AUTH_ERRORS: Record<string, string> = {
  user_already_exists:   'Este e-mail já está cadastrado',
  weak_password:         'A senha não atende aos requisitos mínimos',
  email_address_invalid: 'E-mail inválido',
  database_error:        'Erro de banco de dados — a migration do Supabase precisa ser executada. Veja o arquivo supabase/add_role_email_admin.sql.',
};

const PLANS = [
  { id: 'free',    label: 'Gratuito', desc: '2 equinos · 500 MB',     price: 'R$ 0'       },
  { id: 'starter', label: 'Starter',  desc: '5 equinos · 2 GB',       price: 'R$ 39/mês'  },
  { id: 'pro',     label: 'Pro',      desc: '15 equinos · 10 GB',     price: 'R$ 89/mês'  },
  { id: 'haras',   label: 'Haras',    desc: 'Ilimitado · 30 GB',      price: 'R$ 189/mês' },
];

const VET_SPECIALTIES = [
  'Clínica Geral Equina',
  'Cirurgia Equina',
  'Reprodução Equina',
  'Nutrição Equina',
  'Odontologia Equina',
  'Fisioterapia Equina',
  'Diagnóstico por Imagem',
  'Outra',
];

function EyeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/>
    </svg>
  );
}

function HorseIcon() {
  return (
    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 2C11 2 10 3 10 5v2H7L5 9v2l2 1v4l-2 2v2h4v-2l2-1 2 1v2h4v-2l-2-2v-4l2-1V9l-2-2h-3V5c0-2-1-3-1-3z"/>
    </svg>
  );
}

function StethoscopeIcon() {
  return (
    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4.8 2.3A.3.3 0 1 0 5 2H4a2 2 0 0 0-2 2v5a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6V4a2 2 0 0 0-2-2h-1a.2.2 0 1 0 .3.3"/>
      <path d="M8 15v1a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6v-4"/>
      <circle cx="20" cy="10" r="2"/>
    </svg>
  );
}

type Role = 'dono' | 'veterinario';
type Step = 1 | 2 | 3 | 'success';

// Tenta upsert com novas colunas; se falhar (migration não rodou), usa fallback
async function upsertProfile(supabase: ReturnType<typeof import('../../lib/supabase').createClient>, data: {
  id: string; full_name: string | null; phone: string | null;
  farm_name: string | null; plan: string; email: string;
  role: string; admin: boolean; crmv: string | null; specialty: string | null;
}) {
  const { error } = await supabase.from('profiles').upsert({
    id:        data.id,
    full_name: data.full_name,
    phone:     data.phone,
    farm_name: data.farm_name,
    plan:      data.plan,
    email:     data.email,
    role:      data.role,
    admin:     data.admin,
    crmv:      data.crmv,
    specialty: data.specialty,
  });

  if (error) {
    // Novas colunas não existem ainda — usa schema antigo
    await supabase.from('profiles').upsert({
      id:        data.id,
      full_name: data.full_name,
      phone:     data.phone,
      farm_name: data.farm_name,
      plan:      data.plan,
    });
  }
}

export default function RegisterForm() {
  const [step, setStep]             = useState<Step>(1);
  const [role, setRole]             = useState<Role | null>(null);
  const [fullName, setFullName]     = useState('');
  const [email, setEmail]           = useState('');
  const [phone, setPhone]           = useState('');
  const [farmName, setFarmName]     = useState('');
  const [crmv, setCrmv]             = useState('');
  const [specialty, setSpecialty]   = useState('');
  const [password, setPassword]     = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [showPwd, setShowPwd]       = useState(false);
  const [plan, setPlan]             = useState('free');
  const [terms, setTerms]           = useState(false);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [focused, setFocused]       = useState<string | null>(null);
  const [isDark] = useState(() =>
    typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
  );

  const supabase = createClient();

  const fs = (field: string): React.CSSProperties => {
    if (focused === field) return { ...inputBase, border: `1px solid ${C.green}`, boxShadow: `0 0 0 3px hsl(168 83% 29% / 0.12)` };
    if (fieldErrors[field]) return { ...inputBase, border: `1px solid ${C.red}` };
    return inputBase;
  };

  function handleRoleSelect(r: Role) {
    setRole(r);
    setStep(2);
  }

  function handleStep2(e: React.FormEvent) {
    e.preventDefault();
    setFieldErrors({});
    const payload = {
      full_name: fullName, email, phone,
      farm_name: role === 'dono' ? farmName : undefined,
      crmv: role === 'veterinario' ? crmv : undefined,
      specialty: role === 'veterinario' ? specialty : undefined,
      password, confirm_password: confirmPwd,
    };
    const result = step2Schema.safeParse(payload);
    if (!result.success) {
      const errs: Record<string, string> = {};
      const issues = result.error.issues ?? (result.error as any).errors ?? [];
      issues.forEach((e: any) => { if (e.path[0]) errs[e.path[0] as string] = e.message; });
      setFieldErrors(errs);
      return;
    }
    setStep(3);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!terms) return;
    setError(null);
    setLoading(true);

    // Passa apenas os campos que o trigger ANTIGO conhece
    // Os campos novos (role, crmv, specialty) são salvo pelo client após o signup
    const signUpMeta = {
      full_name: fullName,
      phone:     phone || null,
      farm_name: role === 'dono' ? (farmName || null) : null,
      plan:      role === 'dono' ? plan : 'free',
      // Inclui role no metadata para recuperar depois (email confirmation)
      role:      role!,
      crmv:      role === 'veterinario' ? (crmv || null) : null,
      specialty: role === 'veterinario' ? (specialty || null) : null,
    };

    const { data: signUpData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: signUpMeta },
    });

    setLoading(false);

    if (authError) {
      const code = (authError as any).code ?? authError.message;
      setError(AUTH_ERRORS[code] ?? `Erro: ${authError.message}`);
      setStep(2);
      return;
    }

    // Cria o perfil no lado do cliente (não depende do trigger)
    const userId = signUpData?.user?.id;
    const { data: { session } } = await supabase.auth.getSession();

    if (userId) {
      await upsertProfile(supabase, {
        id:        userId,
        full_name: fullName || null,
        phone:     phone || null,
        farm_name: role === 'dono' ? (farmName || null) : null,
        plan:      role === 'dono' ? plan : 'free',
        email,
        role:      role!,
        admin:     false,
        crmv:      role === 'veterinario' ? (crmv || null) : null,
        specialty: role === 'veterinario' ? (specialty || null) : null,
      });
    }

    if (session) {
      window.location.href = role === 'veterinario' ? '/vet' : '/dashboard';
    } else {
      setStep('success');
    }
  }

  const totalSteps = role === 'veterinario' ? 3 : 3;
  const currentStepNum = step === 1 ? 1 : step === 2 ? 2 : step === 3 ? 3 : 3;

  if (step === 'success') {
    return (
      <div style={{ width: '100%', maxWidth: 440, textAlign: 'center' }}>
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: '1.25rem', padding: '2.5rem 2rem' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📧</div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: C.fg, marginBottom: '0.5rem' }}>Verifique seu e-mail</h1>
          <p style={{ fontSize: '0.875rem', color: C.muted, lineHeight: 1.6 }}>
            Enviamos um link de confirmação para <strong style={{ color: C.fg }}>{email}</strong>.
            Clique no link para ativar sua conta.
          </p>
          <p style={{ fontSize: '0.8125rem', color: C.muted, marginTop: '1.25rem' }}>
            Após confirmar, <a href="/login" style={{ color: C.green, fontWeight: 600, textDecoration: 'none' }}>clique aqui para entrar</a>.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', maxWidth: step === 1 ? 520 : 440 }}>
      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <img
          src={isDark ? '/images/logowhite.png' : '/images/logodark.png'}
          alt="EquiCore"
          style={{ height: 36, margin: '0 auto', display: 'block' }}
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
        />
      </div>

      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: '1.25rem', padding: '2rem', boxShadow: '0 4px 24px hsl(0 0% 0% / 0.06)' }}>

        {/* Step indicator */}
        {step !== 1 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '1.5rem' }}>
            {[1, 2, 3].map((s) => (
              <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 8, flex: s < 3 ? 1 : undefined }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.75rem', fontWeight: 700, flexShrink: 0, transition: 'all 0.2s',
                  background: currentStepNum >= s ? C.green : 'hsl(var(--muted))',
                  color: currentStepNum >= s ? '#fff' : C.muted,
                }}>
                  {currentStepNum > s ? '✓' : s}
                </div>
                {s < 3 && <div style={{ flex: 1, height: 2, borderRadius: 2, background: currentStepNum > s ? C.green : 'hsl(var(--muted))', transition: 'background 0.3s' }} />}
              </div>
            ))}
            <span style={{ fontSize: '0.75rem', color: C.muted, marginLeft: 8, whiteSpace: 'nowrap' }}>
              Passo {currentStepNum} de 3
            </span>
          </div>
        )}

        {error && (
          <div style={{ marginBottom: '1.25rem', padding: '0.75rem 1rem', borderRadius: '0.625rem', background: 'hsl(0 84.2% 55% / 0.08)', border: `1px solid hsl(0 84.2% 55% / 0.25)`, fontSize: '0.875rem', color: C.red, fontWeight: 500 }}>
            {error}
          </div>
        )}

        {/* ── Step 1: Seleção de perfil ── */}
        {step === 1 && (
          <>
            <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
              <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: C.fg, letterSpacing: '-0.02em', marginBottom: '0.375rem' }}>
                Quem é você?
              </h1>
              <p style={{ fontSize: '0.875rem', color: C.muted }}>
                Escolha como vai usar o EquiCore
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              {/* Card Dono */}
              <button
                type="button"
                onClick={() => handleRoleSelect('dono')}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  gap: '0.875rem', padding: '2rem 1.25rem', borderRadius: '1rem', cursor: 'pointer',
                  border: `2px solid ${C.border}`, background: C.bg,
                  transition: 'all 0.18s', textAlign: 'center',
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLButtonElement).style.borderColor = C.green;
                  (e.currentTarget as HTMLButtonElement).style.background = 'hsl(168 83% 29% / 0.05)';
                  (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-2px)';
                  (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 16px hsl(168 83% 29% / 0.12)';
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLButtonElement).style.borderColor = C.border;
                  (e.currentTarget as HTMLButtonElement).style.background = C.bg;
                  (e.currentTarget as HTMLButtonElement).style.transform = '';
                  (e.currentTarget as HTMLButtonElement).style.boxShadow = '';
                }}
              >
                <div style={{ width: 64, height: 64, borderRadius: '1rem', background: 'hsl(168 83% 29% / 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.green }}>
                  <HorseIcon />
                </div>
                <div>
                  <p style={{ fontSize: '0.9375rem', fontWeight: 800, color: C.fg, marginBottom: '0.375rem' }}>
                    Dono de Cavalos
                  </p>
                  <p style={{ fontSize: '0.8125rem', color: C.muted, lineHeight: 1.5 }}>
                    Gerencie seu plantel, vacinas, documentos e alertas de saúde
                  </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', fontWeight: 600, color: C.green }}>
                  Começar <span>→</span>
                </div>
              </button>

              {/* Card Veterinário */}
              <button
                type="button"
                onClick={() => handleRoleSelect('veterinario')}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  gap: '0.875rem', padding: '2rem 1.25rem', borderRadius: '1rem', cursor: 'pointer',
                  border: `2px solid ${C.border}`, background: C.bg,
                  transition: 'all 0.18s', textAlign: 'center',
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLButtonElement).style.borderColor = 'hsl(221 83% 53%)';
                  (e.currentTarget as HTMLButtonElement).style.background = 'hsl(221 83% 53% / 0.05)';
                  (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-2px)';
                  (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 16px hsl(221 83% 53% / 0.12)';
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLButtonElement).style.borderColor = C.border;
                  (e.currentTarget as HTMLButtonElement).style.background = C.bg;
                  (e.currentTarget as HTMLButtonElement).style.transform = '';
                  (e.currentTarget as HTMLButtonElement).style.boxShadow = '';
                }}
              >
                <div style={{ width: 64, height: 64, borderRadius: '1rem', background: 'hsl(221 83% 53% / 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'hsl(221 83% 53%)' }}>
                  <StethoscopeIcon />
                </div>
                <div>
                  <p style={{ fontSize: '0.9375rem', fontWeight: 800, color: C.fg, marginBottom: '0.375rem' }}>
                    Médico Veterinário
                  </p>
                  <p style={{ fontSize: '0.8125rem', color: C.muted, lineHeight: 1.5 }}>
                    Acompanhe pacientes, registre atendimentos e monitore a saúde
                  </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', fontWeight: 600, color: 'hsl(221 83% 53%)' }}>
                  Começar <span>→</span>
                </div>
              </button>
            </div>
          </>
        )}

        {/* ── Step 2: Dados pessoais ── */}
        {step === 2 && (
          <>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: C.fg, letterSpacing: '-0.02em', marginBottom: '0.25rem' }}>
              {role === 'dono' ? 'Seus dados' : 'Dados profissionais'}
            </h1>
            <p style={{ fontSize: '0.875rem', color: C.muted, marginBottom: '1.5rem' }}>
              {role === 'dono' ? 'Informações da sua conta e haras' : 'Informações da sua conta profissional'}
            </p>

            <form onSubmit={handleStep2}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.875rem', marginBottom: '0.875rem' }}>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 500, color: C.fg, marginBottom: '0.375rem' }}>Nome completo *</label>
                  <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} onFocus={() => setFocused('full_name')} onBlur={() => setFocused(null)} placeholder="Seu nome completo" style={fs('full_name')} />
                  {fieldErrors.full_name && <p style={{ fontSize: '0.75rem', color: C.red, marginTop: '0.25rem' }}>{fieldErrors.full_name}</p>}
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 500, color: C.fg, marginBottom: '0.375rem' }}>E-mail *</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} onFocus={() => setFocused('email')} onBlur={() => setFocused(null)} placeholder="seu@email.com" style={fs('email')} />
                  {fieldErrors.email && <p style={{ fontSize: '0.75rem', color: C.red, marginTop: '0.25rem' }}>{fieldErrors.email}</p>}
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 500, color: C.fg, marginBottom: '0.375rem' }}>Telefone</label>
                  <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} onFocus={() => setFocused('phone')} onBlur={() => setFocused(null)} placeholder="(65) 99999-9999" style={fs('phone')} />
                </div>

                {role === 'dono' && (
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 500, color: C.fg, marginBottom: '0.375rem' }}>Nome do haras / propriedade</label>
                    <input type="text" value={farmName} onChange={e => setFarmName(e.target.value)} onFocus={() => setFocused('farm_name')} onBlur={() => setFocused(null)} placeholder="Haras Santa Clara (opcional)" style={fs('farm_name')} />
                  </div>
                )}

                {role === 'veterinario' && (
                  <>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 500, color: C.fg, marginBottom: '0.375rem' }}>CRMV</label>
                      <input type="text" value={crmv} onChange={e => setCrmv(e.target.value)} onFocus={() => setFocused('crmv')} onBlur={() => setFocused(null)} placeholder="MT-12345" style={fs('crmv')} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 500, color: C.fg, marginBottom: '0.375rem' }}>Especialidade</label>
                      <select value={specialty} onChange={e => setSpecialty(e.target.value)} onFocus={() => setFocused('specialty')} onBlur={() => setFocused(null)} style={{ ...fs('specialty'), appearance: 'auto' }}>
                        <option value="">Selecione (opcional)</option>
                        {VET_SPECIALTIES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                  </>
                )}

                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 500, color: C.fg, marginBottom: '0.375rem' }}>Senha *</label>
                  <div style={{ position: 'relative' }}>
                    <input type={showPwd ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} onFocus={() => setFocused('password')} onBlur={() => setFocused(null)} placeholder="Mínimo 8 caracteres" style={{ ...fs('password'), paddingRight: '2.75rem' }} />
                    <button type="button" onClick={() => setShowPwd(v => !v)} style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: C.muted, padding: 0, display: 'flex' }}>
                      {showPwd ? <EyeOffIcon /> : <EyeIcon />}
                    </button>
                  </div>
                  {fieldErrors.password && <p style={{ fontSize: '0.75rem', color: C.red, marginTop: '0.25rem' }}>{fieldErrors.password}</p>}
                </div>

                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 500, color: C.fg, marginBottom: '0.375rem' }}>Confirmar senha *</label>
                  <input type="password" value={confirmPwd} onChange={e => setConfirmPwd(e.target.value)} onFocus={() => setFocused('confirm_password')} onBlur={() => setFocused(null)} placeholder="••••••••" style={fs('confirm_password')} />
                  {fieldErrors.confirm_password && <p style={{ fontSize: '0.75rem', color: C.red, marginTop: '0.25rem' }}>{fieldErrors.confirm_password}</p>}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button type="button" onClick={() => setStep(1)} style={{ flex: 1, padding: '0.6875rem', borderRadius: '0.625rem', background: 'hsl(var(--muted))', color: C.fg, fontWeight: 600, fontSize: '0.875rem', border: 'none', cursor: 'pointer' }}>
                  ← Voltar
                </button>
                <button type="submit" style={{ flex: 2, padding: '0.6875rem', borderRadius: '0.625rem', background: C.green, color: '#fff', fontWeight: 600, fontSize: '0.9rem', border: 'none', cursor: 'pointer' }}>
                  Continuar →
                </button>
              </div>
            </form>
          </>
        )}

        {/* ── Step 3: Plano (dono) ou Finalizar (vet) ── */}
        {step === 3 && (
          <>
            {role === 'dono' ? (
              <>
                <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: C.fg, letterSpacing: '-0.02em', marginBottom: '0.25rem' }}>Escolha seu plano</h1>
                <p style={{ fontSize: '0.875rem', color: C.muted, marginBottom: '1.25rem' }}>Você pode mudar depois — comece grátis</p>
              </>
            ) : (
              <>
                <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: C.fg, letterSpacing: '-0.02em', marginBottom: '0.25rem' }}>Quase pronto!</h1>
                <p style={{ fontSize: '0.875rem', color: C.muted, marginBottom: '1.25rem' }}>Aceite os termos para criar sua conta veterinária</p>
              </>
            )}

            <form onSubmit={handleSubmit}>
              {role === 'dono' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem', marginBottom: '1.25rem' }}>
                  {PLANS.map((p) => (
                    <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0.875rem 1rem', borderRadius: '0.75rem', border: `1.5px solid ${plan === p.id ? C.green : C.border}`, background: plan === p.id ? 'hsl(168 83% 29% / 0.06)' : C.bg, cursor: 'pointer', transition: 'all 0.15s' }}>
                      <input type="radio" name="plan" value={p.id} checked={plan === p.id} onChange={() => setPlan(p.id)} style={{ accentColor: C.green, width: 16, height: 16, flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: '0.875rem', fontWeight: 700, color: C.fg }}>{p.label}</p>
                        <p style={{ fontSize: '0.75rem', color: C.muted }}>{p.desc}</p>
                      </div>
                      <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: plan === p.id ? C.green : C.muted }}>{p.price}</span>
                    </label>
                  ))}
                </div>
              )}

              {role === 'veterinario' && (
                <div style={{ marginBottom: '1.25rem', padding: '1rem', borderRadius: '0.75rem', background: 'hsl(221 83% 53% / 0.06)', border: '1px solid hsl(221 83% 53% / 0.2)' }}>
                  <p style={{ fontSize: '0.8125rem', color: 'hsl(221 83% 40%)', fontWeight: 500, lineHeight: 1.6 }}>
                    Sua conta de médico veterinário tem acesso gratuito. Os proprietários poderão compartilhar o plantel com você para que acompanhe a saúde dos equinos.
                  </p>
                </div>
              )}

              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: '1.25rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={terms} onChange={e => setTerms(e.target.checked)} style={{ accentColor: C.green, marginTop: 2, flexShrink: 0 }} />
                <span style={{ fontSize: '0.8125rem', color: C.muted }}>
                  Li e aceito os <a href="#" style={{ color: C.green }}>Termos de Uso</a> e a <a href="#" style={{ color: C.green }}>Política de Privacidade</a>
                </span>
              </label>

              <div style={{ display: 'flex', gap: 10 }}>
                <button type="button" onClick={() => setStep(2)} style={{ flex: 1, padding: '0.6875rem', borderRadius: '0.625rem', background: 'hsl(var(--muted))', color: C.fg, fontWeight: 600, fontSize: '0.875rem', border: 'none', cursor: 'pointer' }}>
                  ← Voltar
                </button>
                <button type="submit" disabled={loading || !terms} style={{ flex: 2, padding: '0.6875rem', borderRadius: '0.625rem', background: loading || !terms ? 'hsl(168 83% 40%)' : C.green, color: '#fff', fontWeight: 600, fontSize: '0.875rem', border: 'none', cursor: loading || !terms ? 'not-allowed' : 'pointer' }}>
                  {loading ? 'Criando conta…' : 'Criar conta'}
                </button>
              </div>
            </form>
          </>
        )}
      </div>

      <p style={{ textAlign: 'center', fontSize: '0.875rem', color: C.muted, marginTop: '1.5rem' }}>
        Já tem uma conta?{' '}
        <a href="/login" style={{ color: C.green, fontWeight: 600, textDecoration: 'none' }}>Entrar</a>
      </p>
    </div>
  );
}
