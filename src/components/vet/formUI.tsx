import { useState, useEffect } from 'react';
import { UF_LIST } from '../../lib/br';

// Blocos compartilhados dos formulários da área veterinária

export const VET_BLUE       = 'hsl(221 83% 53%)';
export const VET_BLUE_LIGHT = 'hsl(221 83% 53% / 0.08)';

export const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.625rem 0.875rem',
  borderRadius: '0.625rem',
  border: '1px solid hsl(var(--border))',
  background: 'hsl(var(--background))',
  color: 'hsl(var(--foreground))',
  fontSize: '0.875rem',
  outline: 'none',
  boxSizing: 'border-box',
};

export function Field({ label, required, error, hint, children, className }: {
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 500, color: 'hsl(var(--foreground))', marginBottom: '0.375rem' }}>
        {label}{required && ' *'}
        {hint && <span style={{ color: 'hsl(var(--muted-foreground))', fontWeight: 400 }}> ({hint})</span>}
      </label>
      {children}
      {error && <p style={{ fontSize: '0.75rem', color: 'hsl(0 84.2% 55%)', marginTop: '0.25rem' }}>{error}</p>}
    </div>
  );
}

export function Banner({ kind, children }: { kind: 'error' | 'success'; children: React.ReactNode }) {
  const red   = { bg: 'hsl(0 84.2% 55% / 0.08)',  border: 'hsl(0 84.2% 55% / 0.25)',  color: 'hsl(0 84.2% 45%)' };
  const green = { bg: 'hsl(142 71% 45% / 0.08)',  border: 'hsl(142 71% 45% / 0.3)',   color: 'hsl(142 71% 30%)' };
  const t = kind === 'error' ? red : green;
  return (
    <div style={{ marginBottom: '1.25rem', padding: '0.75rem 1rem', borderRadius: '0.625rem', background: t.bg, border: `1px solid ${t.border}`, fontSize: '0.875rem', color: t.color, fontWeight: 500 }}>
      {children}
    </div>
  );
}

export function SubmitButton({ loading, label = 'Salvar' }: { loading: boolean; label?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1.5rem' }}>
      <button
        type="submit"
        disabled={loading}
        style={{
          minWidth: 260, padding: '0.75rem 2rem', borderRadius: '0.625rem',
          background: loading ? 'hsl(221 83% 65%)' : VET_BLUE, color: '#fff',
          fontWeight: 600, fontSize: '0.9375rem', border: 'none',
          cursor: loading ? 'not-allowed' : 'pointer',
        }}
      >
        {loading ? 'Salvando…' : label}
      </button>
    </div>
  );
}

// ─── UF / Cidade (IBGE) ──────────────────────────────────────────────────────

export function useCidades(uf: string) {
  const [cidades, setCidades] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!uf) { setCidades([]); return; }
    let alive = true;
    setLoading(true);
    fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios?orderBy=nome`)
      .then(r => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((rows: Array<{ nome: string }>) => { if (alive) setCidades(rows.map(r => r.nome)); })
      .catch(() => { if (alive) setCidades([]); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [uf]);

  return { cidades, loading };
}

export function UfSelect({ value, onChange }: { value: string; onChange: (uf: string) => void }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)} style={{ ...inputStyle, appearance: 'auto' }}>
      <option value="">Selecione um estado</option>
      {UF_LIST.map(uf => <option key={uf} value={uf}>{uf}</option>)}
    </select>
  );
}

/** Select de cidades do IBGE; vira campo de texto se a API falhar/estiver offline */
export function CidadeSelect({ uf, value, onChange }: { uf: string; value: string; onChange: (city: string) => void }) {
  const { cidades, loading } = useCidades(uf);

  if (!uf || (!loading && cidades.length === 0)) {
    return (
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={uf ? 'Digite a cidade' : 'Selecione a UF primeiro'}
        disabled={!uf}
        style={{ ...inputStyle, opacity: uf ? 1 : 0.6 }}
      />
    );
  }

  return (
    <select value={value} onChange={e => onChange(e.target.value)} disabled={loading} style={{ ...inputStyle, appearance: 'auto' }}>
      <option value="">{loading ? 'Carregando cidades…' : 'Selecione a cidade'}</option>
      {/* mantém valor salvo mesmo que não esteja na lista (ex.: cadastro antigo) */}
      {value && !cidades.includes(value) && <option value={value}>{value}</option>}
      {cidades.map(c => <option key={c} value={c}>{c}</option>)}
    </select>
  );
}

// ─── Cabeçalho de página de cadastro ─────────────────────────────────────────

export function FormCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border p-6 md:p-8"
         style={{ borderColor: 'hsl(var(--border))', background: 'hsl(var(--card))' }}>
      <h1 style={{ fontSize: '1.25rem', fontWeight: 800, letterSpacing: '-0.02em', color: 'hsl(var(--foreground))', marginBottom: subtitle ? '0.25rem' : '1.5rem' }}>
        {title}
      </h1>
      {subtitle && (
        <p style={{ fontSize: '0.875rem', color: 'hsl(var(--muted-foreground))', marginBottom: '1.5rem' }}>{subtitle}</p>
      )}
      {children}
    </div>
  );
}
