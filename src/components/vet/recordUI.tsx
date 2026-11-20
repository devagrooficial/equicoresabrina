import { useMemo, useState } from 'react';
import { examValidity, EXAM_GROUP_LABEL, formatBrDate, latestExam, type ExamGroup } from '../../lib/examStatus';
import { EXAM_LABEL, type ExamType } from '../../lib/sgq/labels';
import { animalHealth, plural, sortByUrgency, type AnimalLite, type Health } from '../../lib/vetRecords';
import { VET_BLUE, VET_BLUE_LIGHT, inputStyle } from './formUI';

// Blocos visuais das fichas da área veterinária (animal, proprietário e
// propriedade). As três telas usam as mesmas peças para que o vínculo entre
// os cadastros tenha sempre a mesma cara.

export const C = {
  fg:     'hsl(var(--foreground))',
  muted:  'hsl(var(--muted-foreground))',
  card:   'hsl(var(--card))',
  border: 'hsl(var(--border))',
  soft:   'hsl(var(--muted) / 0.5)',
};

export const TONE: Record<Health, { color: string; soft: string; border: string }> = {
  valid:    { color: 'hsl(152 60% 36%)', soft: 'hsl(152 69% 40% / 0.12)', border: 'hsl(152 69% 40% / 0.30)' },
  expiring: { color: 'hsl(32 95% 42%)',  soft: 'hsl(38 92% 50% / 0.14)',  border: 'hsl(38 92% 50% / 0.35)' },
  expired:  { color: 'hsl(0 72% 51%)',   soft: 'hsl(0 84% 60% / 0.12)',   border: 'hsl(0 84% 60% / 0.30)' },
  none:     { color: C.muted,            soft: 'hsl(var(--muted))',       border: C.border },
};

export const HEALTH_SHORT: Record<Health, string> = {
  valid: 'Em dia', expiring: 'Vencendo', expired: 'Vencido', none: 'Sem exames',
};

export const HEALTH_TITLE: Record<Health, { title: string; text: string }> = {
  valid:    { title: 'Exames em dia',          text: 'AIE e mormo dentro da validade.' },
  expiring: { title: 'Exame perto de vencer',  text: 'Vale agendar a nova colheita.' },
  expired:  { title: 'Exame vencido',          text: 'Sem exame válido o animal não pode transitar.' },
  none:     { title: 'Sem exames registrados', text: 'Nenhum exame de AIE ou mormo para este animal.' },
};

// ─── Ícones ──────────────────────────────────────────────────────────────────

function Icon({ d, size = 16 }: { d: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
         strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" dangerouslySetInnerHTML={{ __html: d }} />
  );
}

export const ICON = {
  user:     '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  pin:      '<path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/>',
  chevron:  '<path d="m9 18 6-6-6-6"/>',
  pencil:   '<path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/>',
  plus:     '<path d="M5 12h14"/><path d="M12 5v14"/>',
  share:    '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>',
  file:     '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/>',
  steth:    '<path d="M11 2v2"/><path d="M5 2v2"/><path d="M5 3H4a2 2 0 0 0-2 2v4a6 6 0 0 0 12 0V5a2 2 0 0 0-2-2h-1"/><path d="M8 15a6 6 0 0 0 12 0v-3"/><circle cx="20" cy="10" r="2"/>',
};

export { Icon };

// ─── Estrutura ───────────────────────────────────────────────────────────────

/** Estilos de interação que não cabem em style inline (hover, foco, linhas clicáveis). */
export function RecordStyles() {
  return (
    <style>{`
      .rec-link { color: inherit; text-decoration: none; }
      .rec-link:hover { color: ${VET_BLUE}; text-decoration: underline; text-underline-offset: 3px; }
      .rec-row { transition: background-color 0.12s; }
      .rec-row:hover { background: hsl(var(--muted) / 0.45); }
      .rec-row:focus-visible, .rec-card:focus-visible, .rec-btn:focus-visible { outline: 2px solid ${VET_BLUE}; outline-offset: -2px; }
      .rec-card { transition: border-color 0.15s, box-shadow 0.15s, transform 0.15s; }
      a.rec-card:hover { border-color: hsl(221 83% 53% / 0.55); box-shadow: 0 8px 24px -12px hsl(221 83% 40% / 0.45); transform: translateY(-1px); }
      .rec-btn { transition: filter 0.12s, background-color 0.12s; }
      .rec-btn:hover { filter: brightness(1.08); }
      @media (prefers-reduced-motion: reduce) {
        .rec-row, .rec-card, .rec-btn { transition: none; }
        a.rec-card:hover { transform: none; }
      }
    `}</style>
  );
}

