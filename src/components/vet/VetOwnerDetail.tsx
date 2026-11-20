import { useEffect, useMemo, useState } from 'react';
import { createClient, isValidUUID } from '../../lib/supabase';
import { maskCEP, maskCpfCnpj } from '../../lib/br';
import { cityUf, countBy, fetchByIds, healthSummary, loadAnimals, plural, type AnimalLite } from '../../lib/vetRecords';
import { Banner } from './formUI';
import {
  AnimalList, Avatar, ButtonLink, C, Crumbs, EmptyLinkCard, HealthStrip, ICON, Info, LinkCard, Loading, Section, Shell,
} from './recordUI';

// Ficha do proprietário: contato, as propriedades onde ele tem animais e os
// animais dele com a situação sanitária de cada um.

interface Owner {
  id: string;
  name: string;
  cpf_cnpj: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  district: string | null;
  cep: string | null;
  city: string | null;
  uf: string | null;
  producer_number: string | null;
}

interface PropertyLite {
  id: string;
  name: string;
  city: string | null;
  uf: string | null;
  classification: string | null;
}

const BACK = '/vet/registros?tab=proprietarios';

export default function VetOwnerDetail({ ownerId }: { ownerId: string }) {
  const [owner, setOwner]           = useState<Owner | null>(null);
  const [animals, setAnimals]       = useState<AnimalLite[]>([]);
  const [properties, setProperties] = useState<PropertyLite[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);

  useEffect(() => {
    if (!isValidUUID(ownerId)) { setError('Proprietário inválido.'); setLoading(false); return; }
    const supabase = createClient();
    (async () => {
      const [ow, an] = await Promise.all([
        supabase.from('vet_owners')
          .select('id, name, cpf_cnpj, phone, email, address, district, cep, city, uf, producer_number')
          .eq('id', ownerId).maybeSingle(),
        loadAnimals(supabase, 'owner_id', ownerId),
      ]);
      if (ow.error || !ow.data) {
        setError(ow.error ? 'Não foi possível carregar o proprietário. Tente novamente.' : 'Proprietário não encontrado ou sem permissão de acesso.');
        setLoading(false);
        return;
      }
      setOwner(ow.data as Owner);
      setAnimals(an.data);
      setProperties(await fetchByIds<PropertyLite>(supabase, 'vet_properties', 'id, name, city, uf, classification', an.data.map(a => a.property_id)));
      setLoading(false);
    })();
  }, [ownerId]);

  const perProperty = useMemo(() => countBy(animals, 'property_id'), [animals]);
  const propertyName = useMemo(() => new Map(properties.map(p => [p.id, p.name])), [properties]);
  const summary = useMemo(() => healthSummary(animals), [animals]);

  if (loading) return <Loading />;
  if (error || !owner) {
    return (
      <Shell>
        <Crumbs trail={[{ label: 'Registros', href: BACK }, { label: 'Proprietário' }]} />
        <Banner kind="error">{error}</Banner>
      </Shell>
    );
  }

  const withoutProperty = perProperty.get(null) ?? 0;
  const sortedProperties = [...properties].sort((a, b) => (perProperty.get(b.id) ?? 0) - (perProperty.get(a.id) ?? 0) || a.name.localeCompare(b.name, 'pt-BR'));
  const address = [owner.address, owner.district].filter(Boolean).join(', ') || null;

  return (
    <Shell>
      <Crumbs trail={[{ label: 'Registros', href: BACK }, { label: 'Proprietários', href: BACK }, { label: owner.name }]} />

      {/* ── Cabeçalho ── */}
      <section className="rounded-2xl border p-5 md:p-6" style={{ borderColor: C.border, background: C.card }}>
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, minWidth: 0, flex: 1 }}>
            <Avatar label={owner.name} size={64} round />
            <div style={{ minWidth: 0 }}>
              <p style={{ fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.muted }}>Proprietário</p>
              <h1 style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.15, color: C.fg, overflowWrap: 'anywhere' }}>{owner.name}</h1>
              <p style={{ fontSize: '0.8125rem', color: C.muted, marginTop: 4 }}>
                {maskCpfCnpj(owner.cpf_cnpj)}{cityUf(owner.city, owner.uf) ? ` · ${cityUf(owner.city, owner.uf)}` : ''}
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <ButtonLink href={`/vet/cadastros/equino?owner=${owner.id}`} icon={ICON.plus}>Novo animal</ButtonLink>
            <ButtonLink href={`/vet/cadastros/proprietario?id=${owner.id}`} variant="primary" icon={ICON.pencil}>Editar</ButtonLink>
          </div>
        </div>

        <dl className="grid grid-cols-2 md:grid-cols-4 gap-4" style={{ margin: '18px 0 0', paddingTop: 16, borderTop: `1px solid ${C.border}` }}>
          <Info label="Telefone" value={owner.phone} />
          <Info label="Nº do produtor" value={owner.producer_number} />
          {/* E-mail ocupa a linha inteira no celular para não quebrar no meio */}
          <div className="col-span-2 md:col-span-1"><Info label="E-mail" value={owner.email} /></div>
          <Info label="CEP" value={owner.cep ? maskCEP(owner.cep) : null} />

          <div className="col-span-2 md:col-span-4"><Info label="Endereço" value={address} /></div>
        </dl>
      </section>

      {animals.length > 0 && <HealthStrip summary={summary} total={animals.length} />}

      {/* ── Propriedades ── */}
      <section aria-labelledby="propriedades">
        <h2 id="propriedades" style={{ fontSize: '1rem', fontWeight: 700, letterSpacing: '-0.01em', color: C.fg, marginBottom: 4 }}>
          Propriedades <span style={{ color: C.muted, fontWeight: 500 }}>({properties.length})</span>
        </h2>
        <p style={{ fontSize: '0.8125rem', color: C.muted, marginBottom: 12 }}>Onde ficam os animais deste proprietário.</p>
        {properties.length === 0 ? (
          <EmptyLinkCard eyebrow="Propriedade" icon={ICON.pin} title="Nenhuma propriedade vinculada"
                         text={animals.length === 0
                           ? 'A propriedade aparece aqui quando um animal deste proprietário é ligado a ela.'
                           : 'Os animais deste proprietário ainda não estão ligados a uma propriedade. O vínculo é feito no cadastro de cada animal.'} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {sortedProperties.map(property => (
              <LinkCard key={property.id} eyebrow="Propriedade" icon={ICON.pin} title={property.name} href={`/vet/propriedade/${property.id}`}
                        facts={[['Cidade/UF', cityUf(property.city, property.uf)], ['Classificação', property.classification]]}
                        footer={`${plural(perProperty.get(property.id) ?? 0, 'animal', 'animais')} deste proprietário`} />
            ))}
          </div>
        )}
        {properties.length > 0 && withoutProperty > 0 && (
          <p style={{ fontSize: '0.8125rem', color: C.muted, marginTop: 10 }}>
            {plural(withoutProperty, 'animal ainda sem propriedade vinculada', 'animais ainda sem propriedade vinculada')}.
          </p>
        )}
      </section>

      {/* ── Animais ── */}
      <Section title="Animais" count={animals.length} flush>
        <AnimalList
          animals={animals}
          context={animal => (animal.property_id ? propertyName.get(animal.property_id) ?? null : 'sem propriedade')}
          emptyText="Este proprietário ainda não tem animais cadastrados. Use “Novo animal” para cadastrar o primeiro."
        />
      </Section>
    </Shell>
  );
}
