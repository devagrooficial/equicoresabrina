import { useEffect, useMemo, useState } from 'react';
import { createClient, isValidUUID } from '../../lib/supabase';
import { maskCpfCnpj } from '../../lib/br';
import { cityUf, countBy, fetchByIds, healthSummary, loadAnimals, plural, type AnimalLite } from '../../lib/vetRecords';
import { Banner } from './formUI';
import {
  AnimalList, ButtonLink, C, Crumbs, EmptyLinkCard, HealthStrip, ICON, Icon, Info, LinkCard, Loading, Section, Shell,
} from './recordUI';
import { VET_BLUE, VET_BLUE_LIGHT } from './formUI';

// Ficha da propriedade: dados do cadastro, os proprietários que têm animais
// nela e os animais com a situação sanitária de cada um.

interface Property {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  uf: string | null;
  classification: string | null;
  oesa_code: string | null;
  animal_count: number | null;
}

interface OwnerLite {
  id: string;
  name: string;
  cpf_cnpj: string;
  phone: string | null;
  city: string | null;
  uf: string | null;
}

const BACK = '/vet/registros?tab=propriedades';

export default function VetPropertyDetail({ propertyId }: { propertyId: string }) {
  const [property, setProperty] = useState<Property | null>(null);
  const [animals, setAnimals]   = useState<AnimalLite[]>([]);
  const [owners, setOwners]     = useState<OwnerLite[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);

  useEffect(() => {
    if (!isValidUUID(propertyId)) { setError('Propriedade inválida.'); setLoading(false); return; }
    const supabase = createClient();
    (async () => {
      const [pr, an] = await Promise.all([
        supabase.from('vet_properties')
          .select('id, name, address, city, uf, classification, oesa_code, animal_count')
          .eq('id', propertyId).maybeSingle(),
        loadAnimals(supabase, 'property_id', propertyId),
      ]);
      if (pr.error || !pr.data) {
        setError(pr.error ? 'Não foi possível carregar a propriedade. Tente novamente.' : 'Propriedade não encontrada ou sem permissão de acesso.');
        setLoading(false);
        return;
      }
      setProperty(pr.data as Property);
      setAnimals(an.data);
      setOwners(await fetchByIds<OwnerLite>(supabase, 'vet_owners', 'id, name, cpf_cnpj, phone, city, uf', an.data.map(a => a.owner_id)));
      setLoading(false);
    })();
  }, [propertyId]);

  const perOwner = useMemo(() => countBy(animals, 'owner_id'), [animals]);
  const ownerName = useMemo(() => new Map(owners.map(o => [o.id, o.name])), [owners]);
  const summary = useMemo(() => healthSummary(animals), [animals]);

  if (loading) return <Loading />;
  if (error || !property) {
    return (
      <Shell>
        <Crumbs trail={[{ label: 'Registros', href: BACK }, { label: 'Propriedade' }]} />
        <Banner kind="error">{error}</Banner>
      </Shell>
    );
  }

  const sortedOwners = [...owners].sort((a, b) => (perOwner.get(b.id) ?? 0) - (perOwner.get(a.id) ?? 0) || a.name.localeCompare(b.name, 'pt-BR'));
  const declared = property.animal_count;

  return (
    <Shell>
      <Crumbs trail={[{ label: 'Registros', href: BACK }, { label: 'Propriedades', href: BACK }, { label: property.name }]} />

      {/* ── Cabeçalho ── */}
      <section className="rounded-2xl border p-5 md:p-6" style={{ borderColor: C.border, background: C.card }}>
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, minWidth: 0, flex: 1 }}>
            <div aria-hidden="true" style={{
              width: 64, height: 64, borderRadius: '1rem', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: VET_BLUE_LIGHT, color: VET_BLUE,
            }}>
              <Icon d={ICON.pin} size={28} />
            </div>
            <div style={{ minWidth: 0 }}>
              <p style={{ fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.muted }}>Propriedade</p>
              <h1 style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.15, color: C.fg, overflowWrap: 'anywhere' }}>{property.name}</h1>
              <p style={{ fontSize: '0.8125rem', color: C.muted, marginTop: 4 }}>
                {[cityUf(property.city, property.uf), property.classification].filter(Boolean).join(' · ') || 'Local não informado'}
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <ButtonLink href={`/vet/cadastros/equino?property=${property.id}`} icon={ICON.plus}>Novo animal</ButtonLink>
            <ButtonLink href={`/vet/cadastros/propriedade?id=${property.id}`} variant="primary" icon={ICON.pencil}>Editar</ButtonLink>
          </div>
        </div>

        <dl className="grid grid-cols-2 md:grid-cols-4 gap-4" style={{ margin: '18px 0 0', paddingTop: 16, borderTop: `1px solid ${C.border}` }}>
          <Info label="Nº cadastro OESA" value={property.oesa_code} />
          <Info label="Classificação" value={property.classification} />
          <Info label="Animais declarados" value={declared !== null ? String(declared) : null} />
          <Info label="Animais no EquiCore" value={String(animals.length)} />
          <div className="col-span-2 md:col-span-4"><Info label="Endereço ou coordenadas" value={property.address} /></div>
        </dl>
        {declared !== null && declared > animals.length && (
          <p style={{ fontSize: '0.75rem', color: C.muted, marginTop: 12, lineHeight: 1.5 }}>
            O cadastro declara {plural(declared, 'animal', 'animais')}, mas só {plural(animals.length, 'está ligado', 'estão ligados')} a
            esta propriedade no EquiCore. O vínculo é feito no cadastro de cada animal.
          </p>
        )}
      </section>

      {animals.length > 0 && <HealthStrip summary={summary} total={animals.length} />}

      {/* ── Proprietários ── */}
      <section aria-labelledby="proprietarios">
        <h2 id="proprietarios" style={{ fontSize: '1rem', fontWeight: 700, letterSpacing: '-0.01em', color: C.fg, marginBottom: 4 }}>
          Proprietários <span style={{ color: C.muted, fontWeight: 500 }}>({owners.length})</span>
        </h2>
        <p style={{ fontSize: '0.8125rem', color: C.muted, marginBottom: 12 }}>Quem tem animais nesta propriedade.</p>
        {owners.length === 0 ? (
          <EmptyLinkCard eyebrow="Proprietário" icon={ICON.user} title="Nenhum proprietário ainda"
                         text="Os proprietários aparecem aqui quando um animal deles é ligado a esta propriedade." />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {sortedOwners.map(owner => (
              <LinkCard key={owner.id} eyebrow="Proprietário" icon={ICON.user} title={owner.name} href={`/vet/proprietario/${owner.id}`}
                        facts={[['CPF/CNPJ', maskCpfCnpj(owner.cpf_cnpj)], ['Telefone', owner.phone], ['Cidade/UF', cityUf(owner.city, owner.uf)]]}
                        footer={`${plural(perOwner.get(owner.id) ?? 0, 'animal', 'animais')} nesta propriedade`} />
            ))}
          </div>
        )}
      </section>

      {/* ── Animais ── */}
      <Section title="Animais" count={animals.length} flush>
        <AnimalList
          animals={animals}
          context={animal => (animal.owner_id ? ownerName.get(animal.owner_id) ?? null : null)}
          emptyText="Nenhum animal ligado a esta propriedade. O vínculo é feito no campo Propriedade do cadastro do animal ou vem das requisições na sincronização com o portal."
        />
      </Section>
    </Shell>
  );
}
