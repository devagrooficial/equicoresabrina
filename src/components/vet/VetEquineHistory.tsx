import { useEffect, useState } from 'react';
import { createClient, isValidUUID, resolveDocUrl } from '../../lib/supabase';
import { EXAM_LABEL, HEALTH_KINDS, HEALTH_LABEL, type HealthKind } from '../../lib/sgq/labels';
import { examValidity, EXAM_VALIDITY_DAYS, formatBrDate, overallState } from '../../lib/examStatus';
import { maskCpfCnpj } from '../../lib/br';
import { cityUf, plural } from '../../lib/vetRecords';
import { Lightbox, useLightbox } from '../shared/Lightbox';
import { PHOTO_SLOTS } from '../shared/EquinePhotos';
import { Banner, VET_BLUE } from './formUI';
import ExamDialog, { EXAM_COLUMNS, isManualExam, type ExamRecord } from './ExamDialog';
import {
  Avatar, ButtonLink, C, Chip, Crumbs, EmptyLinkCard, HEALTH_TITLE, ICON, Icon, Info, LinkCard, Loading,
  SanitaryCards, Section, Shell, TONE,
} from './recordUI';

// Ficha do animal na área veterinária: quem é, de quem é e onde está
// (proprietário e propriedade), situação sanitária, exames com laudo e
// histórico de saúde. Exames vêm da sincronização com o portal SGQ ou são
// lançados à mão aqui (ExamDialog); o histórico vem só da sincronização.

interface Owner {
  id: string;
  name: string;
  cpf_cnpj: string;
  phone: string | null;
  email: string | null;
  city: string | null;
  uf: string | null;
}

interface Property {
  id: string;
  name: string;
  city: string | null;
  uf: string | null;
  classification: string | null;
  oesa_code: string | null;
}

interface Equine {
  id: string;
  vet_id: string;
  name: string;
  species: string | null;
  breed: string | null;
  coat: string | null;
  sex: string | null;
  birth_date: string | null;
  age_years: number | null;
  registry_brand: string | null;
  chip: string | null;
  signs_desc: string | null;
  resenha_url: string | null;
  portal_photo_url: string | null;
  marca_fogo_url: string | null;
  shared_with_owner: boolean;
  owner: Owner | null;
  property: Property | null;
}

type Exam = ExamRecord;

/** Mais recentes primeiro; exames sem data de colheita no fim. */
const byCollection = (a: Exam, b: Exam) => (b.collection_date ?? '').localeCompare(a.collection_date ?? '');

interface HealthRecord {
  id: string;
  kind: HealthKind;
  event_date: string | null;
  title: string | null;
  data: Record<string, string>;
}

interface Picture { label: string; url: string; light?: boolean }

const BASE_COLUMNS = 'id, vet_id, name, species, breed, coat, sex, birth_date, age_years, registry_brand, chip, signs_desc, resenha_url, shared_with_owner, '
  + 'owner:vet_owners(id, name, cpf_cnpj, phone, email, city, uf), property:vet_properties(id, name, city, uf, classification, oesa_code)';

const th: React.CSSProperties = {
  padding: '0.5rem 0.625rem', fontSize: '0.75rem', fontWeight: 600, color: C.muted, textAlign: 'left', whiteSpace: 'nowrap',
};
const td: React.CSSProperties = {
  padding: '0.5rem 0.625rem', fontSize: '0.8125rem', color: C.fg, borderTop: `1px solid ${C.border}`, verticalAlign: 'top',
};

const rowAction: React.CSSProperties = {
  padding: '2px 6px', border: 'none', background: 'none', cursor: 'pointer', fontSize: '0.8125rem', fontWeight: 600,
};

const isImage = (path: string | null | undefined) => !!path && /\.(png|jpe?g|webp)$/i.test(path.split('?')[0]);

/**
 * Fotos do cadastro (frente, costas e laterais). Elas não têm coluna no banco:
 * ficam na pasta do animal no bucket "docs", com o nome da posição no arquivo.
 */
