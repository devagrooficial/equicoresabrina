import { useState, useEffect } from 'react';
import { createClient } from '../../lib/supabase';
import { VET_BLUE, VET_BLUE_LIGHT } from './formUI';

interface LinkRow {
  id: string;
  owner_id: string;
  requested_at: string;
  ownerName: string;
  ownerEmail: string | null;
}

const C = {
  fg: 'hsl(var(--foreground))',
  muted: 'hsl(var(--muted-foreground))',
  card: 'hsl(var(--card))',
  border: 'hsl(var(--border))',
  green: 'hsl(142 71% 35%)',
  greenLight: 'hsl(142 71% 35% / 0.1)',
  red: 'hsl(0 84.2% 55%)',
  redLight: 'hsl(0 84.2% 55% / 0.1)',
};

export default function VetVinculos() {
  const [rows, setRows]       = useState<LinkRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);

  const supabase = createClient();

  async function load() {
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase
      .from('vet_owner_links')
      .select('id, owner_id, requested_at, owner_name, owner_email')
      .eq('status', 'pending')
      .order('requested_at', { ascending: false });

    if (err) {
      console.error('[VetVinculos] erro ao carregar:', err);
      setError('Não foi possível carregar os pedidos de vínculo.');
      setLoading(false);
      return;
    }

    setRows((data ?? []).map((r: any) => ({
      id: r.id,
      owner_id: r.owner_id,
      requested_at: r.requested_at,
      ownerName: r.owner_name ?? 'Proprietário',
      ownerEmail: r.owner_email ?? null,
    })));
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function respond(id: string, status: 'accepted' | 'rejected') {
    setActingId(id);
    const { error: err } = await supabase
      .from('vet_owner_links')
      .update({ status, resolved_at: new Date().toISOString() })
      .eq('id', id);
    setActingId(null);
    if (err) {
      alert('Não foi possível registrar sua resposta. Tente novamente.');
      return;
    }
    setRows(prev => prev.filter(r => r.id !== id));
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  return (
    <main className="w-full max-w-4xl mx-auto px-4 md:px-8 py-8 space-y-6">
      <div>
        <h1 style={{ fontSize: '1.25rem', fontWeight: 800, letterSpacing: '-0.02em', color: C.fg }}>Vínculos com Proprietários</h1>
        <p style={{ fontSize: '0.875rem', color: C.muted, marginTop: 2 }}>
          Donos que solicitaram você como veterinário de confiança
        </p>
      </div>

      {error && (
        <div style={{ padding: '0.75rem 1rem', borderRadius: '0.625rem', background: 'hsl(0 84.2% 55% / 0.08)', border: '1px solid hsl(0 84.2% 55% / 0.25)', fontSize: '0.875rem', color: 'hsl(0 84.2% 45%)', fontWeight: 500 }}>
          {error}
        </div>
      )}

      {loading ? (
        <p style={{ fontSize: '0.875rem', color: C.muted, textAlign: 'center', padding: '2rem' }}>Carregando…</p>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border p-10 flex flex-col items-center text-center gap-2" style={{ borderColor: C.border, borderStyle: 'dashed' }}>
          <p style={{ fontWeight: 700, color: C.fg }}>Nenhum pedido pendente</p>
          <p style={{ fontSize: '0.875rem', color: C.muted }}>Pedidos de vínculo de novos proprietários aparecem aqui.</p>
        </div>
      ) : (
        <div className="rounded-2xl border overflow-hidden" style={{ borderColor: C.border, background: C.card }}>
          {rows.map((r, i) => (
            <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '1rem 1.25rem', borderBottom: i < rows.length - 1 ? `1px solid ${C.border}` : 'none', flexWrap: 'wrap' }}>
              <div style={{ width: 38, height: 38, borderRadius: '50%', background: VET_BLUE_LIGHT, color: VET_BLUE, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.875rem', flexShrink: 0 }}>
                {r.ownerName.slice(0, 1).toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 160 }}>
                <p style={{ fontSize: '0.9375rem', fontWeight: 700, color: C.fg }}>{r.ownerName}</p>
                <p style={{ fontSize: '0.75rem', color: C.muted }}>
                  {r.ownerEmail ?? '—'} · solicitado em {formatDate(r.requested_at)}
                </p>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" disabled={actingId === r.id} onClick={() => respond(r.id, 'accepted')}
                  style={{ padding: '0.5rem 1rem', borderRadius: '0.625rem', background: C.greenLight, color: C.green, fontWeight: 700, fontSize: '0.8125rem', border: 'none', cursor: 'pointer' }}>
                  Aceitar
                </button>
                <button type="button" disabled={actingId === r.id} onClick={() => respond(r.id, 'rejected')}
                  style={{ padding: '0.5rem 1rem', borderRadius: '0.625rem', background: C.redLight, color: C.red, fontWeight: 700, fontSize: '0.8125rem', border: 'none', cursor: 'pointer' }}>
                  Recusar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
