import { useState, useEffect } from 'react';
import { createClient } from '../../lib/supabase';

interface LinkRow {
  id: string;
  owner_id: string;
  owner_name: string;
  owner_email: string | null;
  vet_id: string | null;
  status: 'pending' | 'accepted' | 'rejected';
  requested_at: string;
  note: string | null;
}

interface VetResult { id: string; full_name: string; crmv: string | null; specialty: string | null; }

const C = {
  green: 'hsl(168 83% 29%)',
  greenLight: 'hsl(168 83% 29% / 0.1)',
  fg: 'hsl(var(--foreground))',
  muted: 'hsl(var(--muted-foreground))',
  border: 'hsl(var(--border))',
  card: 'hsl(var(--card))',
  amber: 'hsl(38 92% 45%)',
  amberLight: 'hsl(38 92% 50% / 0.1)',
  red: 'hsl(0 84.2% 55%)',
  redLight: 'hsl(0 84.2% 55% / 0.08)',
};

function AssignPanel({ row, onAssigned }: { row: LinkRow; onAssigned: (id: string) => void }) {
  const [query, setQuery]     = useState('');
  const [results, setResults] = useState<VetResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [msg, setMsg]         = useState<string | null>(null);
  const supabase = createClient();

  async function search() {
    if (query.trim().length < 2) { setMsg('Digite ao menos 2 caracteres.'); return; }
    setSearching(true);
    setMsg(null);
    const { data, error } = await supabase.rpc('search_veterinarios', { p_query: query.trim() });
    setSearching(false);
    if (error || !data || data.length === 0) { setResults([]); setMsg('Nenhum veterinário encontrado.'); return; }
    setResults(data);
  }

  async function assign(vetId: string) {
    setAssigning(true);
    const { error } = await supabase.from('vet_owner_links').update({
      vet_id: vetId, status: 'accepted', assigned_by_admin: true, resolved_at: new Date().toISOString(),
    }).eq('id', row.id);
    setAssigning(false);
    if (error) { setMsg('Falha ao atribuir. Tente novamente.'); return; }
    onAssigned(row.id);
  }

  return (
    <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px dashed ${C.border}`, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
      <input
        type="text" value={query} onChange={e => setQuery(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); search(); } }}
        placeholder="Buscar veterinário (nome ou CRMV) — ex.: Sabrina"
        style={{ flex: 1, minWidth: 200, padding: '0.5rem 0.75rem', borderRadius: '0.5rem', border: `1px solid ${C.border}`, background: 'hsl(var(--background))', color: C.fg, fontSize: '0.8125rem' }}
      />
      <button type="button" onClick={search} disabled={searching}
        style={{ padding: '0.5rem 1rem', borderRadius: '0.5rem', background: C.green, color: '#fff', fontWeight: 600, fontSize: '0.8125rem', border: 'none', cursor: 'pointer' }}>
        {searching ? 'Buscando…' : 'Buscar'}
      </button>
      {msg && <span style={{ fontSize: '0.75rem', color: C.muted, width: '100%' }}>{msg}</span>}
      {results.map(v => (
        <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0.375rem 0.625rem', borderRadius: '0.5rem', background: 'hsl(var(--muted))', width: '100%' }}>
          <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: C.fg, flex: 1 }}>
            {v.full_name} {v.crmv ? `— ${v.crmv}` : ''}
          </span>
          <button type="button" disabled={assigning} onClick={() => assign(v.id)}
            style={{ padding: '0.375rem 0.875rem', borderRadius: '0.5rem', background: C.greenLight, color: C.green, fontWeight: 700, fontSize: '0.75rem', border: 'none', cursor: 'pointer' }}>
            Atribuir
          </button>
        </div>
      ))}
    </div>
  );
}

export default function VinculosAdmin() {
  const [rows, setRows]       = useState<LinkRow[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from('vet_owner_links')
      .select('id, owner_id, owner_name, owner_email, vet_id, status, requested_at, note')
      .or('vet_id.is.null,status.eq.rejected')
      .order('requested_at', { ascending: false });
    setRows((data as any) ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  return (
    <main className="w-full max-w-4xl mx-auto px-4 md:px-8 py-8 space-y-6">
      <div>
        <h1 style={{ fontSize: '1.25rem', fontWeight: 800, letterSpacing: '-0.02em', color: C.fg }}>Vínculos Dono ↔ Veterinário</h1>
        <p style={{ fontSize: '0.875rem', color: C.muted, marginTop: 2 }}>
          Donos sem veterinário encontrado ou com pedido recusado — atribua manualmente (ex.: Sabrina)
        </p>
      </div>

      {loading ? (
        <p style={{ fontSize: '0.875rem', color: C.muted, textAlign: 'center', padding: '2rem' }}>Carregando…</p>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border p-10 flex flex-col items-center text-center gap-2" style={{ borderColor: C.border, borderStyle: 'dashed' }}>
          <p style={{ fontWeight: 700, color: C.fg }}>Nenhuma pendência</p>
          <p style={{ fontSize: '0.875rem', color: C.muted }}>Todos os donos têm um veterinário vinculado ou aguardando resposta.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {rows.map(r => {
            const isRejected = r.status === 'rejected';
            return (
              <div key={r.id} style={{ padding: '1rem 1.125rem', borderRadius: '0.875rem', background: isRejected ? C.redLight : C.amberLight, border: `1px solid ${(isRejected ? C.red : C.amber)}33` }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                  <div>
                    <p style={{ fontSize: '0.9375rem', fontWeight: 700, color: C.fg }}>{r.owner_name}</p>
                    <p style={{ fontSize: '0.75rem', color: C.muted }}>{r.owner_email ?? '—'} · solicitado em {formatDate(r.requested_at)}</p>
                    {r.note && <p style={{ fontSize: '0.75rem', color: C.muted, marginTop: 2, fontStyle: 'italic' }}>{r.note}</p>}
                  </div>
                  <span style={{ fontSize: '0.6875rem', fontWeight: 800, padding: '3px 10px', borderRadius: 999, background: isRejected ? C.red : C.amber, color: '#fff', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>
                    {isRejected ? 'RECUSADO PELO VET' : 'SEM VETERINÁRIO'}
                  </span>
                </div>
                <AssignPanel row={r} onAssigned={id => setRows(prev => prev.filter(x => x.id !== id))} />
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
