import { useState, useEffect, useMemo } from 'react';
import { createClient, resolveDocUrl } from '../../lib/supabase';
import { maskCpfCnpj } from '../../lib/br';
import { VET_BLUE, VET_BLUE_LIGHT, inputStyle } from './formUI';

// Listagem central da área veterinária: Equinos, Proprietários e Propriedades.
// Mostra apenas os registros do próprio veterinário (RLS).

type Tab = 'equinos' | 'proprietarios' | 'propriedades';

interface EquineRow {
  id: string;
  name: string;
  species: string | null;
  breed: string | null;
  sex: string | null;
  registry_brand: string | null;
  chip: string | null;
  resenha_url: string | null;
  shared_with_owner: boolean;
  created_at: string;
  owner: { name: string; cpf_cnpj: string } | null;
  property: { name: string } | null;
}

interface OwnerRow {
  id: string;
  name: string;
  cpf_cnpj: string;
  phone: string | null;
  email: string | null;
  city: string | null;
  uf: string | null;
  producer_number: string | null;
}

interface PropertyRow {
  id: string;
  name: string;
  city: string | null;
  uf: string | null;
  classification: string | null;
  oesa_code: string | null;
  animal_count: number | null;
}

const TABS: { key: Tab; label: string }[] = [
  { key: 'equinos',       label: 'Equinos' },
  { key: 'proprietarios', label: 'Proprietários' },
  { key: 'propriedades',  label: 'Propriedades' },
];

const NEW_LINKS: Record<Tab, { href: string; label: string }> = {
  equinos:       { href: '/vet/cadastros/equino',       label: 'Novo Animal' },
  proprietarios: { href: '/vet/cadastros/proprietario', label: 'Novo Proprietário' },
  propriedades:  { href: '/vet/cadastros/propriedade',  label: 'Nova Propriedade' },
};

const EDIT_LINKS: Record<Tab, string> = {
  equinos:       '/vet/cadastros/equino?id=',
  proprietarios: '/vet/cadastros/proprietario?id=',
  propriedades:  '/vet/cadastros/propriedade?id=',
};

const TABLES: Record<Tab, string> = {
  equinos:       'vet_equines',
  proprietarios: 'vet_owners',
  propriedades:  'vet_properties',
};

function PencilIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/></svg>;
}
function TrashIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>;
}
function ImageIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>;
}
function ShareOnIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>;
}

function ActionButton({ title, color, onClick, href, children }: {
  title: string; color: string; onClick?: () => void; href?: string; children: React.ReactNode;
}) {
  const style: React.CSSProperties = {
    width: 30, height: 30, borderRadius: '50%', display: 'inline-flex',
    alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
    background: `${color.replace(')', ' / 0.12)')}`, color, border: 'none', flexShrink: 0,
  };
  if (href) return <a href={href} title={title} style={{ ...style, textDecoration: 'none' }}>{children}</a>;
  return <button type="button" title={title} onClick={onClick} style={style}>{children}</button>;
}

