import { useState, useEffect } from 'react';
import { createClient } from '../../lib/supabase';
import { addMonths } from '../../lib/alertStatus';

function isImageName(name: string | null): boolean {
  return /\.(png|jpe?g|gif|webp|avif|bmp|svg)$/i.test((name || '').split('?')[0]);
}

// Miniatura do anexo: arquivo recém-selecionado ou anexo já salvo
function AttachmentPreview({ file, existingUrl, existingName }: { file: File | null; existingUrl: string | null; existingName: string | null }) {
  const [objUrl, setObjUrl] = useState<string | null>(null);

  useEffect(() => {
    if (file && file.type.startsWith('image/')) {
      const u = URL.createObjectURL(file);
      setObjUrl(u);
      return () => URL.revokeObjectURL(u);
    }
    setObjUrl(null);
  }, [file]);

  const Cm = { green: 'hsl(168 83% 29%)', muted: 'hsl(var(--muted-foreground))', border: 'hsl(var(--border))', red: 'hsl(0 84.2% 55%)', redLight: 'hsl(0 84.2% 55% / 0.1)' };

  // Caso 1: novo arquivo selecionado
  if (file) {
    const isImg = file.type.startsWith('image/');
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
        {isImg && objUrl ? (
          <img src={objUrl} alt={file.name} style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 8, border: `1px solid ${Cm.border}` }} />
        ) : (
          <span style={{ width: 48, height: 48, borderRadius: 8, border: `1px solid ${Cm.border}`, background: Cm.redLight, display: 'flex', alignItems: 'center', justifyContent: 'center', color: Cm.red, fontSize: 10, fontWeight: 700 }}>PDF</span>
        )}
        <span style={{ fontSize: '0.75rem', color: Cm.green, fontWeight: 600 }}>✓ {file.name}</span>
      </span>
    );
  }

  // Caso 2: anexo já salvo
  if (existingUrl) {
    const isImg = isImageName(existingName) || isImageName(existingUrl);
    return (
      <a href={existingUrl} target="_blank" rel="noopener" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
        {isImg ? (
          <img src={existingUrl} alt={existingName || 'Documento'} style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 8, border: `1px solid ${Cm.border}` }} />
        ) : (
          <span style={{ width: 48, height: 48, borderRadius: 8, border: `1px solid ${Cm.border}`, background: Cm.redLight, display: 'flex', alignItems: 'center', justifyContent: 'center', color: Cm.red, fontSize: 10, fontWeight: 700 }}>PDF</span>
        )}
        <span style={{ fontSize: '0.75rem', color: Cm.green, fontWeight: 600 }}>📎 {existingName || 'Documento anexado'}</span>
      </a>
    );
  }

  return null;
}

const C = {
  green: 'hsl(168 83% 29%)',
  greenLight: 'hsl(168 83% 29% / 0.08)',
  fg: 'hsl(var(--foreground))',
  muted: 'hsl(var(--muted-foreground))',
  card: 'hsl(var(--card))',
  border: 'hsl(var(--border))',
  bg: 'hsl(var(--background))',
  red: 'hsl(0 84.2% 55%)',
};

const CATEGORY_THEME: Record<string, { bg: string; color: string }> = {
  Vacina: { bg: 'hsl(168 83% 29% / 0.1)', color: 'hsl(168 83% 29%)' },
  Documento: { bg: 'hsl(220 70% 50% / 0.1)', color: 'hsl(220 70% 45%)' },
  Procedimento: { bg: 'hsl(38 92% 50% / 0.12)', color: 'hsl(38 92% 32%)' },
};

export interface AlertItem {
  id: string;
  name: string;
  category: string;
  description: string | null;
  periodicity_months: number | null;
  attachment_url?: string | null;
  attachment_name?: string | null;
  last_done_at?: string | null;
  status_override?: string | null;
  resolved_at?: string | null;
}

interface ItemState {
  lastDone: string;   // data da última aplicação/exame (itens cíclicos)
  notOwned: boolean;  // "ainda não possui"
  hasIt: boolean;     // "possui" (documentos permanentes, ex.: Resenha Gráfica)
  file: File | null;  // anexo selecionado (PDF ou imagem)
}

function initialState(a: AlertItem): ItemState {
  const isPermanent = !a.periodicity_months;
  return {
    lastDone: a.last_done_at ?? '',
    notOwned: a.status_override === 'NAO_POSSUI',
    hasIt: isPermanent && !!a.resolved_at,
    file: null,
  };
}