export function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="w-full max-w-5xl mx-auto px-4 md:px-8 py-6 md:py-8 space-y-6">
      <RecordStyles />
      {children}
    </main>
  );
}

export function Crumbs({ trail }: { trail: { label: string; href?: string }[] }) {
  return (
    <nav aria-label="Caminho" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, fontSize: '0.8125rem', color: C.muted }}>
      {trail.map((item, i) => (
        <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
          {i > 0 && <span style={{ opacity: 0.6 }}><Icon d={ICON.chevron} size={13} /></span>}
          {item.href
            ? <a href={item.href} className="rec-link" style={{ fontWeight: 600, color: VET_BLUE }}>{item.label}</a>
            : <span aria-current="page" style={{ color: C.fg, fontWeight: 600, overflowWrap: 'anywhere' }}>{item.label}</span>}
        </span>
      ))}
    </nav>
  );
}

export function Loading() {
  return <Shell><p style={{ color: C.muted, fontSize: '0.875rem' }}>Carregando…</p></Shell>;
}

export function Section({ title, count, aside, children, flush }: {
  title: string; count?: number; aside?: React.ReactNode; children: React.ReactNode; flush?: boolean;
}) {
  return (
    <section className="rounded-2xl border overflow-hidden" style={{ borderColor: C.border, background: C.card }}>
      <div className="px-5 md:px-6 pt-5 pb-3" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 700, letterSpacing: '-0.01em', color: C.fg }}>
          {title}
          {count !== undefined && <span style={{ color: C.muted, fontWeight: 500 }}> ({count})</span>}
        </h2>
        {aside}
      </div>
      <div className={flush ? '' : 'px-5 md:px-6 pb-5 md:pb-6'}>{children}</div>
    </section>
  );
}

export function Info({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div style={{ minWidth: 0 }}>
      <dt style={{ fontSize: '0.75rem', color: C.muted }}>{label}</dt>
      <dd style={{ fontSize: '0.875rem', color: value ? C.fg : C.muted, fontWeight: 500, margin: 0, overflowWrap: 'anywhere' }}>{value || '—'}</dd>
    </div>
  );
}

export function StatusPill({ state, children }: { state: Health; children?: React.ReactNode }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.6875rem', fontWeight: 700, whiteSpace: 'nowrap',
      padding: '3px 9px', borderRadius: 999, background: TONE[state].soft, color: TONE[state].color,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: TONE[state].color }} aria-hidden="true" />
      {children ?? HEALTH_SHORT[state]}
    </span>
  );
}

export function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ fontSize: '0.75rem', fontWeight: 500, padding: '3px 10px', borderRadius: 999, background: 'hsl(var(--muted))', color: C.muted }}>
      {children}
    </span>
  );
}

export function Avatar({ label, src, size = 72, round }: { label: string; src?: string | null; size?: number; round?: boolean }) {
  const radius = round ? '50%' : '1rem';
  if (src) {
    return <img src={src} alt="" style={{ width: size, height: size, borderRadius: radius, objectFit: 'cover', border: `1px solid ${C.border}`, flexShrink: 0 }} />;
  }
  return (
    <div aria-hidden="true" style={{
      width: size, height: size, borderRadius: radius, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.3, fontWeight: 800, color: '#fff', background: 'linear-gradient(135deg, hsl(221 83% 55%), hsl(221 83% 38%))',
    }}>
      {label.trim().slice(0, 2).toUpperCase()}
    </div>
  );
}