export default function VetRegistros({ initialTab }: { initialTab?: string | null }) {
  const startTab: Tab = (TABS.some(t => t.key === initialTab) ? initialTab : 'equinos') as Tab;

  const [tab, setTab]               = useState<Tab>(startTab);
  const [equinos, setEquinos]       = useState<EquineRow[]>([]);
  const [owners, setOwners]         = useState<OwnerRow[]>([]);
  const [properties, setProperties] = useState<PropertyRow[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);
  const [search, setSearch]         = useState('');
  const [pageSize, setPageSize]     = useState(10);
  const [page, setPage]             = useState(0);

  const supabase = createClient();

  async function loadAll() {
    setLoading(true);
    setError(null);
    const [eq, ow, pr] = await Promise.all([
      supabase
        .from('vet_equines')
        .select('id, name, species, breed, sex, registry_brand, chip, resenha_url, shared_with_owner, created_at, owner:vet_owners(name, cpf_cnpj), property:vet_properties(name)')
        .order('created_at', { ascending: false }),
      supabase
        .from('vet_owners')
        .select('id, name, cpf_cnpj, phone, email, city, uf, producer_number')
        .order('name'),
      supabase
        .from('vet_properties')
        .select('id, name, city, uf, classification, oesa_code, animal_count')
        .order('name'),
    ]);

    const firstError = eq.error ?? ow.error ?? pr.error;
    if (firstError) {
      console.error('[VetRegistros] erro ao carregar:', firstError);
      setError('Não foi possível carregar os registros. Tente novamente.');
    }
    setEquinos((eq.data as any) ?? []);
    setOwners((ow.data as any) ?? []);
    setProperties((pr.data as any) ?? []);
    setLoading(false);
  }

  useEffect(() => { loadAll(); }, []);

  function switchTab(t: Tab) {
    setTab(t);
    setSearch('');
    setPage(0);
    history.replaceState(null, '', `/vet/registros?tab=${t}`);
  }

  async function toggleShare(equine: EquineRow) {
    const next = !equine.shared_with_owner;
    const { error: err } = await supabase
      .from('vet_equines')
      .update({ shared_with_owner: next })
      .eq('id', equine.id);
    if (err) {
      console.error('[VetRegistros] erro ao atualizar compartilhamento:', err);
      alert('Não foi possível alterar o compartilhamento. Tente novamente.');
      return;
    }
    setEquinos(prev => prev.map(e => e.id === equine.id ? { ...e, shared_with_owner: next } : e));
  }

  async function openResenha(resenhaUrl: string) {
    try {
      const signedUrl = await resolveDocUrl(resenhaUrl);
      window.open(signedUrl, '_blank', 'noopener,noreferrer');
    } catch {
      alert('Não foi possível abrir a resenha. Tente novamente.');
    }
  }

  async function handleDelete(id: string, label: string) {
    if (!confirm(`Excluir "${label}"? Esta ação não pode ser desfeita.`)) return;
    const { error: err } = await supabase.from(TABLES[tab]).delete().eq('id', id);
    if (err) {
      console.error('[VetRegistros] erro ao excluir:', err);
      if (err.code === '23503') {
        alert('Este proprietário possui equinos associados. Exclua ou reatribua os equinos primeiro.');
      } else {
        alert('Não foi possível excluir o registro. Tente novamente.');
      }
      return;
    }
    loadAll();
  }

  // Linhas filtradas pela busca, por aba
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const match = (...vals: (string | null | undefined)[]) =>
      !q || vals.some(v => (v ?? '').toLowerCase().includes(q));

    if (tab === 'equinos') {
      return equinos.filter(r => match(r.name, r.owner?.name, r.owner?.cpf_cnpj, r.breed, r.chip, r.registry_brand, r.property?.name));
    }
    if (tab === 'proprietarios') {
      return owners.filter(r => match(r.name, r.cpf_cnpj, maskCpfCnpj(r.cpf_cnpj), r.email, r.phone, r.city));
    }
    return properties.filter(r => match(r.name, r.city, r.uf, r.classification, r.oesa_code));
  }, [tab, search, equinos, owners, properties]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage   = Math.min(page, totalPages - 1);
  const visible    = filtered.slice(safePage * pageSize, (safePage + 1) * pageSize);

  const counts: Record<Tab, number> = {
    equinos: equinos.length,
    proprietarios: owners.length,
    propriedades: properties.length,
  };

  const thStyle: React.CSSProperties = {
    textAlign: 'left', padding: '0.75rem 1rem', fontSize: '0.6875rem', fontWeight: 700,
    textTransform: 'uppercase', letterSpacing: '0.05em', color: 'hsl(var(--muted-foreground))',
    borderBottom: '1px solid hsl(var(--border))', background: 'hsl(var(--muted) / 0.4)',
    whiteSpace: 'nowrap',
  };
  const tdStyle: React.CSSProperties = {
    padding: '0.75rem 1rem', fontSize: '0.8125rem', color: 'hsl(var(--foreground))',
    borderBottom: '1px solid hsl(var(--border))',
  };
  const tdMuted: React.CSSProperties = { ...tdStyle, color: 'hsl(var(--muted-foreground))' };

  function renderTable() {
    if (loading) {
      return <p style={{ padding: '2rem', textAlign: 'center', fontSize: '0.875rem', color: 'hsl(var(--muted-foreground))' }}>Carregando…</p>;
    }
    if (visible.length === 0) {
      return (
        <div style={{ padding: '3rem 1rem', textAlign: 'center' }}>
          <p style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'hsl(var(--foreground))', marginBottom: 4 }}>
            {search ? 'Nenhum registro encontrado para a busca' : 'Nenhum registro ainda'}
          </p>
          {!search && (
            <a href={NEW_LINKS[tab].href} style={{ fontSize: '0.8125rem', fontWeight: 600, color: VET_BLUE, textDecoration: 'none' }}>
              {NEW_LINKS[tab].label} →
            </a>
          )}
        </div>
      );
    }

    if (tab === 'equinos') {
      return (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>
              <th style={thStyle}>Ações</th>
              <th style={thStyle}>Animal</th>
              <th style={thStyle}>Proprietário</th>
              <th style={thStyle}>CPF/CNPJ</th>
              <th style={thStyle}>Espécie / Raça</th>
              <th style={thStyle}>Registro / Chip</th>
              <th style={thStyle}>Propriedade</th>
            </tr></thead>
            <tbody>
              {(visible as EquineRow[]).map(r => (
                <tr key={r.id}>
                  <td style={tdStyle}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <ActionButton title="Editar" color="hsl(221 83% 45%)" href={`${EDIT_LINKS.equinos}${r.id}`}><PencilIcon /></ActionButton>
                      <ActionButton title="Excluir" color="hsl(0 84% 50%)" onClick={() => handleDelete(r.id, r.name)}><TrashIcon /></ActionButton>
                      {r.resenha_url && (
                        <ActionButton
                          title="Ver resenha gráfica"
                          color="hsl(142 71% 35%)"
                          onClick={() => openResenha(r.resenha_url!)}
                        >
                          <ImageIcon />
                        </ActionButton>
                      )}
                      <ActionButton
                        title={r.shared_with_owner ? 'Compartilhado com o dono — clique para revogar' : 'Compartilhar com o dono'}
                        color={r.shared_with_owner ? 'hsl(142 71% 35%)' : 'hsl(var(--muted-foreground))'}
                        onClick={() => toggleShare(r)}
                      >
                        <ShareOnIcon />
                      </ActionButton>
                    </div>
                  </td>
                  <td style={{ ...tdStyle, fontWeight: 600 }}>
                    {r.name}
                    {r.shared_with_owner && (
                      <span style={{ marginLeft: 6, fontSize: '0.625rem', fontWeight: 700, padding: '1px 5px', borderRadius: 999, background: 'hsl(142 71% 35% / 0.12)', color: 'hsl(142 71% 30%)' }}>
                        compartilhado
                      </span>
                    )}
                  </td>
                  <td style={tdStyle}>{r.owner?.name ?? '—'}</td>
                  <td style={tdMuted}>{r.owner ? maskCpfCnpj(r.owner.cpf_cnpj) : '—'}</td>
                  <td style={tdMuted}>{[r.species, r.breed].filter(Boolean).join(' / ') || '—'}</td>
                  <td style={tdMuted}>{[r.registry_brand, r.chip].filter(Boolean).join(' / ') || '—'}</td>
                  <td style={tdMuted}>{r.property?.name ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    if (tab === 'proprietarios') {
      return (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>
              <th style={thStyle}>Ações</th>
              <th style={thStyle}>Nome</th>
              <th style={thStyle}>CPF/CNPJ</th>
              <th style={thStyle}>Telefone</th>
              <th style={thStyle}>E-mail</th>
              <th style={thStyle}>Cidade/UF</th>
              <th style={thStyle}>Nº Produtor</th>
            </tr></thead>
            <tbody>
              {(visible as OwnerRow[]).map(r => (
                <tr key={r.id}>
                  <td style={tdStyle}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <ActionButton title="Editar" color="hsl(221 83% 45%)" href={`${EDIT_LINKS.proprietarios}${r.id}`}><PencilIcon /></ActionButton>
                      <ActionButton title="Excluir" color="hsl(0 84% 50%)" onClick={() => handleDelete(r.id, r.name)}><TrashIcon /></ActionButton>
                    </div>
                  </td>
                  <td style={{ ...tdStyle, fontWeight: 600 }}>{r.name}</td>
                  <td style={tdMuted}>{maskCpfCnpj(r.cpf_cnpj)}</td>
                  <td style={tdMuted}>{r.phone ?? '—'}</td>
                  <td style={tdMuted}>{r.email ?? '—'}</td>
                  <td style={tdMuted}>{[r.city, r.uf].filter(Boolean).join('/') || '—'}</td>
                  <td style={tdMuted}>{r.producer_number ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    return (
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr>
            <th style={thStyle}>Ações</th>
            <th style={thStyle}>Propriedade</th>
            <th style={thStyle}>Cidade/UF</th>
            <th style={thStyle}>Classificação</th>
            <th style={thStyle}>Nº Cadastro OESA</th>
            <th style={thStyle}>Qtd. Animais</th>
          </tr></thead>
          <tbody>
            {(visible as PropertyRow[]).map(r => (
              <tr key={r.id}>
                <td style={tdStyle}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <ActionButton title="Editar" color="hsl(221 83% 45%)" href={`${EDIT_LINKS.propriedades}${r.id}`}><PencilIcon /></ActionButton>
                    <ActionButton title="Excluir" color="hsl(0 84% 50%)" onClick={() => handleDelete(r.id, r.name)}><TrashIcon /></ActionButton>
                  </div>
                </td>
                <td style={{ ...tdStyle, fontWeight: 600 }}>{r.name}</td>
                <td style={tdMuted}>{[r.city, r.uf].filter(Boolean).join('/') || '—'}</td>
                <td style={tdMuted}>{r.classification ?? '—'}</td>
                <td style={tdMuted}>{r.oesa_code ?? '—'}</td>
                <td style={tdMuted}>{r.animal_count ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <main className="w-full max-w-7xl mx-auto px-4 md:px-8 py-8 space-y-6">

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 800, letterSpacing: '-0.02em', color: 'hsl(var(--foreground))' }}>Registros</h1>
          <p style={{ fontSize: '0.875rem', color: 'hsl(var(--muted-foreground))', marginTop: 2 }}>
            Seus cadastros de equinos, proprietários e propriedades
          </p>
        </div>
        <a href={NEW_LINKS[tab].href}
           style={{ padding: '0.625rem 1.25rem', borderRadius: '0.625rem', background: VET_BLUE, color: '#fff', fontWeight: 600, fontSize: '0.875rem', textDecoration: 'none', whiteSpace: 'nowrap' }}>
          + {NEW_LINKS[tab].label}
        </a>
      </div>

      {error && (
        <div style={{ padding: '0.75rem 1rem', borderRadius: '0.625rem', background: 'hsl(0 84.2% 55% / 0.08)', border: '1px solid hsl(0 84.2% 55% / 0.25)', fontSize: '0.875rem', color: 'hsl(0 84.2% 45%)', fontWeight: 500 }}>
          {error}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid hsl(var(--border))' }}>
        {TABS.map(t => (
          <button key={t.key} type="button" onClick={() => switchTab(t.key)}
            style={{
              padding: '0.625rem 1rem', fontSize: '0.875rem', fontWeight: 600,
              background: 'none', border: 'none', cursor: 'pointer',
              color: tab === t.key ? VET_BLUE : 'hsl(var(--muted-foreground))',
              borderBottom: tab === t.key ? `2px solid ${VET_BLUE}` : '2px solid transparent',
              marginBottom: -1,
            }}>
            {t.label}
            <span style={{ marginLeft: 6, fontSize: '0.6875rem', fontWeight: 700, padding: '1px 7px', borderRadius: 999, background: tab === t.key ? VET_BLUE_LIGHT : 'hsl(var(--muted))', color: tab === t.key ? VET_BLUE : 'hsl(var(--muted-foreground))' }}>
              {counts[t.key]}
            </span>
          </button>
        ))}
      </div>

      {/* Controles: page size + busca */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8125rem', color: 'hsl(var(--muted-foreground))' }}>
          Mostrar
          <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(0); }}
                  style={{ ...inputStyle, width: 'auto', padding: '0.375rem 0.5rem', appearance: 'auto' }}>
            {[10, 25, 50].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
          registros
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: '0.8125rem', color: 'hsl(var(--muted-foreground))' }}>Procurar:</span>
          <input type="text" value={search} onChange={e => { setSearch(e.target.value); setPage(0); }}
                 style={{ ...inputStyle, width: 220 }} />
        </div>
      </div>

      {/* Tabela */}
      <div className="rounded-2xl border overflow-hidden"
           style={{ borderColor: 'hsl(var(--border))', background: 'hsl(var(--card))' }}>
        {renderTable()}
      </div>

      {/* Paginação */}
      {!loading && filtered.length > pageSize && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.8125rem', color: 'hsl(var(--muted-foreground))' }}>
          <span>
            Mostrando {safePage * pageSize + 1}–{Math.min((safePage + 1) * pageSize, filtered.length)} de {filtered.length}
          </span>
          <div style={{ display: 'flex', gap: 6 }}>
            <button type="button" disabled={safePage === 0} onClick={() => setPage(p => p - 1)}
                    style={{ padding: '0.375rem 0.875rem', borderRadius: '0.5rem', border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))', color: 'hsl(var(--foreground))', cursor: safePage === 0 ? 'not-allowed' : 'pointer', opacity: safePage === 0 ? 0.5 : 1, fontSize: '0.8125rem' }}>
              ← Anterior
            </button>
            <button type="button" disabled={safePage >= totalPages - 1} onClick={() => setPage(p => p + 1)}
                    style={{ padding: '0.375rem 0.875rem', borderRadius: '0.5rem', border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))', color: 'hsl(var(--foreground))', cursor: safePage >= totalPages - 1 ? 'not-allowed' : 'pointer', opacity: safePage >= totalPages - 1 ? 0.5 : 1, fontSize: '0.8125rem' }}>
              Próxima →
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