export default function HealthSetupForm({ equineId, equineName, alerts }: { equineId: string; equineName: string; alerts: AlertItem[] }) {
  const [state, setState] = useState<Record<string, ItemState>>(() =>
    Object.fromEntries(alerts.map((a) => [a.id, initialState(a)]))
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  function update(id: string, patch: Partial<ItemState>) {
    setState((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  }

  // Faz upload do arquivo para o bucket "docs" e retorna a URL pública
  async function uploadAttachment(alertId: string, file: File): Promise<{ url: string; name: string }> {
    const ext = file.name.split('.').pop() ?? 'bin';
    const path = `${equineId}/${alertId}-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from('docs').upload(path, file, { upsert: true });
    if (upErr) throw upErr;
    const { data } = supabase.storage.from('docs').getPublicUrl(path);
    return { url: data.publicUrl, name: file.name };
  }

  async function handleSave() {
    setSaving(true);
    setError(null);

    try {
      await Promise.all(alerts.map(async (a) => {
        const s = state[a.id];
        const isPermanent = !a.periodicity_months;

        // Upload do anexo (se houver) — vale para qualquer item
        let attachment: { attachment_url: string; attachment_name: string } | {} = {};
        if (s.file) {
          const up = await uploadAttachment(a.id, s.file);
          attachment = { attachment_url: up.url, attachment_name: up.name };
        }

        let payload: Record<string, any>;

        if (s.notOwned) {
          payload = { status_override: 'NAO_POSSUI', due_date: null, last_done_at: null, resolved_at: null };
        } else if (isPermanent) {
          // Documento permanente (ex.: Resenha Gráfica): registra que possui
          payload = s.hasIt
            ? { status_override: null, due_date: null, last_done_at: null, resolved_at: new Date().toISOString() }
            : { status_override: null, due_date: null, last_done_at: null, resolved_at: null };
        } else if (s.lastDone) {
          // Calcula vencimento a partir da última aplicação + periodicidade do template.
          // NÃO marca resolved_at: o status é derivado da data de vencimento (pode estar vencido).
          const due = addMonths(s.lastDone, a.periodicity_months!);
          payload = { last_done_at: s.lastDone, due_date: due, status_override: null, resolved_at: null };
        } else {
          payload = { status_override: null, due_date: null, last_done_at: null, resolved_at: null };
        }

        const { error: updErr } = await supabase.from('equine_alerts')
          .update({ ...payload, ...attachment })
          .eq('id', a.id);
        if (updErr) throw updErr;
      }));
    } catch (e) {
      setSaving(false);
      setError('Erro ao salvar os dados de saúde. Verifique os anexos e tente novamente.');
      return;
    }

    setSaving(false);
    window.location.href = `/dashboard/equino/${equineId}`;
  }

  return (
    <div style={{ maxWidth: 680, margin: '0 auto' }}>
      <style>{`input:focus { outline: none; border-color: ${C.green}; box-shadow: 0 0 0 3px hsl(168 83% 29% / 0.12); }`}</style>

      {/* Header */}
      <div style={{ marginBottom: '1.5rem' }}>
        <a href={`/dashboard/equino/${equineId}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.8125rem', fontWeight: 500, color: C.muted, textDecoration: 'none', marginBottom: '1rem' }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          Voltar ao perfil
        </a>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: C.fg, letterSpacing: '-0.02em' }}>Saúde de {equineName}</h1>
        <p style={{ fontSize: '0.875rem', color: C.muted, marginTop: '0.25rem' }}>
          Edite as vacinas, exames, procedimentos e documentos. O vencimento é calculado a partir da última aplicação/exame.
          Itens sem data ficam <strong>pendentes</strong>.
        </p>
      </div>

      {/* Lista de alertas */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: '1.5rem' }}>
        {alerts.map((a) => {
          const s = state[a.id];
          const theme = CATEGORY_THEME[a.category] ?? CATEGORY_THEME.Procedimento;
          return (
            <div key={a.id} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: '1rem', padding: '1.25rem', opacity: s.notOwned ? 0.6 : 1, transition: 'opacity 0.15s' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: '0.95rem', fontWeight: 700, color: C.fg }}>{a.name}</span>
                    <span style={{ fontSize: '0.625rem', fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: theme.bg, color: theme.color, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {a.category}
                    </span>
                  </div>
                  {a.description && <p style={{ fontSize: '0.75rem', color: C.muted, lineHeight: 1.5 }}>{a.description}</p>}
                </div>
              </div>

              {a.periodicity_months ? (
                /* Item cíclico: data da última aplicação/exame */
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 16 }}>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: C.muted, marginBottom: 5 }}>
                      {a.category === 'Documento' ? 'Data do exame / emissão' : 'Última aplicação'}
                    </label>
                    <input
                      type="date"
                      value={s.lastDone}
                      disabled={s.notOwned}
                      onChange={(e) => update(a.id, { lastDone: e.target.value })}
                      style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '0.625rem', border: `1px solid ${C.border}`, background: C.bg, color: C.fg, fontSize: '0.875rem', boxSizing: 'border-box' }}
                    />
                    {s.lastDone && (
                      <p style={{ fontSize: '0.6875rem', color: C.green, marginTop: 4, fontWeight: 500 }}>
                        Vence em {addMonths(s.lastDone, a.periodicity_months).split('-').reverse().join('/')}
                      </p>
                    )}
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.8125rem', fontWeight: 500, color: C.fg, paddingTop: 18 }}>
                    <input
                      type="checkbox"
                      checked={s.notOwned}
                      onChange={(e) => update(a.id, { notOwned: e.target.checked, lastDone: e.target.checked ? '' : s.lastDone })}
                      style={{ accentColor: C.green, width: 16, height: 16 }}
                    />
                    Ainda não possui
                  </label>
                </div>
              ) : (
                /* Documento permanente: Possui / Não possui */
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  {[
                    { key: 'has', label: 'Possui', active: s.hasIt && !s.notOwned },
                    { key: 'not', label: 'Ainda não possui', active: s.notOwned },
                  ].map((opt) => (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => update(a.id, opt.key === 'has' ? { hasIt: true, notOwned: false } : { hasIt: false, notOwned: true })}
                      style={{ padding: '0.5rem 1rem', borderRadius: '0.625rem', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer', border: `1.5px solid ${opt.active ? C.green : C.border}`, background: opt.active ? C.greenLight : 'transparent', color: opt.active ? C.green : C.muted }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}

              {/* Anexo: PDF ou imagem */}
              {!s.notOwned && (
                <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${C.border}` }}>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: C.muted, marginBottom: 6 }}>
                    Anexar laudo / documento (PDF ou imagem)
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '0.5rem 1rem', borderRadius: '0.625rem', background: C.greenLight, border: `1.5px solid ${C.green}`, color: C.green, fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>
                      {s.file || a.attachment_url ? 'Trocar arquivo' : 'Enviar arquivo'}
                      <input
                        type="file"
                        accept="application/pdf,image/*"
                        onChange={(e) => update(a.id, { file: e.target.files?.[0] ?? null })}
                        style={{ display: 'none' }}
                      />
                    </label>
                    <AttachmentPreview file={s.file} existingUrl={a.attachment_url ?? null} existingName={a.attachment_name ?? null} />
                    {!s.file && !a.attachment_url && (
                      <span style={{ fontSize: '0.75rem', color: C.muted }}>Nenhum arquivo selecionado</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {error && (
        <div style={{ marginBottom: '1rem', padding: '0.75rem 1rem', borderRadius: '0.75rem', background: 'hsl(0 84.2% 55% / 0.08)', border: '1px solid hsl(0 84.2% 55% / 0.25)', fontSize: '0.875rem', color: 'hsl(0 84.2% 40%)' }}>
          {error}
        </div>
      )}

      {/* Ações */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <a href={`/dashboard/equino/${equineId}`} style={{ fontSize: '0.8125rem', fontWeight: 500, color: C.muted, textDecoration: 'none' }}>
          Pular por enquanto
        </a>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          style={{ padding: '0.6875rem 1.75rem', borderRadius: '0.625rem', background: saving ? 'hsl(168 83% 40%)' : C.green, color: '#fff', fontWeight: 700, fontSize: '0.875rem', border: 'none', cursor: saving ? 'not-allowed' : 'pointer' }}
        >
          {saving ? 'Salvando…' : '✓ Salvar e Concluir'}
        </button>
      </div>
    </div>
  );
}