export function ButtonLink({ href, variant = 'outline', icon, children }: {
  href: string; variant?: 'primary' | 'outline'; icon?: string; children: React.ReactNode;
}) {
  const primary = variant === 'primary';
  return (
    <a href={href} className="rec-btn" style={{
      display: 'inline-flex', alignItems: 'center', gap: 6, padding: '0.5rem 0.9375rem', borderRadius: '0.625rem',
      fontSize: '0.8125rem', fontWeight: 600, textDecoration: 'none', whiteSpace: 'nowrap',
      background: primary ? VET_BLUE : 'transparent', color: primary ? '#fff' : C.fg,
      border: `1px solid ${primary ? VET_BLUE : C.border}`,
    }}>
      {icon && <Icon d={icon} size={14} />}
      {children}
    </a>
  );
}

// ─── Vínculos ────────────────────────────────────────────────────────────────

/**
 * Cartão de um cadastro relacionado (proprietário ou propriedade). O cartão
 * inteiro leva para a ficha do cadastro.
 */
export function LinkCard({ eyebrow, icon, title, href, facts, footer }: {
  eyebrow: string; icon: string; title: string; href: string;
  facts: [string, string | null | undefined][]; footer?: string;
}) {
  const shown = facts.filter(([, value]) => !!value);
  return (
    <a href={href} className="rec-card rounded-2xl border p-5 flex flex-col no-underline"
       style={{ borderColor: C.border, background: C.card, textDecoration: 'none', minWidth: 0 }}>
      <Eyebrow icon={icon}>{eyebrow}</Eyebrow>
      <p style={{ fontSize: '1.0625rem', fontWeight: 700, letterSpacing: '-0.01em', color: C.fg, marginTop: 8, overflowWrap: 'anywhere' }}>{title}</p>
      {shown.length > 0 && (
        <dl style={{ margin: '10px 0 0', display: 'grid', gap: 5 }}>
          {shown.map(([label, value]) => (
            <div key={label} style={{ display: 'flex', gap: 8, fontSize: '0.8125rem', minWidth: 0 }}>
              <dt style={{ color: C.muted, flexShrink: 0, width: 92 }}>{label}</dt>
              <dd style={{ margin: 0, color: C.fg, overflowWrap: 'anywhere', minWidth: 0 }}>{value}</dd>
            </div>
          ))}
        </dl>
      )}
      <span style={{ marginTop: 'auto', paddingTop: 14, display: 'block' }}>
        <span style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap',
          borderTop: `1px solid ${C.border}`, paddingTop: 12, fontSize: '0.8125rem',
        }}>
          <span style={{ color: C.muted }}>{footer}</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, whiteSpace: 'nowrap', fontWeight: 600, color: VET_BLUE }}>
            Abrir ficha <Icon d={ICON.chevron} size={14} />
          </span>
        </span>
      </span>
    </a>
  );
}

/** Vínculo que ainda não existe (ex.: animal sem propriedade). */
export function EmptyLinkCard({ eyebrow, icon, title, text, action }: {
  eyebrow: string; icon: string; title: string; text: string; action?: { href: string; label: string };
}) {
  return (
    <div className="rounded-2xl border p-5 flex flex-col" style={{ borderColor: C.border, borderStyle: 'dashed', minWidth: 0 }}>
      <Eyebrow icon={icon} muted>{eyebrow}</Eyebrow>
      <p style={{ fontSize: '1rem', fontWeight: 700, color: C.fg, marginTop: 8 }}>{title}</p>
      <p style={{ fontSize: '0.8125rem', color: C.muted, marginTop: 4, lineHeight: 1.5 }}>{text}</p>
      {action && (
        <a href={action.href} className="rec-link" style={{ marginTop: 'auto', paddingTop: 14, fontSize: '0.8125rem', fontWeight: 600, color: VET_BLUE }}>
          {action.label} →
        </a>
      )}
    </div>
  );
}

function Eyebrow({ icon, muted, children }: { icon: string; muted?: boolean; children: React.ReactNode }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.muted }}>
      <span style={{
        width: 28, height: 28, borderRadius: 8, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        background: muted ? 'hsl(var(--muted))' : VET_BLUE_LIGHT, color: muted ? C.muted : VET_BLUE,
      }}>
        <Icon d={icon} size={15} />
      </span>
      {children}
    </span>
  );
}

