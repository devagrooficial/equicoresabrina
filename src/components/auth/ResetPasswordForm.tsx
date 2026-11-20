import { useEffect, useState } from 'react';
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

const schema = z.object({
  password: z.string()
    .min(8, 'Mínimo 8 caracteres')
    .regex(/[a-zA-Z]/, 'Deve conter pelo menos uma letra')
    .regex(/[0-9]/, 'Deve conter pelo menos um número'),
  confirm_password: z.string(),
}).refine((d) => d.password === d.confirm_password, {
  message: 'As senhas não coincidem',
  path: ['confirm_password'],
});

type Status = 'checking' | 'ready' | 'invalid' | 'done';

export default function ResetPasswordForm() {
  const [status, setStatus] = useState<Status>('checking');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [focused, setFocused] = useState<string | null>(null);
  const [isDark, setIsDark] = useState(false);
  // Lido após a hidratação: no SSR não há tema, e ler no useState faz o React
  // manter a logo errada (mismatch de hidratação não é corrigido).
  useEffect(() => { setIsDark(document.documentElement.classList.contains('dark')); }, []);

  useEffect(() => {
    const supabase = createClient();
    const url = new URL(window.location.href);
    const hashParams = new URLSearchParams(url.hash.slice(1));

    if (url.searchParams.get('error_description') || hashParams.get('error_description')) {
      setStatus('invalid');
      return;
    }

    (async () => {
      // O client já troca o código do link por uma sessão ao inicializar;
      // getSession() aguarda essa troca terminar.
      let { data: { session } } = await supabase.auth.getSession();

      const code = url.searchParams.get('code');
      if (!session && code) {
        const { data } = await supabase.auth.exchangeCodeForSession(code);
        session = data.session;
      }

      if (code) window.history.replaceState({}, '', '/redefinir-senha');
      setStatus(session ? 'ready' : 'invalid');
    })();
  }, []);

  function fieldStyle(name: string): React.CSSProperties {
    if (focused === name) return { ...inputBase, border: `1px solid ${C.green}`, boxShadow: `0 0 0 3px hsl(168 83% 29% / 0.12)` };
    if (fieldErrors[name]) return { ...inputBase, border: `1px solid ${C.red}` };
    return inputBase;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});

    const result = schema.safeParse({ password, confirm_password: confirmPassword });
    if (!result.success) {
      const errs: Record<string, string> = {};
      result.error.issues.forEach((issue) => { if (issue.path[0]) errs[issue.path[0] as string] = issue.message; });
      setFieldErrors(errs);
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setLoading(false);
      setError(updateError.message.includes('different from the old')
        ? 'A nova senha precisa ser diferente da senha atual.'
        : 'Não foi possível redefinir a senha. Solicite um novo link e tente novamente.');
      return;
    }

    await supabase.auth.signOut();
    setLoading(false);
    setStatus('done');
  }

  const logo = (
    <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
      <img
        src={isDark ? '/images/logowhite.png' : '/images/logodark.png'}
        alt="EquiCore"
        style={{ height: 36, margin: '0 auto', display: 'block' }}
        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
      />
    </div>
  );

  const card: React.CSSProperties = { background: C.card, border: `1px solid ${C.border}`, borderRadius: '1.25rem', padding: '2rem', boxShadow: '0 4px 24px hsl(0 0% 0% / 0.06)' };

  if (status === 'checking') {
    return (
      <div style={{ width: '100%', maxWidth: 400 }}>
        {logo}
        <div style={{ ...card, textAlign: 'center' }}>
          <p style={{ fontSize: '0.875rem', color: C.muted }}>Validando link…</p>
        </div>
      </div>
    );
  }

  if (status === 'invalid') {
    return (
      <div style={{ width: '100%', maxWidth: 400, textAlign: 'center' }}>
        {logo}
        <div style={card}>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: C.fg, marginBottom: '0.5rem' }}>Link inválido ou expirado</h1>
          <p style={{ fontSize: '0.875rem', color: C.muted, lineHeight: 1.6 }}>
            Solicite um novo link de recuperação. Abra o link no mesmo navegador em que fez o pedido.
          </p>
          <a href="/esqueceu-senha" style={{ display: 'inline-block', marginTop: '1.25rem', padding: '0.625rem 1.25rem', borderRadius: '0.625rem', background: C.green, color: '#fff', fontWeight: 600, fontSize: '0.875rem', textDecoration: 'none' }}>
            Solicitar novo link
          </a>
        </div>
      </div>
    );
  }

  if (status === 'done') {
    return (
      <div style={{ width: '100%', maxWidth: 400, textAlign: 'center' }}>
        {logo}
        <div style={card}>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: C.fg, marginBottom: '0.5rem' }}>Senha redefinida</h1>
          <p style={{ fontSize: '0.875rem', color: C.muted, lineHeight: 1.6 }}>
            Sua senha foi alterada com sucesso. Entre novamente com a nova senha.
          </p>
          <a href="/login" style={{ display: 'inline-block', marginTop: '1.25rem', padding: '0.625rem 1.25rem', borderRadius: '0.625rem', background: C.green, color: '#fff', fontWeight: 600, fontSize: '0.875rem', textDecoration: 'none' }}>
            Ir para o login
          </a>
        </div>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', maxWidth: 400 }}>
      {logo}
      <div style={card}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: C.fg, letterSpacing: '-0.02em', marginBottom: '0.25rem' }}>
          Criar nova senha
        </h1>
        <p style={{ fontSize: '0.875rem', color: C.muted, marginBottom: '1.75rem' }}>
          Mínimo de 8 caracteres, com pelo menos uma letra e um número.
        </p>

        {error && (
          <div style={{ marginBottom: '1.25rem', padding: '0.75rem 1rem', borderRadius: '0.625rem', background: 'hsl(0 84.2% 55% / 0.08)', border: '1px solid hsl(0 84.2% 55% / 0.25)', fontSize: '0.875rem', color: C.red, fontWeight: 500 }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 500, color: C.fg, marginBottom: '0.375rem' }}>Nova senha</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              onFocus={() => setFocused('password')} onBlur={() => setFocused(null)}
              placeholder="••••••••" autoComplete="new-password" style={fieldStyle('password')} />
            {fieldErrors.password && <p style={{ fontSize: '0.75rem', color: C.red, marginTop: '0.25rem' }}>{fieldErrors.password}</p>}
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 500, color: C.fg, marginBottom: '0.375rem' }}>Confirmar nova senha</label>
            <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
              onFocus={() => setFocused('confirm_password')} onBlur={() => setFocused(null)}
              placeholder="••••••••" autoComplete="new-password" style={fieldStyle('confirm_password')} />
            {fieldErrors.confirm_password && <p style={{ fontSize: '0.75rem', color: C.red, marginTop: '0.25rem' }}>{fieldErrors.confirm_password}</p>}
          </div>

          <button type="submit" disabled={loading}
            style={{ width: '100%', padding: '0.6875rem', borderRadius: '0.625rem', background: loading ? 'hsl(168 83% 35%)' : C.green, color: '#fff', fontWeight: 600, fontSize: '0.9rem', border: 'none', cursor: loading ? 'not-allowed' : 'pointer' }}>
            {loading ? 'Salvando…' : 'Salvar nova senha'}
          </button>
        </form>
      </div>
    </div>
  );
}
