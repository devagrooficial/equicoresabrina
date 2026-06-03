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
});

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [focused, setFocused] = useState(false);
  const [sent, setSent] = useState(false);
  const [isDark] = useState(() =>
    typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
  );

  const supabase = createClient();

  const inputStyle: React.CSSProperties = focused
    ? { ...inputBase, border: `1px solid ${C.green}`, boxShadow: `0 0 0 3px hsl(168 83% 29% / 0.12)` }
    : fieldErrors.email
    ? { ...inputBase, border: `1px solid ${C.red}` }
    : inputBase;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});

    const result = schema.safeParse({ email });
    if (!result.success) {
      const errs: Record<string, string> = {};
      result.error.issues.forEach((issue) => { if (issue.path[0]) errs[issue.path[0] as string] = issue.message; });
      setFieldErrors(errs);
      return;
    }

    setLoading(true);
    const { error: authError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/redefinir-senha`,
    });
    setLoading(false);

    if (authError) {
      setError(`Erro: ${authError.message}`);
      return;
    }

    setSent(true);
  }

  if (sent) {
    return (
      <div style={{ width: '100%', maxWidth: 400, textAlign: 'center' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <img
            src={isDark ? '/images/logowhite.png' : '/images/logodark.png'}
            alt="EquiCore"
            style={{ height: 36, margin: '0 auto', display: 'block' }}
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
          />
        </div>
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: '1.25rem', padding: '2.5rem 2rem', boxShadow: '0 4px 24px hsl(0 0% 0% / 0.06)' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📧</div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: C.fg, marginBottom: '0.5rem' }}>Verifique seu e-mail</h1>
          <p style={{ fontSize: '0.875rem', color: C.muted, lineHeight: 1.6 }}>
            Enviamos as instruções de recuperação para{' '}
            <strong style={{ color: C.fg }}>{email}</strong>.
          </p>
          <p style={{ fontSize: '0.8125rem', color: C.muted, marginTop: '1.25rem' }}>
            <a href="/login" style={{ color: C.green, fontWeight: 600, textDecoration: 'none' }}>← Voltar para o login</a>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', maxWidth: 400 }}>
      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <img
          src={isDark ? '/images/logowhite.png' : '/images/logodark.png'}
          alt="EquiCore"
          style={{ height: 36, margin: '0 auto', display: 'block' }}
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
        />
      </div>

      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: '1.25rem', padding: '2rem', boxShadow: '0 4px 24px hsl(0 0% 0% / 0.06)' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: C.fg, letterSpacing: '-0.02em', marginBottom: '0.25rem' }}>
          Recuperar senha
        </h1>
        <p style={{ fontSize: '0.875rem', color: C.muted, marginBottom: '1.75rem' }}>
          Digite seu e-mail e enviaremos um link para redefinir sua senha.
        </p>

        {error && (
          <div style={{ marginBottom: '1.25rem', padding: '0.75rem 1rem', borderRadius: '0.625rem', background: 'hsl(0 84.2% 55% / 0.08)', border: `1px solid hsl(0 84.2% 55% / 0.25)`, fontSize: '0.875rem', color: C.red, fontWeight: 500 }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 500, color: C.fg, marginBottom: '0.375rem' }}>
              E-mail
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              placeholder="seu@email.com"
              required
              autoComplete="email"
              style={inputStyle}
            />
            {fieldErrors.email && <p style={{ fontSize: '0.75rem', color: C.red, marginTop: '0.25rem' }}>{fieldErrors.email}</p>}
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{ width: '100%', padding: '0.6875rem', borderRadius: '0.625rem', background: loading ? 'hsl(168 83% 35%)' : C.green, color: '#fff', fontWeight: 600, fontSize: '0.9rem', border: 'none', cursor: loading ? 'not-allowed' : 'pointer', transition: 'background 0.15s', letterSpacing: '0.01em' }}
          >
            {loading ? 'Enviando…' : 'Enviar link de recuperação'}
          </button>
        </form>

        <div style={{ margin: '1.5rem 0 0', textAlign: 'center' }}>
          <a href="/login" style={{ fontSize: '0.875rem', color: C.green, fontWeight: 600, textDecoration: 'none' }}>
            ← Voltar para o login
          </a>
        </div>
      </div>
    </div>
  );
}