// ─── Situação sanitária ──────────────────────────────────────────────────────

/** Resumo de um conjunto de animais: total e quantos em cada situação. */
export function HealthStrip({ summary, total }: { summary: Record<Health, number>; total: number }) {
  const cells: { key: Health | 'total'; label: string; value: number }[] = [
    { key: 'total',    label: total === 1 ? 'Animal' : 'Animais', value: total },
    { key: 'valid',    label: 'Em dia',     value: summary.valid },
    { key: 'expiring', label: 'Vencendo',   value: summary.expiring },
    { key: 'expired',  label: 'Vencidos',   value: summary.expired },
    { key: 'none',     label: 'Sem exames', value: summary.none },
  ];
  return (
    <dl className="grid grid-cols-2 sm:grid-cols-5 gap-3">
      {cells.map(cell => {
        const tone = cell.key === 'total' ? null : TONE[cell.key];
        const dim = cell.key !== 'total' && cell.value === 0;
        return (
          <div key={cell.key} className={`rounded-xl border px-4 py-3${cell.key === 'total' ? ' col-span-2 sm:col-span-1' : ''}`}
               style={{ borderColor: C.border, background: C.card, opacity: dim ? 0.55 : 1 }}>
            <dt style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', color: C.muted }}>
              {tone && <span style={{ width: 7, height: 7, borderRadius: '50%', background: tone.color }} aria-hidden="true" />}
              {cell.label}
            </dt>
            <dd style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.02em', color: C.fg, fontVariantNumeric: 'tabular-nums' }}>
              {cell.value}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

export interface ExamForCard {
  id: string;
  exam_type: ExamType;
  collection_date: string | null;
  laboratory: string | null;
  laudo_available: boolean;
}

/** AIE e mormo lado a lado: o exame mais recente de cada um, com a validade. */
export function SanitaryCards({ exams }: { exams: readonly ExamForCard[] }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {(['aie', 'mormo'] as ExamGroup[]).map(group => {
        const exam = latestExam(exams, group);
        const validity = examValidity(exam?.collection_date);
        const state: Health = validity?.state ?? 'none';
        const short = EXAM_GROUP_LABEL[group].short;
        return (
          <article key={group} className="rounded-2xl border p-5 flex flex-col"
                   style={{ borderColor: C.border, background: C.card, borderStyle: exam ? 'solid' : 'dashed' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ minHeight: 44 }}>
                <h3 style={{ fontSize: '1.0625rem', fontWeight: 800, letterSpacing: '-0.01em', color: C.fg }}>{short}</h3>
                {EXAM_GROUP_LABEL[group].long !== short && <p style={{ fontSize: '0.75rem', color: C.muted }}>{EXAM_GROUP_LABEL[group].long}</p>}
              </div>
              <StatusPill state={state}>{validity ? validity.label : 'Sem exame'}</StatusPill>
            </div>

            {exam && validity ? (
              <>
                <p style={{ marginTop: 14, fontSize: '0.75rem', color: C.muted }}>{validity.state === 'expired' ? 'Venceu em' : 'Válido até'}</p>
                <p style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.02em', color: C.fg, fontVariantNumeric: 'tabular-nums' }}>
                  {formatBrDate(validity.until)}
                </p>
                <div role="progressbar" aria-valuenow={validity.remainingPct} aria-valuemin={0} aria-valuemax={100}
                     aria-label={`Validade restante do exame de ${short}`}
                     style={{ marginTop: 10, height: 6, borderRadius: 999, overflow: 'hidden', background: 'hsl(var(--muted))' }}>
                  <div style={{ height: '100%', borderRadius: 999, width: `${validity.remainingPct}%`, background: TONE[state].color }} />
                </div>
                <p style={{ marginTop: 12, fontSize: '0.8125rem', color: C.muted, lineHeight: 1.5 }}>
                  Colheita em <span style={{ color: C.fg, fontWeight: 500 }}>{formatBrDate(exam.collection_date)}</span>
                  {' · '}{EXAM_LABEL[exam.exam_type]}
                  {exam.laboratory ? ` · ${exam.laboratory}` : ''}
                </p>
                <div style={{ marginTop: 'auto', paddingTop: 14 }}>
                  {exam.laudo_available ? (
                    <a href={`/api/sgq/laudo?id=${exam.id}`} target="_blank" rel="noreferrer" className="rec-link"
                       style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.8125rem', fontWeight: 600, color: VET_BLUE }}>
                      <Icon d={ICON.file} size={14} /> Abrir laudo (PDF)
                    </a>
                  ) : (
                    <span style={{ fontSize: '0.8125rem', color: C.muted }}>Laudo aguardando o laboratório</span>
                  )}
                </div>
              </>
            ) : (
              <p style={{ marginTop: 14, fontSize: '0.8125rem', color: C.muted, lineHeight: 1.5 }}>
                Nenhum exame de {short} registrado para este animal.
              </p>
            )}
          </article>
        );
      })}
    </div>
  );
}

// ─── Lista de animais ────────────────────────────────────────────────────────

/**
 * Animais de um proprietário ou de uma propriedade. Cada linha leva para a
 * ficha do animal; `context` mostra o outro lado do vínculo (a propriedade,
 * na ficha do proprietário, e o proprietário, na ficha da propriedade).
 */
export function AnimalList({ animals, context, emptyText }: {
  animals: readonly AnimalLite[];
  context?: (animal: AnimalLite) => string | null;
  emptyText: string;
}) {
  const [query, setQuery] = useState('');
  const sorted = useMemo(() => sortByUrgency(animals), [animals]);
  const q = query.trim().toLowerCase();
  const visible = q
    ? sorted.filter(a => [a.name, a.breed, a.species, context?.(a)].some(v => (v ?? '').toLowerCase().includes(q)))
    : sorted;

  if (animals.length === 0) {
    return <p className="px-5 md:px-6 pb-6" style={{ fontSize: '0.875rem', color: C.muted, lineHeight: 1.6 }}>{emptyText}</p>;
  }

  return (
    <>
      {animals.length > 8 && (
        <div className="px-5 md:px-6 pb-3">
          <input type="search" value={query} onChange={e => setQuery(e.target.value)} aria-label="Procurar animal"
                 placeholder={`Procurar entre ${plural(animals.length, 'animal', 'animais')}`}
                 style={{ ...inputStyle, maxWidth: 320 }} />
        </div>
      )}
      {visible.length === 0 ? (
        <p className="px-5 md:px-6 pb-6" style={{ fontSize: '0.875rem', color: C.muted }}>Nenhum animal encontrado para a busca.</p>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {visible.map(animal => {
            const state = animalHealth(animal);
            const detail = [animal.breed ?? animal.species, animal.sex].filter(Boolean).join(' · ');
            const extra = context?.(animal);
            return (
              <li key={animal.id} style={{ borderTop: `1px solid ${C.border}` }}>
                <a href={`/vet/equino/${animal.id}`} className="rec-row px-5 md:px-6"
                   style={{ display: 'flex', alignItems: 'center', gap: 12, paddingTop: 11, paddingBottom: 11, textDecoration: 'none' }}>
                  <span style={{ width: 9, height: 9, borderRadius: '50%', flexShrink: 0, background: TONE[state].color }} aria-hidden="true" />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: C.fg, overflowWrap: 'break-word' }}>
                      {animal.name}
                      {animal.shared_with_owner && (
                        <span style={{ display: 'inline-block', whiteSpace: 'nowrap', marginLeft: 8, fontSize: '0.625rem', fontWeight: 700, padding: '1px 6px', borderRadius: 999, background: TONE.valid.soft, color: TONE.valid.color, verticalAlign: 'middle' }}>
                          compartilhado
                        </span>
                      )}
                    </span>
                    <span style={{ display: 'block', fontSize: '0.75rem', color: C.muted, overflowWrap: 'break-word' }}>
                      {[detail, extra].filter(Boolean).join(' — ') || 'Equino'}
                    </span>
                  </span>
                  <StatusPill state={state} />
                  <span style={{ color: C.muted, flexShrink: 0 }}><Icon d={ICON.chevron} size={15} /></span>
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
