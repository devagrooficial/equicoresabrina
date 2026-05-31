import { useState } from 'react';
import { z } from 'zod';
import { createClient } from '../../lib/supabase';

const C = {
  green: 'hsl(168 83% 29%)',
  greenHover: 'hsl(168 83% 24%)',
  fg: 'hsl(var(--foreground))',
  muted: 'hsl(var(--muted-foreground))',
  card: 'hsl(var(--card))',
  border: 'hsl(var(--border))',
  bg: 'hsl(var(--background))',
  input: 'hsl(var(--input))',
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

const schema = z.object({
  email: z.string().email('E-mail inválido'),
  password: z.string().min(1, 'Senha obrigatória'),
});

const AUTH_ERRORS: Record<string, string> = {
  invalid_credentials: 'E-mail ou senha incorretos',
  email_not_confirmed: 'Confirme seu e-mail antes de entrar',
  user_already_exists: 'Este e-mail já está cadastrado',
  weak_password: 'A senha não atende aos requisitos mínimos',
};

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

export default function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [isDark] = useState(() =>
    typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
  );

  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});

    const result = schema.safeParse({ email, password });
    console.log('[LoginForm] validation result:', result);
    if (!result.success) {
      const errs: Record<string, string> = {};
      const issues = result.error.issues ?? (result.error as any).errors ?? [];
      issues.forEach((e: any) => { if (e.path[0]) errs[e.path[0] as string] = e.message; });
      setFieldErrors(errs);
      return;
    }

    setLoading(true);
    const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    console.log('[LoginForm] signIn result — data:', data, 'error:', authError);

    if (authError) {
      const code = (authError as any).code ?? authError.message;
      console.log('[LoginForm] error code:', code);
      setError(AUTH_ERRORS[code] ?? `Erro: ${authError.message}`);
      return;
    }

    window.location.href = '/dashboard';
  }

  const focusStyle = (field: string): React.CSSProperties => {
    const base = { ...inputBase, border: undefined as any };
    if (focusedField === field) return { ...base, border: `1px solid ${C.green}`, boxShadow: `0 0 0 3px hsl(168 83% 29% / 0.12)` };
    if (fieldErrors[field]) return { ...base, border: `1px solid ${C.red}` };
    return inputBase;
  };

  return (
    <div style={{ width: '100%', maxWidth: 400 }}>
      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <img
          src={isDark ? '/logo-white.svg' : '/logo-dark.svg'}
          alt="EquiCore"
          style={{ height: 36, margin: '0 auto', display: 'block' }}
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
        />
      </div>

      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: '1.25rem', padding: '2rem', boxShadow: '0 4px 24px hsl(0 0% 0% / 0.06)' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: C.fg, letterSpacing: '-0.02em', marginBottom: '0.25rem' }}>
          Bem-vindo de volta
        </h1>
        <p style={{ fontSize: '0.875rem', color: C.muted, marginBottom: '1.75rem' }}>
          Entre na sua conta para continuar
        </p>

        {error && (
          <div style={{ marginBottom: '1.25rem', padding: '0.75rem 1rem', borderRadius: '0.625rem', background: 'hsl(0 84.2% 55% / 0.08)', border: `1px solid hsl(0 84.2% 55% / 0.25)`, fontSize: '0.875rem', color: C.red, fontWeight: 500 }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 500, color: C.fg, marginBottom: '0.375rem' }}>
              E-mail
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onFocus={() => setFocusedField('email')}
              onBlur={() => setFocusedField(null)}
              placeholder="seu@email.com"
              required
              autoComplete="email"
              style={focusStyle('email')}
            />
            {fieldErrors.email && <p style={{ fontSize: '0.75rem', color: C.red, marginTop: '0.25rem' }}>{fieldErrors.email}</p>}
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.375rem' }}>
              <label style={{ fontSize: '0.8125rem', fontWeight: 500, color: C.fg }}>Senha</label>
              <a href="/esqueceu-senha" style={{ fontSize: '0.75rem', color: C.green, textDecoration: 'none', fontWeight: 500 }}>
                Esqueceu a senha?
              </a>
            </div>
            <div style={{ position: 'relative' }}>
              <input
                type={showPwd ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onFocus={() => setFocusedField('password')}
                onBlur={() => setFocusedField(null)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
                style={{ ...focusStyle('password'), paddingRight: '2.75rem' }}
              />
              <button
                type="button"
                onClick={() => setShowPwd((v) => !v)}
                aria-label={showPwd ? 'Ocultar senha' : 'Mostrar senha'}
                style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: C.muted, padding: 0, display: 'flex', alignItems: 'center' }}
              >
                {showPwd ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
            {fieldErrors.password && <p style={{ fontSize: '0.75rem', color: C.red, marginTop: '0.25rem' }}>{fieldErrors.password}</p>}
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{ width: '100%', padding: '0.6875rem', borderRadius: '0.625rem', background: loading ? 'hsl(168 83% 35%)' : C.green, color: '#fff', fontWeight: 600, fontSize: '0.9rem', border: 'none', cursor: loading ? 'not-allowed' : 'pointer', transition: 'background 0.15s', letterSpacing: '0.01em' }}
          >
            {loading ? 'Entrando…' : 'Entrar'}
          </button>
        </form>

        <div style={{ margin: '1.5rem 0 0', textAlign: 'center' }}>
          <p style={{ fontSize: '0.875rem', color: C.muted }}>
            Não tem uma conta?{' '}
            <a href="/cadastro" style={{ color: C.green, fontWeight: 600, textDecoration: 'none' }}>
              Criar conta
            </a>
          </p>
        </div>
      </div>

      <p style={{ textAlign: 'center', fontSize: '0.75rem', color: C.muted, marginTop: '1.5rem' }}>
        Ao entrar, você concorda com os{' '}
        <a href="#" style={{ color: C.green, textDecoration: 'none' }}>Termos de Uso</a>
        {' '}e a{' '}
        <a href="#" style={{ color: C.green, textDecoration: 'none' }}>Política de Privacidade</a>.
      </p>
    </div>
  );
}
