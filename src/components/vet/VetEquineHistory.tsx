import { useEffect, useState } from 'react';
import { createClient, isValidUUID, resolveDocUrl } from '../../lib/supabase';
import { EXAM_LABEL, HEALTH_KINDS, HEALTH_LABEL, type ExamType, type HealthKind } from '../../lib/sgq/labels';
import { examValidity, EXAM_VALIDITY_DAYS, formatBrDate } from '../../lib/examStatus';
import { Banner, VET_BLUE } from './formUI';

// Histórico do animal na área veterinária: identificação, resenho e foto,
// exames (com laudo) e registros de saúde. Hoje os exames e o histórico vêm
// da sincronização com o portal SGQ.

const C = {
  fg:     'hsl(var(--foreground))',
  muted:  'hsl(var(--muted-foreground))',
  card:   'hsl(var(--card))',
  border: 'hsl(var(--border))',
  green:  'hsl(142 71% 35%)',
  red:    'hsl(0 84.2% 50%)',
  amber:  'hsl(35 92% 40%)',
};

interface Equine {
  id: string;
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
  owner: { name: string } | null;
  property: { name: string } | null;
}

interface Exam {
  id: string;
  exam_type: ExamType;
  number: string;
  requested_date: string | null;
  collection_date: string | null;
  laboratory: string | null;
  laudo_available: boolean;
}

interface HealthRecord {
  id: string;
  kind: HealthKind;
  event_date: string | null;
  title: string | null;
  data: Record<string, string>;
}

const brDate = (iso: string | null) => formatBrDate(iso);

const STATE_COLOR = { valid: C.green, expiring: C.amber, expired: C.red } as const;

const card: React.CSSProperties = {
  background: C.card, border: `1px solid ${C.border}`, borderRadius: '1rem', padding: '1.5rem', marginBottom: '1.25rem',
};
const h2: React.CSSProperties = { fontSize: '1rem', fontWeight: 700, color: C.fg, marginBottom: '0.75rem' };
const th: React.CSSProperties = {
  padding: '0.5rem 0.625rem', fontSize: '0.75rem', fontWeight: 600, color: C.muted, textAlign: 'left', whiteSpace: 'nowrap',
};
const td: React.CSSProperties = {
  padding: '0.5rem 0.625rem', fontSize: '0.8125rem', color: C.fg, borderTop: `1px solid ${C.border}`, verticalAlign: 'top',
};

function Info({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <dt style={{ fontSize: '0.75rem', color: C.muted }}>{label}</dt>
      <dd style={{ fontSize: '0.875rem', color: C.fg, fontWeight: 500, margin: 0 }}>{value || '—'}</dd>
    </div>
  );
}

