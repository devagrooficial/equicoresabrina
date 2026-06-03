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

const step1Schema = z.object({
  full_name: z.string().min(3, 'Nome deve ter pelo menos 3 caracteres'),
  email: z.string().email('E-mail inválido'),
  phone: z.string().optional(),
  farm_name: z.string().optional(),
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
  user_already_exists: 'Este e-mail já está cadastrado',
  weak_password: 'A senha não atende aos requisitos mínimos',
  email_address_invalid: 'E-mail inválido',
};

const PLANS = [
  { id: 'free', label: 'Gratuito', desc: '2 equinos · 500 MB', price: 'R$ 0' },
  { id: 'starter', label: 'Starter', desc: '5 equinos · 2 GB', price: 'R$ 39/mês' },
  { id: 'pro', label: 'Pro', desc: '15 equinos · 10 GB', price: 'R$ 89/mês' },
  { id: 'haras', label: 'Haras', desc: 'Ilimitado · 30 GB', price: 'R$ 189/mês' },
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

export default function RegisterForm() {
  const [step, setStep] = useState<1 | 2 | 'success'>(1);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [farmName, setFarmName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [plan, setPlan] = useState('free');
  const [terms, setTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [focused, setFocused] = useState<string | null>(null);
  const [isDark] = useState(() =>
    typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
  );

  const supabase = createClient();

  const fs = (field: string): React.CSSProperties => {
    const base = { ...inputBase, border: undefined as any };
    if (focused === field) return { ...base, border: `1px solid ${C.green}`, boxShadow: `0 0 0 3px hsl(168 83% 29% / 0.12)` };
    if (fieldErrors[field]) return { ...base, border: `1px solid ${C.red}` };
    return inputBase;
  };

  function handleStep1(e: React.FormEvent) {
    e.preventDefault();
    setFieldErrors({});
    const payload = { full_name: fullName, email, phone, farm_name: farmName, password, confirm_password: confirmPwd };
    console.log('[RegisterForm] step1 payload:', payload);
    const result = step1Schema.safeParse(payload);
    console.log('[RegisterForm] validation result:', result);
    if (!result.success) {
      const errs: Record<string, string> = {};
      const issues = result.error.issues ?? (result.error as any).errors ?? [];
      issues.forEach((e: any) => { if (e.path[0]) errs[e.path[0] as string] = e.message; });
      console.log('[RegisterForm] field errors:', errs);
      setFieldErrors(errs);
      return;
    }
    setStep(2);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!terms) return;
    setError(null);
    setLoading(true);

    const { error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, phone: phone || null, farm_name: farmName || null, plan },
      },
    });

    setLoading(false);

    console.log('[RegisterForm] signUp authError:', authError);

    if (authError) {
      const code = (authError as any).code ?? authError.message;
      console.log('[RegisterForm] error code:', code);
      setError(AUTH_ERRORS[code] ?? `Erro: ${authError.message}`);
      setStep(1);
      return;
    }

    // Criar profile manualmente (fallback caso o trigger falhe)
    const { data: { session } } = await supabase.auth.getSession();
    console.log('[RegisterForm] session após signUp:', session);

    if (session) {
      const { error: profileError } = await supabase.from('profiles').upsert({
        id: session.user.id,
        full_name: fullName || null,
        phone: phone || null,
        farm_name: farmName || null,
        plan,
      });
      console.log('[RegisterForm] profile upsert error:', profileError);
      window.location.href = '/dashboard';
    } else {
      setStep('success');
    }
  }

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
    <div style={{ width: '100%', maxWidth: 440 }}>
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '1.5rem' }}>
          {[1, 2].map((s) => (
            <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 8, flex: s < 2 ? 1 : undefined }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700, background: step >= s ? C.green : 'hsl(var(--muted))', color: step >= s ? '#fff' : C.muted, transition: 'all 0.2s', flexShrink: 0 }}>
                {(s < (step === 'success' ? 3 : step)) ? '✓' : s}
              </div>
              {s < 2 && <div style={{ flex: 1, height: 2, borderRadius: 2, background: step > s ? C.green : 'hsl(var(--muted))', transition: 'background 0.3s' }} />}
            </div>
          ))}
          <span style={{ fontSize: '0.75rem', color: C.muted, marginLeft: 8 }}>Passo {step} de 2</span>
        </div>

        {error && (
          <div style={{ marginBottom: '1.25rem', padding: '0.75rem 1rem', borderRadius: '0.625rem', background: 'hsl(0 84.2% 55% / 0.08)', border: `1px solid hsl(0 84.2% 55% / 0.25)`, fontSize: '0.875rem', color: C.red, fontWeight: 500 }}>
            {error}
          </div>
        )}

        {step === 1 && (
          <>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: C.fg, letterSpacing: '-0.02em', marginBottom: '0.25rem' }}>Criar sua conta</h1>
            <p style={{ fontSize: '0.875rem', color: C.muted, marginBottom: '1.5rem' }}>Dados pessoais e do haras</p>

            <form onSubmit={handleStep1}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.875rem', marginBottom: '0.875rem' }}>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 500, color: C.fg, marginBottom: '0.375rem' }}>Nome completo *</label>
                  <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} onFocus={() => setFocused('name')} onBlur={() => setFocused(null)} placeholder="Sabrina Santos" style={fs('full_name')} />
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
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 500, color: C.fg, marginBottom: '0.375rem' }}>Nome do haras / propriedade</label>
                  <input type="text" value={farmName} onChange={e => setFarmName(e.target.value)} onFocus={() => setFocused('farm')} onBlur={() => setFocused(null)} placeholder="Haras Santa Clara (opcional)" style={fs('farm_name')} />
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 500, color: C.fg, marginBottom: '0.375rem' }}>Senha *</label>
                  <div style={{ position: 'relative' }}>
                    <input type={showPwd ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} onFocus={() => setFocused('pwd')} onBlur={() => setFocused(null)} placeholder="Mínimo 8 caracteres" style={{ ...fs('password'), paddingRight: '2.75rem' }} />
                    <button type="button" onClick={() => setShowPwd(v => !v)} style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: C.muted, padding: 0, display: 'flex' }}>
                      {showPwd ? <EyeOffIcon /> : <EyeIcon />}
                    </button>
                  </div>
                  {fieldErrors.password && <p style={{ fontSize: '0.75rem', color: C.red, marginTop: '0.25rem' }}>{fieldErrors.password}</p>}
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 500, color: C.fg, marginBottom: '0.375rem' }}>Confirmar senha *</label>
                  <input type="password" value={confirmPwd} onChange={e => setConfirmPwd(e.target.value)} onFocus={() => setFocused('confirm')} onBlur={() => setFocused(null)} placeholder="••••••••" style={fs('confirm_password')} />
                  {fieldErrors.confirm_password && <p style={{ fontSize: '0.75rem', color: C.red, marginTop: '0.25rem' }}>{fieldErrors.confirm_password}</p>}
                </div>
              </div>

              <button type="submit" style={{ width: '100%', padding: '0.6875rem', borderRadius: '0.625rem', background: C.green, color: '#fff', fontWeight: 600, fontSize: '0.9rem', border: 'none', cursor: 'pointer' }}>
                Continuar →
              </button>
            </form>
          </>
        )}

        {step === 2 && (
          <>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: C.fg, letterSpacing: '-0.02em', marginBottom: '0.25rem' }}>Escolha seu plano</h1>
            <p style={{ fontSize: '0.875rem', color: C.muted, marginBottom: '1.25rem' }}>Você pode mudar depois — comece grátis</p>

            <form onSubmit={handleSubmit}>
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

              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: '1.25rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={terms} onChange={e => setTerms(e.target.checked)} style={{ accentColor: C.green, marginTop: 2 }} />
                <span style={{ fontSize: '0.8125rem', color: C.muted }}>
                  Li e aceito os <a href="#" style={{ color: C.green }}>Termos de Uso</a> e a <a href="#" style={{ color: C.green }}>Política de Privacidade</a>
                </span>
              </label>

              <div style={{ display: 'flex', gap: 10 }}>
                <button type="button" onClick={() => setStep(1)} style={{ flex: 1, padding: '0.6875rem', borderRadius: '0.625rem', background: 'hsl(var(--muted))', color: C.fg, fontWeight: 600, fontSize: '0.875rem', border: 'none', cursor: 'pointer' }}>
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