async function loadSlotPhotos(supabase: any, vetId: string, equineId: string): Promise<Picture[]> {
  const folder = `${vetId}/equinos/${equineId}`;
  const { data: files } = await supabase.storage.from('docs').list(folder, { limit: 100 });
  const found = PHOTO_SLOTS.flatMap(slot => {
    // "Costas" já se chamou "Verso" em cadastros antigos
    const prefixes = slot.key === 'costas' ? ['foto-costas', 'foto-verso'] : [`foto-${slot.key}`];
    const file = (files ?? []).find((f: { name: string }) => prefixes.some(prefix => f.name.startsWith(prefix)));
    return file ? [{ label: slot.label, path: `${folder}/${file.name}` }] : [];
  });
  if (found.length === 0) return [];
  const { data: signed } = await supabase.storage.from('docs').createSignedUrls(found.map(f => f.path), 43_200);
  return found.flatMap((f, i) => (signed?.[i]?.signedUrl ? [{ label: f.label, url: signed[i].signedUrl }] : []));
}

export default function VetEquineHistory({ equineId }: { equineId: string }) {
  const [equine, setEquine]     = useState<Equine | null>(null);
  const [exams, setExams]       = useState<Exam[]>([]);
  const [health, setHealth]     = useState<HealthRecord[]>([]);
  const [pictures, setPictures] = useState<Picture[]>([]);
  const [photo, setPhoto]       = useState<string | null>(null);
  const [siblings, setSiblings] = useState<{ owner: number | null; property: number | null }>({ owner: null, property: null });
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [sharing, setSharing]   = useState(false);
  const lightbox                = useLightbox();
  // Formulário de exame: 'new' para lançar um, ou o exame manual em edição
  const [examForm, setExamForm] = useState<'new' | Exam | null>(null);
  const [notice, setNotice]     = useState<string | null>(null);

  function examSaved(saved: Exam, created: boolean) {
    setExams(prev => [...prev.filter(e => e.id !== saved.id), saved].sort(byCollection));
    setExamForm(null);
    setNotice(created ? 'Exame adicionado.' : 'Exame atualizado.');
  }

  async function deleteExam(exam: Exam) {
    if (!confirm(`Excluir o exame ${exam.number}? O laudo anexado também será apagado. Esta ação não pode ser desfeita.`)) return;
    const supabase = createClient();
    const { error: err } = await supabase.from('vet_equine_exams').delete().eq('id', exam.id);
    if (err) { alert('Não foi possível excluir o exame. Tente novamente.'); return; }
    // Só depois de a linha sair, para nunca apagar o laudo de um exame que continua existindo
    if (exam.laudo_path) await supabase.storage.from('docs').remove([exam.laudo_path]);
    setExams(prev => prev.filter(e => e.id !== exam.id));
    setNotice('Exame excluído.');
  }

  useEffect(() => {
    if (!isValidUUID(equineId)) { setError('Animal inválido.'); setLoading(false); return; }
    const supabase = createClient();
    (async () => {
      const [first, ex, he] = await Promise.all([
        supabase.from('vet_equines').select(`${BASE_COLUMNS}, portal_photo_url, marca_fogo_url`).eq('id', equineId).maybeSingle(),
        supabase.from('vet_equine_exams')
          .select(EXAM_COLUMNS)
          .eq('equine_id', equineId)
          .order('collection_date', { ascending: false, nullsFirst: false }),
        supabase.from('vet_equine_health_records')
          .select('id, kind, event_date, title, data')
          .eq('equine_id', equineId)
          .order('event_date', { ascending: false, nullsFirst: false }),
      ]);

      // Banco sem as colunas mais novas (foto do portal, marca de fogo): mostra o cadastro mesmo assim
      const eq = first.error
        ? await supabase.from('vet_equines').select(BASE_COLUMNS).eq('id', equineId).maybeSingle()
        : first;

      if (eq.error || !eq.data) {
        setError(eq.error ? 'Não foi possível carregar o animal. Tente novamente.' : 'Animal não encontrado ou sem permissão de acesso.');
        setLoading(false);
        return;
      }
      const row = eq.data as unknown as Equine;
      setEquine(row);
      setExams((ex.data ?? []) as Exam[]);
      setHealth((he.data ?? []) as HealthRecord[]);
      setLoading(false);

      const count = (column: 'owner_id' | 'property_id', id: string | undefined) => id
        ? supabase.from('vet_equines').select('id', { count: 'exact', head: true }).eq(column, id).then(r => r.count ?? null)
        : Promise.resolve(null);
      const sign = (path: string | null | undefined) => (isImage(path) ? resolveDocUrl(path!) : Promise.resolve(null));

      const [ownerCount, propertyCount, photoUrl, resenho, marca, slotPhotos] = await Promise.all([
        count('owner_id', row.owner?.id),
        count('property_id', row.property?.id),
        sign(row.portal_photo_url),
        sign(row.resenha_url),
        sign(row.marca_fogo_url),
        loadSlotPhotos(supabase, row.vet_id, row.id).catch(() => [] as Picture[]),
      ]);
      setSiblings({ owner: ownerCount, property: propertyCount });
      setPhoto(photoUrl ?? slotPhotos.find(p => p.label.startsWith('Lateral'))?.url ?? slotPhotos[0]?.url ?? null);
      setPictures([
        photoUrl ? { label: 'Foto (portal SGQ)', url: photoUrl } : null,
        ...slotPhotos,
        resenho ? { label: 'Resenho', url: resenho, light: true } : null,
        marca ? { label: 'Marca de fogo', url: marca } : null,
      ].filter((p): p is Picture => !!p));
    })();
  }, [equineId]);

  async function toggleShare() {
    if (!equine || sharing) return;
    const next = !equine.shared_with_owner;
    setSharing(true);
    const { error: err } = await createClient().from('vet_equines').update({ shared_with_owner: next }).eq('id', equine.id);
    setSharing(false);
    if (err) { alert('Não foi possível alterar o compartilhamento. Tente novamente.'); return; }
    setEquine({ ...equine, shared_with_owner: next });
  }

  if (loading) return <Loading />;
  if (error || !equine) {
    return (
      <Shell>
        <Crumbs trail={[{ label: 'Registros', href: '/vet/registros?tab=equinos' }, { label: 'Animal' }]} />
        <Banner kind="error">{error}</Banner>
      </Shell>
    );
  }

  const { owner, property } = equine;
  const age = equine.age_years !== null ? plural(equine.age_years, 'ano', 'anos') : null;
  const chips = [equine.species, equine.breed, equine.sex, age].filter(Boolean) as string[];
  const overall = overallState(exams);
  const others = (n: number | null, where: string) =>
    n === null ? undefined : n <= 1 ? `Único animal ${where}` : `${plural(n - 1, 'outro animal', 'outros animais')} ${where}`;

  return (
    <Shell>
      <Crumbs trail={[
        { label: 'Registros', href: '/vet/registros?tab=equinos' },
        { label: 'Equinos', href: '/vet/registros?tab=equinos' },
        { label: equine.name },
      ]} />

      {/* ── Cabeçalho ── */}
      <section className="rounded-2xl border p-5 md:p-6" style={{ borderColor: C.border, background: C.card }}>
        <div className="flex flex-col md:flex-row md:items-center gap-5">
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, minWidth: 0, flex: 1 }}>
            {photo ? (
              <button type="button" onClick={() => lightbox.open(photo)} title="Ampliar foto"
                      style={{ padding: 0, border: 'none', background: 'none', cursor: 'zoom-in', borderRadius: '1rem', flexShrink: 0 }}>
                <Avatar label={equine.name} src={photo} size={80} />
              </button>
            ) : <Avatar label={equine.name} size={80} />}
            <div style={{ minWidth: 0 }}>
              <h1 style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.15, color: C.fg, overflowWrap: 'anywhere' }}>
                {equine.name}
              </h1>
              <p style={{ fontSize: '0.8125rem', color: C.muted, marginTop: 4, overflowWrap: 'anywhere' }}>
                {owner ? <>de <a href={`/vet/proprietario/${owner.id}`} className="rec-link" style={{ color: C.fg, fontWeight: 600 }}>{owner.name}</a></> : 'Sem proprietário'}
                {property && <> · em <a href={`/vet/propriedade/${property.id}`} className="rec-link" style={{ color: C.fg, fontWeight: 600 }}>{property.name}</a></>}
              </p>
              {chips.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                  {chips.map(chip => <Chip key={chip}>{chip}</Chip>)}
                </div>
              )}
            </div>
          </div>

          <div className="rounded-xl px-4 py-3 md:max-w-xs" style={{ background: TONE[overall].soft, border: `1px solid ${TONE[overall].border}` }}>
            <p style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.875rem', fontWeight: 700, color: TONE[overall].color }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: TONE[overall].color, flexShrink: 0 }} aria-hidden="true" />
              {HEALTH_TITLE[overall].title}
            </p>
            <p style={{ fontSize: '0.75rem', color: C.muted, marginTop: 4, lineHeight: 1.5 }}>{HEALTH_TITLE[overall].text}</p>
          </div>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, marginTop: 18, paddingTop: 16, borderTop: `1px solid ${C.border}` }}>
          <ButtonLink href={`/vet/cadastros/equino?id=${equine.id}`} variant="primary" icon={ICON.pencil}>Editar cadastro</ButtonLink>
          <button type="button" onClick={toggleShare} disabled={sharing} className="rec-btn" aria-pressed={equine.shared_with_owner}
                  title="O dono vê o animal no aplicativo dele quando o CPF/CNPJ do perfil é o mesmo do proprietário"
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6, padding: '0.5rem 0.9375rem', borderRadius: '0.625rem',
                    fontSize: '0.8125rem', fontWeight: 600, cursor: sharing ? 'wait' : 'pointer',
                    background: equine.shared_with_owner ? TONE.valid.soft : 'transparent',
                    color: equine.shared_with_owner ? TONE.valid.color : C.fg,
                    border: `1px solid ${equine.shared_with_owner ? TONE.valid.border : C.border}`,
                  }}>
            <Icon d={ICON.share} size={14} />
            {equine.shared_with_owner ? 'Compartilhado com o dono' : 'Compartilhar com o dono'}
          </button>
          <span style={{ fontSize: '0.75rem', color: C.muted }}>
            {equine.shared_with_owner ? 'Clique para parar de compartilhar.' : 'O dono ainda não vê este animal no aplicativo dele.'}
          </span>
        </div>
      </section>

      {/* ── Vínculos ── */}
      <section aria-labelledby="vinculos">
        <h2 id="vinculos" style={{ fontSize: '1rem', fontWeight: 700, letterSpacing: '-0.01em', color: C.fg, marginBottom: 12 }}>Proprietário e propriedade</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {owner ? (
            <LinkCard
              eyebrow="Proprietário" icon={ICON.user} title={owner.name} href={`/vet/proprietario/${owner.id}`}
              facts={[
                ['CPF/CNPJ', maskCpfCnpj(owner.cpf_cnpj)],
                ['Telefone', owner.phone],
                ['E-mail', owner.email],
                ['Cidade/UF', cityUf(owner.city, owner.uf)],
              ]}
              footer={others(siblings.owner, 'deste proprietário')}
            />
          ) : (
            <EmptyLinkCard eyebrow="Proprietário" icon={ICON.user} title="Sem proprietário"
                           text="O cadastro do proprietário deste animal não foi encontrado."
                           action={{ href: `/vet/cadastros/equino?id=${equine.id}`, label: 'Escolher proprietário' }} />
          )}
          {property ? (
            <LinkCard
              eyebrow="Propriedade" icon={ICON.pin} title={property.name} href={`/vet/propriedade/${property.id}`}
              facts={[
                ['Cidade/UF', cityUf(property.city, property.uf)],
                ['Classificação', property.classification],
                ['Nº OESA', property.oesa_code],
              ]}
              footer={others(siblings.property, 'nesta propriedade')}
            />
          ) : (
            <EmptyLinkCard eyebrow="Propriedade" icon={ICON.pin} title="Sem propriedade vinculada"
                           text="Indique onde o animal fica para vê-lo junto com os outros da mesma propriedade."
                           action={{ href: `/vet/cadastros/equino?id=${equine.id}`, label: 'Vincular propriedade' }} />
          )}
        </div>
      </section>

      {/* ── Situação sanitária ── */}
      <section aria-labelledby="sanitaria">
        <h2 id="sanitaria" style={{ fontSize: '1rem', fontWeight: 700, letterSpacing: '-0.01em', color: C.fg, marginBottom: 12 }}>Situação sanitária</h2>
        <SanitaryCards exams={exams} />
        <p style={{ fontSize: '0.75rem', color: C.muted, marginTop: 10, lineHeight: 1.5 }}>
          Validade estimada em {EXAM_VALIDITY_DAYS} dias após a colheita; confira a data no laudo.
        </p>
      </section>

      {/* ── Identificação ── */}
      <Section title="Identificação">
        <dl className="grid grid-cols-2 md:grid-cols-4 gap-4" style={{ margin: 0 }}>
          <Info label="Espécie" value={equine.species} />
          <Info label="Raça" value={equine.breed} />
          <Info label="Pelagem" value={equine.coat} />
          <Info label="Sexo" value={equine.sex} />
          <Info label="Nascimento" value={equine.birth_date ? formatBrDate(equine.birth_date) : null} />
          <Info label="Idade" value={age} />
          <Info label="Registro/Marca" value={equine.registry_brand} />
          <Info label="Nº do chip" value={equine.chip} />
        </dl>
        {equine.signs_desc && (
          <div style={{ marginTop: '1rem' }}>
            <p style={{ fontSize: '0.75rem', color: C.muted }}>Sinais</p>
            <p style={{ fontSize: '0.875rem', color: C.fg, lineHeight: 1.55 }}>{equine.signs_desc}</p>
          </div>
        )}
        {pictures.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginTop: '1.25rem' }}>
            {pictures.map(picture => (
              <figure key={picture.label} style={{ margin: 0 }}>
                <button type="button" onClick={() => lightbox.open(picture.url)} title={`Ampliar ${picture.label.toLowerCase()}`}
                        style={{ padding: 0, border: 'none', background: 'none', cursor: 'zoom-in', display: 'block' }}>
                  <img src={picture.url} alt={`${picture.label} de ${equine.name}`} loading="lazy"
                       style={{ height: 180, maxWidth: '100%', objectFit: 'contain', borderRadius: '0.625rem', border: `1px solid ${C.border}`, background: picture.light ? '#fff' : 'transparent' }} />
                </button>
                <figcaption style={{ fontSize: '0.75rem', color: C.muted, marginTop: 4 }}>{picture.label}</figcaption>
              </figure>
            ))}
          </div>
        )}
        {equine.resenha_url && !isImage(equine.resenha_url) && (
          <button type="button" className="rec-link"
                  onClick={async () => window.open(await resolveDocUrl(equine.resenha_url!), '_blank', 'noopener,noreferrer')}
                  style={{ marginTop: '1rem', padding: 0, border: 'none', background: 'none', cursor: 'pointer', fontSize: '0.8125rem', fontWeight: 600, color: VET_BLUE }}>
            Abrir resenho (PDF) ↗
          </button>
        )}
      </Section>

      {/* ── Exames ── */}
      <Section title="Exames" count={exams.length} aside={
        <button type="button" onClick={() => { setNotice(null); setExamForm('new'); }} className="rec-btn"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '0.4375rem 0.875rem', borderRadius: '0.625rem', fontSize: '0.8125rem', fontWeight: 600, background: VET_BLUE, color: '#fff', border: 'none', cursor: 'pointer' }}>
          <Icon d={ICON.plus} size={14} /> Adicionar exame
        </button>
      }>
        {notice && <div role="status"><Banner kind="success">{notice}</Banner></div>}
        {exams.length === 0 ? (
          <p style={{ fontSize: '0.875rem', color: C.muted, lineHeight: 1.6 }}>
            Nenhum exame registrado para este animal. Use “Adicionar exame” para lançar um exame de AIE ou mormo e anexar o laudo.
          </p>
        ) : (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
                <thead><tr>
                  <th style={th}>Exame</th>
                  <th style={th}>Requisição</th>
                  <th style={th}>Colheita</th>
                  <th style={th}>Validade</th>
                  <th style={th}>Laboratório</th>
                  <th style={th}>Laudo</th>
                  {/* aria-label em vez de texto escondido: um sr-only (position: absolute) dentro da área com rolagem alarga a página no celular */}
                  <th style={th} aria-label="Ações" />
                </tr></thead>
                <tbody>
                  {exams.map(exam => {
                    const v = examValidity(exam.collection_date);
                    const manual = isManualExam(exam);
                    return (
                      <tr key={exam.id}>
                        <td style={{ ...td, fontWeight: 600 }}>
                          {EXAM_LABEL[exam.exam_type] ?? exam.exam_type}
                          {manual && <span style={{ display: 'block', fontSize: '0.6875rem', fontWeight: 500, color: C.muted }}>lançado manualmente</span>}
                        </td>
                        <td style={td}>{exam.number}</td>
                        <td style={td}>{formatBrDate(exam.collection_date)}</td>
                        <td style={td}>
                          {v ? (
                            <>
                              {formatBrDate(v.until)}{' '}
                              <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: TONE[v.state].color }}>{v.label}</span>
                            </>
                          ) : '—'}
                        </td>
                        <td style={{ ...td, color: C.muted }}>{exam.laboratory ?? '—'}</td>
                        <td style={td}>
                          {exam.laudo_available ? (
                            <a href={`/api/sgq/laudo?id=${exam.id}`} target="_blank" rel="noreferrer" className="rec-link"
                               style={{ color: VET_BLUE, fontWeight: 600 }}>
                              Abrir laudo
                            </a>
                          ) : <span style={{ color: C.muted }}>{manual ? 'Sem laudo' : 'Aguardando'}</span>}
                        </td>
                        <td style={{ ...td, whiteSpace: 'nowrap', textAlign: 'right' }}>
                          {manual && (
                            <>
                              <button type="button" onClick={() => { setNotice(null); setExamForm(exam); }} title={`Editar o exame ${exam.number}`}
                                      style={{ ...rowAction, color: VET_BLUE }}>
                                Editar
                              </button>
                              <button type="button" onClick={() => deleteExam(exam)} title={`Excluir o exame ${exam.number}`}
                                      style={{ ...rowAction, color: TONE.expired.color }}>
                                Excluir
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p style={{ fontSize: '0.75rem', color: C.muted, marginTop: '0.75rem', lineHeight: 1.5 }}>
              Os laudos do portal SGQ são guardados no EquiCore durante a sincronização. Exames lançados manualmente podem
              ser editados e excluídos aqui.
            </p>
          </>
        )}
      </Section>

      {/* ── Histórico de saúde ── */}
      <Section title="Histórico de saúde" count={health.length}>
        {health.length === 0 ? (
          <p style={{ fontSize: '0.875rem', color: C.muted }}>
            Nenhum registro de vacina, vermifugação, medicamento, pesagem, reprodução ou observação clínica.
          </p>
        ) : (
          HEALTH_KINDS.filter(kind => health.some(h => h.kind === kind)).map(kind => (
            <div key={kind} style={{ marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '0.875rem', fontWeight: 700, color: C.fg, marginBottom: '0.375rem' }}>{HEALTH_LABEL[kind]}</h3>
              <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {health.filter(h => h.kind === kind).map(h => (
                  <li key={h.id} style={{ borderTop: `1px solid ${C.border}`, padding: '0.5rem 0' }}>
                    <div style={{ fontSize: '0.8125rem', color: C.fg }}>
                      <strong>{h.title ?? HEALTH_LABEL[kind]}</strong>
                      <span style={{ color: C.muted }}> · {formatBrDate(h.event_date)}</span>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: C.muted, marginTop: 2 }}>
                      {Object.entries(h.data).map(([key, value]) => `${key}: ${value}`).join(' · ')}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </Section>

      {examForm && (
        <ExamDialog
          equine={{ id: equine.id, vet_id: equine.vet_id, name: equine.name, ownerName: owner?.name ?? null }}
          exam={examForm === 'new' ? null : examForm}
          onClose={() => setExamForm(null)}
          onSaved={examSaved}
        />
      )}

      <Lightbox src={lightbox.src} onClose={lightbox.close} />
    </Shell>
  );
}