export default function VetEquineHistory({ equineId }: { equineId: string }) {
  const [equine, setEquine]   = useState<Equine | null>(null);
  const [exams, setExams]     = useState<Exam[]>([]);
  const [health, setHealth]   = useState<HealthRecord[]>([]);
  const [images, setImages]   = useState<{ resenho: string | null; photo: string | null }>({ resenho: null, photo: null });
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    if (!isValidUUID(equineId)) { setError('Animal inválido.'); setLoading(false); return; }
    const supabase = createClient();
    (async () => {
      const [eq, ex, he] = await Promise.all([
        supabase.from('vet_equines')
          .select('id, name, species, breed, coat, sex, birth_date, age_years, registry_brand, chip, signs_desc, resenha_url, portal_photo_url, owner:vet_owners(name), property:vet_properties(name)')
          .eq('id', equineId).maybeSingle(),
        supabase.from('vet_equine_exams')
          .select('id, exam_type, number, requested_date, collection_date, laboratory, laudo_available')
          .eq('equine_id', equineId)
          .order('collection_date', { ascending: false, nullsFirst: false }),
        supabase.from('vet_equine_health_records')
          .select('id, kind, event_date, title, data')
          .eq('equine_id', equineId)
          .order('event_date', { ascending: false, nullsFirst: false }),
      ]);

      if (eq.error || !eq.data) {
        setError(eq.error ? 'Não foi possível carregar o animal. A migration sgq_exams_health.sql já foi aplicada?' : 'Animal não encontrado ou sem permissão de acesso.');
        setLoading(false);
        return;
      }
      const row = eq.data as unknown as Equine;
      setEquine(row);
      setExams((ex.data ?? []) as Exam[]);
      setHealth((he.data ?? []) as HealthRecord[]);
      setLoading(false);

      const isImage = (p: string | null) => !!p && /\.(png|jpe?g|webp)$/i.test(p);
      const [resenho, photo] = await Promise.all([
        isImage(row.resenha_url) ? resolveDocUrl(row.resenha_url!) : Promise.resolve(null),
        isImage(row.portal_photo_url) ? resolveDocUrl(row.portal_photo_url!) : Promise.resolve(null),
      ]);
      setImages({ resenho, photo });
    })();
  }, [equineId]);

  if (loading) {
    return <main style={{ maxWidth: 900, margin: '0 auto', padding: '2rem 1.5rem' }}><p style={{ color: C.muted, fontSize: '0.875rem' }}>Carregando…</p></main>;
  }
  if (error || !equine) {
    return <main style={{ maxWidth: 900, margin: '0 auto', padding: '2rem 1.5rem' }}><Banner kind="error">{error}</Banner></main>;
  }

  const age = equine.age_years !== null ? `${equine.age_years} ${equine.age_years === 1 ? 'ano' : 'anos'}` : null;

  return (
    <main style={{ maxWidth: 900, margin: '0 auto', padding: '2rem 1.5rem' }}>
      <a href="/vet/registros" style={{ fontSize: '0.8125rem', color: VET_BLUE, textDecoration: 'none', fontWeight: 600 }}>← Registros</a>

      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12, margin: '0.75rem 0 1.25rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.02em', color: C.fg }}>{equine.name}</h1>
        <a href={`/vet/cadastros/equino?id=${equine.id}`}
           style={{ padding: '0.5rem 1rem', borderRadius: '0.625rem', border: `1px solid ${C.border}`, fontSize: '0.8125rem', fontWeight: 600, color: C.fg, textDecoration: 'none' }}>
          Editar cadastro
        </a>
      </div>

      {/* Identificação */}
      <section style={card}>
        <h2 style={h2}>Identificação</h2>
        <dl className="grid grid-cols-2 md:grid-cols-4 gap-4" style={{ margin: 0 }}>
          <Info label="Proprietário" value={equine.owner?.name} />
          <Info label="Propriedade" value={equine.property?.name} />
          <Info label="Espécie" value={equine.species} />
          <Info label="Raça" value={equine.breed} />
          <Info label="Pelagem" value={equine.coat} />
          <Info label="Sexo" value={equine.sex} />
          <Info label="Nascimento" value={equine.birth_date ? brDate(equine.birth_date) : null} />
          <Info label="Idade" value={age} />
          <Info label="Registro/Marca" value={equine.registry_brand} />
          <Info label="Nº Chip" value={equine.chip} />
        </dl>
        {equine.signs_desc && (
          <p style={{ fontSize: '0.8125rem', color: C.fg, marginTop: '1rem', lineHeight: 1.5 }}>
            <span style={{ color: C.muted }}>Sinais: </span>{equine.signs_desc}
          </p>
        )}
        {(images.resenho || images.photo) && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginTop: '1.25rem' }}>
            {images.photo && (
              <figure style={{ margin: 0 }}>
                <a href={images.photo} target="_blank" rel="noreferrer">
                  <img src={images.photo} alt={`Foto de ${equine.name}`} style={{ maxHeight: 220, maxWidth: '100%', borderRadius: '0.625rem', border: `1px solid ${C.border}` }} />
                </a>
                <figcaption style={{ fontSize: '0.75rem', color: C.muted, marginTop: 4 }}>Foto (portal SGQ)</figcaption>
              </figure>
            )}
            {images.resenho && (
              <figure style={{ margin: 0 }}>
                <a href={images.resenho} target="_blank" rel="noreferrer">
                  <img src={images.resenho} alt={`Resenho de ${equine.name}`} style={{ maxHeight: 220, maxWidth: '100%', borderRadius: '0.625rem', border: `1px solid ${C.border}`, background: '#fff' }} />
                </a>
                <figcaption style={{ fontSize: '0.75rem', color: C.muted, marginTop: 4 }}>Resenho</figcaption>
              </figure>
            )}
          </div>
        )}
      </section>

      {/* Exames */}
      <section style={card}>
        <h2 style={h2}>Exames <span style={{ color: C.muted, fontWeight: 500 }}>({exams.length})</span></h2>
        {exams.length === 0 ? (
          <p style={{ fontSize: '0.875rem', color: C.muted }}>Nenhum exame registrado para este animal.</p>
        ) : (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 620 }}>
                <thead><tr>
                  <th style={th}>Exame</th>
                  <th style={th}>Requisição</th>
                  <th style={th}>Colheita</th>
                  <th style={th}>Validade</th>
                  <th style={th}>Laboratório</th>
                  <th style={th}>Laudo</th>
                </tr></thead>
                <tbody>
                  {exams.map(exam => {
                    const v = examValidity(exam.collection_date);
                    return (
                      <tr key={exam.id}>
                        <td style={{ ...td, fontWeight: 600 }}>{EXAM_LABEL[exam.exam_type] ?? exam.exam_type}</td>
                        <td style={td}>{exam.number}</td>
                        <td style={td}>{brDate(exam.collection_date)}</td>
                        <td style={td}>
                          {v ? (
                            <>
                              {brDate(v.until)}{' '}
                              <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: STATE_COLOR[v.state] }}>{v.label}</span>
                            </>
                          ) : '—'}
                        </td>
                        <td style={{ ...td, color: C.muted }}>{exam.laboratory ?? '—'}</td>
                        <td style={td}>
                          {exam.laudo_available ? (
                            <a href={`/api/sgq/laudo?id=${exam.id}`} target="_blank" rel="noreferrer"
                               style={{ color: VET_BLUE, fontWeight: 600, textDecoration: 'none' }}>
                              Abrir PDF
                            </a>
                          ) : <span style={{ color: C.muted }}>Aguardando</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p style={{ fontSize: '0.75rem', color: C.muted, marginTop: '0.75rem', lineHeight: 1.5 }}>
              Validade estimada em {EXAM_VALIDITY_DAYS} dias após a colheita; confira a data no laudo. Os PDFs são
              guardados no EquiCore durante a sincronização.
            </p>
          </>
        )}
      </section>

      {/* Histórico de saúde */}
      <section style={card}>
        <h2 style={h2}>Histórico de saúde <span style={{ color: C.muted, fontWeight: 500 }}>({health.length})</span></h2>
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
                      <span style={{ color: C.muted }}> · {brDate(h.event_date)}</span>
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
      </section>
    </main>
  );
}
