import { useState } from 'react';
import { createClient } from '../../lib/supabase';
type Tab = 'overview' | 'health' | 'documents';

export interface EquineProfileData {
  id: string;
  name: string;
  nickname?: string | null;
  breed: string;
  sex: string;
  coat: string;
  age: string;
  registration: string;
  healthStatus: string;
  // Nutrição
  feedKgDay?: number | null;
  feedBrand?: string | null;
  hayKgDay?: number | null;
  hayType?: string | null;
  waterAccess?: string | null;
  supplements?: string | null;
  // Físico
  weightKg?: number | null;
  heightCm?: number | null;
  bcs?: number | null;
  // Genealogia
  fatherName?: string | null;
  fatherReg?: string | null;
  motherName?: string | null;
  motherReg?: string | null;
  patGrandfather?: string | null;
  patGrandmother?: string | null;
  matGrandfather?: string | null;
  matGrandmother?: string | null;
}

const BREED_LABEL: Record<string, string> = {
  QUARTO_DE_MILHA: 'Quarto de Milha', MANGALARGA_MARCHADOR: 'Mangalarga Marchador',
  PURO_SANGUE_INGLES: 'Puro Sangue Inglês', LUSITANO: 'Lusitano',
  BRASILEIRO_DE_HIPISMO: 'Brasileiro de Hipismo', CRIOULO: 'Crioulo',
  CAMPOLINA: 'Campolina', APPALOOSA: 'Appaloosa', PAINT_HORSE: 'Paint Horse',
  ANDALUZ: 'Andaluz', ARABE: 'Árabe', HAFLINGER: 'Haflinger',
  FRIESIO: 'Frísio', ARDENÊS: 'Ardenês', OTHER: 'Outra raça',
};
const SEX_LABEL: Record<string, string> = {
  GARANHAO: 'Garanhão', CASTRADO: 'Castrado', EGUA: 'Égua',
  POTRANCA: 'Potranca', POTRO: 'Potro', POTRO_CASTRADO: 'Potro castrado',
};
const COAT_LABEL: Record<string, string> = {
  ALAZAO: 'Alazão', TORDILHO: 'Tordilho', RUAO: 'Ruão', BAYO: 'Baio',
  ZAINO: 'Zaino', ROSILHO: 'Rosilho', PAMPA: 'Pampa', MALHADO: 'Malhado',
  PRETO: 'Preto', BRANCO: 'Branco', ISABELA: 'Isabela', PALOMINO: 'Palomino', OTHER: 'Outro',
};

function label(map: Record<string, string>, val: string) {
  return map[val] ?? val;
}

const C = {
  green: 'hsl(168 83% 29%)',
  greenLight: 'hsl(168 83% 40% / 0.15)',
  amber: 'hsl(38 92% 50%)',
  amberLight: 'hsl(38 92% 50% / 0.12)',
  amberText: 'hsl(38 92% 28%)',
  red: 'hsl(0 84.2% 55%)',
  redLight: 'hsl(0 84.2% 55% / 0.10)',
  redText: 'hsl(0 84.2% 38%)',
  fg: 'hsl(var(--foreground))',
  muted: 'hsl(var(--muted-foreground))',
  card: 'hsl(var(--card))',
  border: 'hsl(var(--border))',
  bg: 'hsl(var(--background))',
};

const s = {
  card: { background: C.card, border: `1px solid ${C.border}`, borderRadius: '1rem', padding: '1.25rem' } as React.CSSProperties,
  row: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.625rem 0', borderBottom: `1px solid ${C.border}` } as React.CSSProperties,
};

function Svg({ d, size = 16 }: { d: string; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: d }} />;
}

const ICONS = {
  back: '<path d="m15 18-6-6 6-6"/>',
  cal: '<rect width="18" height="18" x="3" y="4" rx="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/>',
  sex: '<circle cx="11" cy="11" r="4"/><path d="m21 21-4.35-4.35"/><path d="M15 11h6"/><path d="M18 8V5h-3"/>',
  palette: '<circle cx="13.5" cy="6.5" r=".5"/><circle cx="17.5" cy="10.5" r=".5"/><circle cx="8.5" cy="7.5" r=".5"/><circle cx="6.5" cy="12.5" r=".5"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/>',
  tag: '<path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z"/><path d="M7 7h.01"/>',
  syringe: '<path d="m18 2 4 4"/><path d="m17 7 3-3"/><path d="M19 9 8.7 19.3c-1 1-2.5 1-3.4 0l-.6-.6c-1-1-1-2.5 0-3.4L15 5"/><path d="m9 11 4 4"/><path d="m5 19-3 3"/><path d="m14 4 6 6"/>',
  scissors: '<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><line x1="20" x2="8.12" y1="4" y2="15.88"/><line x1="14.47" x2="20" y1="14.48" y2="20"/><line x1="8.12" x2="12" y1="8.12" y2="12"/>',
  file: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="m9 15 2 2 4-4"/>',
  warn: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  leaf: '<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>',
  dna: '<path d="M2 15c6.667-6 13.333 0 20-6"/><path d="M9 22c1.798-1.998 2.518-3.995 2.807-5.993"/><path d="M22 9c-1.798 1.998-2.518 3.995-2.807 5.993"/><path d="m2 9 4 4"/><path d="m18 15 4 4"/><path d="m2 15 4-4"/><path d="m18 9 4-4"/>',
  drop: '<path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/>',
  wheat: '<path d="M2 22 16 8"/><path d="M3.47 12.53 5 11l1.53 1.53a3.5 3.5 0 0 1 0 4.94L5 19l-1.53-1.53a3.5 3.5 0 0 1 0-4.94z"/><path d="M7.47 8.53 9 7l1.53 1.53a3.5 3.5 0 0 1 0 4.94L9 15l-1.53-1.53a3.5 3.5 0 0 1 0-4.94z"/><path d="M11.47 4.53 13 3l1.53 1.53a3.5 3.5 0 0 1 0 4.94L13 11l-1.53-1.53a3.5 3.5 0 0 1 0-4.94z"/><path d="M20 2H22v2a4 4 0 0 1-4 4h-2V6a4 4 0 0 1 4-4z"/><path d="M11.47 17.47 13 19l-1.53 1.53a3.5 3.5 0 0 1-4.94 0L5 19l1.53-1.53a3.5 3.5 0 0 1 4.94 0z"/><path d="M15.47 13.47 17 15l-1.53 1.53a3.5 3.5 0 0 1-4.94 0L9 15l1.53-1.53a3.5 3.5 0 0 1 4.94 0z"/><path d="M19.47 9.47 21 11l-1.53 1.53a3.5 3.5 0 0 1-4.94 0L13 11l1.53-1.53a3.5 3.5 0 0 1 4.94 0z"/>',
};

function Dot({ color }: { color: string }) {
  return <span style={{ width: 7, height: 7, borderRadius: '50%', background: color, display: 'inline-block', flexShrink: 0 }} />;
}

function Badge({ status }: { status: 'valid' | 'warning' | 'urgent' }) {
  const cfg = {
    valid: { bg: 'hsl(142 71% 45% / 0.12)', text: 'hsl(142 71% 26%)', dot: 'hsl(142 71% 40%)', label: 'VÁLIDO' },
    warning: { bg: C.amberLight, text: C.amberText, dot: C.amber, label: 'VENCENDO' },
    urgent: { bg: C.redLight, text: C.redText, dot: C.red, label: 'URGENTE' },
  }[status];
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 999, background: cfg.bg, color: cfg.text, letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>
      <Dot color={cfg.dot} />{cfg.label}
    </span>
  );
}

function SectionLabel({ label }: { label: string }) {
  return <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: C.muted, marginBottom: 12 }}>{label}</p>;
}

function StatCard({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: '0.875rem', padding: '0.875rem', display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ color: C.green }}><Svg d={icon} size={15} /></span>
      <span style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: C.muted }}>{label}</span>
      <span style={{ fontSize: '0.9rem', fontWeight: 700, color: C.fg }}>{value}</span>
    </div>
  );
}


// ─── Genealogy Tree ───────────────────────────────────────────────────────────

type GeneNode = { name: string; reg?: string; coat?: string; role?: string; isRoot?: boolean };

function GeneNode({ node, highlight }: { node: GeneNode; highlight?: boolean }) {
  const initials = node.name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
      background: highlight ? `hsl(168 83% 29% / 0.08)` : 'hsl(var(--muted) / 0.5)',
      border: `1px solid ${highlight ? C.green : C.border}`,
      borderRadius: '0.75rem', padding: '8px 10px', minWidth: node.isRoot ? 96 : 84,
      boxShadow: highlight ? `0 0 0 2px hsl(168 83% 29% / 0.18)` : 'none',
      transition: 'box-shadow 0.2s',
      cursor: 'default',
    }}>
      {/* Avatar circle */}
      <div style={{
        width: node.isRoot ? 36 : 28, height: node.isRoot ? 36 : 28, borderRadius: '50%',
        background: highlight
          ? 'linear-gradient(135deg, hsl(168 83% 32%), hsl(168 83% 20%))'
          : 'linear-gradient(135deg, hsl(220 15% 55%), hsl(220 15% 40%))',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#fff', fontSize: node.isRoot ? 11 : 9, fontWeight: 800, letterSpacing: '0.02em',
      }}>
        {initials}
      </div>
      {/* Name */}
      <p style={{ fontSize: node.isRoot ? 11 : 10, fontWeight: 700, color: C.fg, textAlign: 'center', lineHeight: 1.3, margin: 0 }}>
        {node.name}
      </p>
      {/* Sub-label */}
      {(node.role || node.reg) && (
        <p style={{ fontSize: 9, color: C.muted, textAlign: 'center', fontWeight: 500, margin: 0, lineHeight: 1.2 }}>
          {node.role ?? node.reg}
        </p>
      )}
      {node.coat && (
        <span style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.06em', color: C.green, textTransform: 'uppercase' }}>
          {node.coat}
        </span>
      )}
    </div>
  );
}

function GenealogyTree({ equine }: { equine: EquineProfileData }) {
  const hasFather = !!equine.fatherName;
  const hasMother = !!equine.motherName;
  const hasTree = hasFather || hasMother;

  if (!hasTree) return null;

  const tree = {
    root: { name: equine.nickname || equine.name, reg: equine.registration, coat: label(COAT_LABEL, equine.coat), isRoot: true },
    parents: [
      hasFather ? { name: equine.fatherName!, reg: equine.fatherReg || undefined, coat: undefined, role: 'Pai' } : null,
      hasMother ? { name: equine.motherName!, reg: equine.motherReg || undefined, coat: undefined, role: 'Mãe' } : null,
    ].filter(Boolean) as GeneNode[],
    grandparents: [
      equine.patGrandfather ? { name: equine.patGrandfather, role: 'Avô Pat.' } : null,
      equine.patGrandmother ? { name: equine.patGrandmother, role: 'Avó Pat.' } : null,
      equine.matGrandfather ? { name: equine.matGrandfather, role: 'Avô Mat.' } : null,
      equine.matGrandmother ? { name: equine.matGrandmother, role: 'Avó Mat.' } : null,
    ].filter(Boolean) as GeneNode[],
  };

  // SVG connector lines — drawn over the layout
  // We use a relative container with absolute SVG overlay
  const LINE = C.border;
  const LINE_H = 'hsl(168 83% 29%)'; // green for root line

  return (
    <div style={{ ...s.card, overflow: 'hidden' }}>
      <SectionLabel label="Árvore Genealógica — 3 Gerações" />

      {/* Scroll wrapper — title stays fixed, diagram scrolls on mobile */}
      <div className="eq-tree-scroll">
        {/* Inner tree — forced min-width so nodes never squish */}
        <div className="eq-tree-inner" style={{ display: 'flex', alignItems: 'center', gap: 0, position: 'relative', minHeight: 220 }}>

        {/* Col 1: Root */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2, flexShrink: 0 }}>
          <GeneNode node={tree.root} highlight />
        </div>

        {/* Connector root → parents (SVG) */}
        <svg width={40} height={220} style={{ flexShrink: 0, overflow: 'visible' }} viewBox="0 0 40 220">
          {/* Line from root center to parent top */}
          <path d={`M 0 110 C 20 110, 20 55, 40 55`} stroke={LINE_H} strokeWidth="1.5" fill="none" strokeDasharray="4 2" />
          <path d={`M 0 110 C 20 110, 20 165, 40 165`} stroke={LINE} strokeWidth="1.5" fill="none" />
        </svg>

        {/* Col 2: Parents */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, zIndex: 2, flexShrink: 0 }}>
          {tree.parents.map(p => <GeneNode key={p.name} node={p} />)}
        </div>

        {/* Connector parents → grandparents (SVG) */}
        <svg width={40} height={220} style={{ flexShrink: 0, overflow: 'visible' }} viewBox="0 0 40 220">
          {/* From parent 1 (top) → gp1 and gp2 */}
          <path d={`M 0 55 C 20 55, 20 27, 40 27`} stroke={LINE} strokeWidth="1.5" fill="none" />
          <path d={`M 0 55 C 20 55, 20 83, 40 83`} stroke={LINE} strokeWidth="1.5" fill="none" />
          {/* From parent 2 (bottom) → gp3 and gp4 */}
          <path d={`M 0 165 C 20 165, 20 137, 40 137`} stroke={LINE} strokeWidth="1.5" fill="none" />
          <path d={`M 0 165 C 20 165, 20 193, 40 193`} stroke={LINE} strokeWidth="1.5" fill="none" />
        </svg>

        {/* Col 3: Grandparents */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, zIndex: 2, flexShrink: 0 }}>
          {tree.grandparents.map(gp => <GeneNode key={gp.name} node={gp} />)}
        </div>

        {/* Legend */}
        <div style={{ marginLeft: 'auto', alignSelf: 'flex-end', paddingBottom: 2, display: 'flex', flexDirection: 'column', gap: 5 }}>
          {[
            { color: LINE_H, dash: true, label: 'Linha direta' },
            { color: LINE, label: 'Linha colateral' },
          ].map(l => (
            <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <svg width={22} height={8}><line x1="0" y1="4" x2="22" y2="4" stroke={l.color} strokeWidth="1.5" strokeDasharray={l.dash ? '4 2' : 'none'} /></svg>
              <span style={{ fontSize: 9, color: C.muted, fontWeight: 500 }}>{l.label}</span>
            </div>
          ))}
          <p style={{ fontSize: 9, color: C.muted, marginTop: 4, fontWeight: 600 }}>Reg.: ABQM 2019/00458</p>
        </div>
        </div>{/* end min-w inner */}
      </div>{/* end overflow-x-auto */}
    </div>
  );
}

function NutritionTab({ equine }: { equine: EquineProfileData }) {
  const items = [
    equine.feedKgDay ? { icon: ICONS.wheat, label: 'Ração diária', value: `${equine.feedKgDay} kg/dia${equine.feedBrand ? ` — ${equine.feedBrand}` : ''}` } : null,
    equine.hayKgDay ? { icon: ICONS.leaf, label: 'Feno', value: `${equine.hayKgDay} kg/dia${equine.hayType ? ` — ${equine.hayType}` : ''}` } : null,
    equine.waterAccess ? { icon: ICONS.drop, label: 'Água', value: equine.waterAccess === 'LIVRE' ? 'Livre acesso (ad libitum)' : 'Controlado' } : null,
    equine.supplements ? { icon: ICONS.tag, label: 'Suplemento', value: equine.supplements } : null,
  ].filter(Boolean) as { icon: string; label: string; value: string }[];

  const hasPhysical = equine.weightKg || equine.heightCm || equine.bcs;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {items.length > 0 && (
        <div style={s.card}>
          <SectionLabel label="Nutrição" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 24px' }}>
            {items.map(({ icon, label: lbl, value }) => (
              <div key={lbl} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: `1px solid ${C.border}` }}>
                <span style={{ color: C.green, flexShrink: 0 }}><Svg d={icon} size={14} /></span>
                <div>
                  <p style={{ fontSize: 11, color: C.muted, fontWeight: 600 }}>{lbl}</p>
                  <p style={{ fontSize: 13, color: C.fg, fontWeight: 500, marginTop: 1 }}>{value}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {hasPhysical && (
        <div style={s.card}>
          <SectionLabel label="Dados Físicos" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 24px' }}>
            {equine.weightKg && <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${C.border}` }}><span style={{ fontSize: 11, color: C.muted, fontWeight: 600 }}>Peso</span><span style={{ fontSize: 13, color: C.fg, fontWeight: 500 }}>{equine.weightKg} kg</span></div>}
            {equine.heightCm && <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${C.border}` }}><span style={{ fontSize: 11, color: C.muted, fontWeight: 600 }}>Altura</span><span style={{ fontSize: 13, color: C.fg, fontWeight: 500 }}>{equine.heightCm} cm ({(equine.heightCm / 10).toFixed(1)} palmos)</span></div>}
            {equine.bcs && <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0' }}><span style={{ fontSize: 11, color: C.muted, fontWeight: 600 }}>Escore Corporal (BCS)</span><span style={{ fontSize: 13, color: C.fg, fontWeight: 500 }}>{equine.bcs}/9</span></div>}
          </div>
        </div>
      )}
      {items.length === 0 && !hasPhysical && (
        <div style={{ ...s.card, textAlign: 'center', color: C.muted, fontSize: 13 }}>
          <p>Nenhum dado de nutrição ou físico cadastrado.</p>
          <a href={`/dashboard/plantel/editar/${equine.id}`} style={{ color: C.green, fontWeight: 600, textDecoration: 'none', fontSize: 13 }}>Adicionar dados →</a>
        </div>
      )}
      <GenealogyTree equine={equine} />
    </div>
  );
}


function HealthTab() {
  const vaccines = [
    { name: 'Influenza Equina', date: '12/01/2026', status: 'warning' as const, days: '6 dias' },
    { name: 'Raiva', date: '08/02/2026', status: 'warning' as const, days: '15 dias' },
    { name: 'Tétano', date: '10/10/2025', status: 'valid' as const },
    { name: 'Encefalomielite', date: '05/08/2025', status: 'valid' as const },
  ];
  const manejo = [
    { label: 'Último casqueamento', value: '10/03/2026' },
    { label: 'Próximo casqueamento', value: '10/06/2026' },
    { label: 'Ferragem', value: 'Aço — 4 patas' },
    { label: 'Dentição', value: 'Revisão 15/05/2026', warn: true },
    { label: 'Vermifugação', value: 'Ivermectina — Jan/2026' },
  ];
  return (
    <div className="eq-health-grid">
      <div style={s.card}>
        <SectionLabel label="Histórico de Vacinas" />
        {vaccines.map(v => (
          <div key={v.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: `1px solid ${C.border}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: v.status === 'valid' ? C.green : C.amber }}><Svg d={ICONS.syringe} size={13} /></span>
              <div>
                <p style={{ fontSize: 13, fontWeight: 600, color: C.fg }}>{v.name}</p>
                <p style={{ fontSize: 11, color: C.muted, marginTop: 1 }}>Aplicada {v.date}{v.days ? ` · vence em ${v.days}` : ''}</p>
              </div>
            </div>
            <Badge status={v.status} />
          </div>
        ))}
      </div>
      <div style={s.card}>
        <SectionLabel label="Casqueamento e Manejo" />
        {manejo.map(m => (
          <div key={m.label} style={{ ...s.row, gap: 8 }}>
            <span style={{ fontSize: 11, color: C.muted, fontWeight: 600 }}>{m.label}</span>
            <span style={{ fontSize: 13, fontWeight: 500, color: m.warn ? C.amberText : C.fg }}>{m.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function DocumentsTab() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', gap: 10, padding: '12px 14px', borderRadius: '0.75rem', border: `1px solid hsl(0 84.2% 55% / 0.25)`, background: C.redLight }}>
        <span style={{ color: C.red, marginTop: 1 }}><Svg d={ICONS.warn} size={14} /></span>
        <div>
          <p style={{ fontSize: 13, fontWeight: 700, color: C.redText }}>Exames Obrigatórios com vencimento próximo</p>
          <p style={{ fontSize: 11, color: C.red, marginTop: 2 }}>Mormo e AIE têm validade de 60 dias. Renove antes do prazo para evitar impedimentos.</p>
        </div>
      </div>
      {[
        { name: 'Mormo (Mallein)', validity: '28/04/2026', status: 'urgent' as const, days: '3 dias', detail: 'Obrigatório para trânsito interestadual e eventos equestres', icon: ICONS.file },
        { name: 'AIE — Anemia Infecciosa Equina', validity: '01/05/2026', status: 'warning' as const, days: '5 dias', detail: 'Coggins Test — Instituto Veterinário Central', icon: ICONS.file },
        { name: 'GTA — Guia de Trânsito Animal', validity: '15/07/2026', status: 'valid' as const, detail: 'INDEA-MT — Válida para todo o território nacional', icon: ICONS.file },
        { name: 'Registro de Propriedade', validity: 'Permanente', status: 'valid' as const, detail: 'ABQM 2019/00458 — Prop.: Sabrina Santos', icon: ICONS.file },
      ].map(doc => (
        <div key={doc.name} style={{ ...s.card, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12,
          borderColor: doc.status === 'urgent' ? 'hsl(0 84.2% 55% / 0.3)' : doc.status === 'warning' ? 'hsl(38 92% 50% / 0.3)' : C.border,
          background: doc.status === 'urgent' ? C.redLight : doc.status === 'warning' ? C.amberLight : C.card,
        }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <span style={{ color: doc.status === 'urgent' ? C.red : doc.status === 'warning' ? C.amber : C.green, marginTop: 2 }}><Svg d={doc.icon} size={14} /></span>
            <div>
              <p style={{ fontSize: 13, fontWeight: 700, color: C.fg }}>{doc.name}</p>
              <p style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{doc.detail}</p>
              <p style={{ fontSize: 11, marginTop: 4, fontWeight: 600, color: doc.status === 'urgent' ? C.redText : doc.status === 'warning' ? C.amberText : C.muted }}>
                Validade: {doc.validity}{doc.days ? ` · vence em ${doc.days}` : ''}
              </p>
            </div>
          </div>
          <Badge status={doc.status} />
        </div>
      ))}
    </div>
  );
}

export const EquineProfile = ({ equine }: { equine: EquineProfileData }) => {
  const [tab, setTab] = useState<Tab>('overview');
  const [showDelete, setShowDelete] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const tabs: { id: Tab; label: string }[] = [
    { id: 'overview', label: 'Visão Geral' },
    { id: 'health', label: 'Saúde e Manejo' },
    { id: 'documents', label: 'Documentos' },
  ];

  async function handleDelete() {
    setDeleting(true);
    setDeleteError(null);
    const supabase = createClient();
    const { error } = await supabase.from('equinos').delete().eq('id', equine.id);
    if (error) {
      setDeleteError('Erro ao excluir. Tente novamente.');
      setDeleting(false);
      return;
    }
    window.location.href = '/dashboard/plantel';
  }

  const initials = equine.name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
  const displayName = equine.nickname || equine.name;
  const breedLabel = label(BREED_LABEL, equine.breed);
  const sexLabel = label(SEX_LABEL, equine.sex);
  const coatLabel = label(COAT_LABEL, equine.coat);

  const statusBadge = {
    healthy: null,
    attention: { bg: C.amberLight, color: C.amberText, dot: C.amber, text: 'ATENÇÃO' },
    urgent: { bg: 'hsl(340 82% 52% / 0.1)', color: 'hsl(340 82% 32%)', dot: 'hsl(340 82% 52%)', text: 'URGENTE' },
    critical: { bg: C.redLight, color: C.redText, dot: C.red, text: 'CRÍTICO' },
  }[equine.healthStatus];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <style>{`
        .eq-stats-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-top: 1.25rem; }
        @media (min-width: 768px) { .eq-stats-grid { grid-template-columns: repeat(4, 1fr); } }
        .eq-tree-scroll { width: 100%; overflow-x: auto; padding-bottom: 10px; -webkit-overflow-scrolling: touch; }
        .eq-tree-scroll::-webkit-scrollbar { height: 4px; }
        .eq-tree-scroll::-webkit-scrollbar-track { background: transparent; }
        .eq-tree-scroll::-webkit-scrollbar-thumb { background: hsl(168 83% 29% / 0.3); border-radius: 9999px; }
        .eq-tree-inner { min-width: 700px; }
        .eq-health-grid { display: grid; grid-template-columns: 1fr; gap: 16px; width: 100%; }
        @media (min-width: 1024px) { .eq-health-grid { grid-template-columns: repeat(2, 1fr); } }
      `}</style>

      {/* Back button */}
      <a href="/dashboard/plantel" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 13, fontWeight: 500, color: C.muted, textDecoration: 'none', width: 'fit-content' }}
        onMouseEnter={e => (e.currentTarget.style.color = C.green)} onMouseLeave={e => (e.currentTarget.style.color = C.muted)}>
        <Svg d={ICONS.back} size={15} /> Voltar ao Plantel
      </a>

      {/* Hero Card */}
      <div style={{ borderRadius: '1.25rem', border: `1px solid ${C.border}`, overflow: 'hidden', background: C.card }}>
        <div style={{ height: '11rem', position: 'relative', background: 'linear-gradient(135deg, hsl(168 83% 14%) 0%, hsl(220 60% 22%) 50%, hsl(250 55% 28%) 100%)' }}>
          <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(ellipse at 15% 60%, hsl(168 83% 35% / 0.35) 0%, transparent 55%), radial-gradient(ellipse at 85% 20%, hsl(220 70% 50% / 0.2) 0%, transparent 50%)' }} />
          <div style={{ position: 'absolute', inset: 0, opacity: 0.07, backgroundImage: 'linear-gradient(hsl(0 0% 100%) 1px, transparent 1px), linear-gradient(90deg, hsl(0 0% 100%) 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
        </div>

        <div style={{ padding: '0 1.75rem 1.75rem' }}>
          <div style={{ width: '5.5rem', height: '5.5rem', borderRadius: '1.1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.6rem', fontWeight: 900, color: '#fff', background: 'linear-gradient(135deg, hsl(168 83% 32%), hsl(168 83% 20%))', border: '4px solid hsl(var(--background))', boxShadow: '0 8px 24px hsl(168 83% 10% / 0.5)', marginTop: '-2.75rem', position: 'relative', zIndex: 10 }}>
            {initials}
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginTop: '0.875rem' }}>
            <div>
              <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: C.fg, letterSpacing: '-0.02em', lineHeight: 1.1 }}>{displayName}</h1>
              <p style={{ fontSize: 13, color: C.muted, marginTop: 3 }}>{breedLabel} &middot; {equine.age} &middot; {sexLabel} &middot; {coatLabel}</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              {statusBadge && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, padding: '6px 12px', borderRadius: 999, background: statusBadge.bg, color: statusBadge.color, letterSpacing: '0.06em', border: `1px solid ${statusBadge.dot}33` }}>
                  <Dot color={statusBadge.dot} /> {statusBadge.text}
                </span>
              )}
              <a href={`/dashboard/plantel/editar/${equine.id}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, padding: '7px 14px', borderRadius: '0.625rem', background: C.green, color: '#fff', textDecoration: 'none' }}>
                <Svg d='<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>' size={13} /> Editar
              </a>
              <button onClick={() => setShowDelete(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, padding: '7px 14px', borderRadius: '0.625rem', background: 'transparent', color: C.red, border: `1px solid ${C.red}55`, cursor: 'pointer' }}>
                <Svg d='<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>' size={13} /> Excluir
              </button>
            </div>
          </div>

          <div className="eq-stats-grid">
            <StatCard icon={ICONS.cal} label="Idade" value={equine.age} />
            <StatCard icon={ICONS.sex} label="Sexo" value={sexLabel} />
            <StatCard icon={ICONS.palette} label="Pelagem" value={coatLabel} />
            <StatCard icon={ICONS.tag} label="Registro" value={equine.registration || '—'} />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div>
        <div style={{ display: 'flex', gap: 4, padding: 4, background: 'hsl(var(--muted))', borderRadius: '0.875rem', width: 'fit-content', marginBottom: 16 }}>
          {tabs.map(t => {
            const active = tab === t.id;
            return (
              <button key={t.id} onClick={() => setTab(t.id)} style={{ padding: '7px 16px', borderRadius: '0.625rem', fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer', transition: 'all 0.18s', whiteSpace: 'nowrap', background: active ? C.card : 'transparent', color: active ? C.fg : C.muted, boxShadow: active ? '0 1px 4px hsl(0 0% 0% / 0.1)' : 'none' }}>
                {t.label}
              </button>
            );
          })}
        </div>
        {tab === 'overview' && <NutritionTab equine={equine} />}
        {tab === 'health' && <HealthTab />}
        {tab === 'documents' && <DocumentsTab />}
      </div>

      {/* Modal de exclusão */}
      {showDelete && (
        <div style={{ position: 'fixed', inset: 0, background: 'hsl(0 0% 0% / 0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 }}
          onClick={() => !deleting && setShowDelete(false)}>
          <div onClick={e => e.stopPropagation()} style={{ background: C.card, borderRadius: '1rem', border: `1px solid ${C.border}`, padding: '1.75rem', maxWidth: 420, width: '100%', boxShadow: '0 12px 48px hsl(0 0% 0% / 0.3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: C.redLight, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: C.red }}>
                <Svg d='<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/>' size={18} />
              </div>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: C.fg }}>Excluir equino</h2>
            </div>
            <p style={{ fontSize: 13, color: C.muted, lineHeight: 1.6, marginBottom: 14 }}>
              Esta ação não pode ser desfeita. Para confirmar, digite <strong style={{ color: C.fg }}>{equine.name}</strong> abaixo.
            </p>
            <input
              type="text"
              value={confirmText}
              onChange={e => setConfirmText(e.target.value)}
              placeholder={equine.name}
              autoFocus
              style={{ width: '100%', padding: '0.625rem 0.875rem', borderRadius: '0.625rem', border: `1px solid ${C.border}`, background: C.bg, color: C.fg, fontSize: 14, outline: 'none', boxSizing: 'border-box', marginBottom: deleteError ? 8 : 16 }}
            />
            {deleteError && <p style={{ fontSize: 12, color: C.red, marginBottom: 12 }}>{deleteError}</p>}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowDelete(false)} disabled={deleting} style={{ padding: '0.5625rem 1.125rem', borderRadius: '0.625rem', background: 'hsl(var(--muted))', color: C.fg, fontWeight: 600, fontSize: 13, border: 'none', cursor: deleting ? 'not-allowed' : 'pointer' }}>
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                disabled={confirmText !== equine.name || deleting}
                style={{ padding: '0.5625rem 1.125rem', borderRadius: '0.625rem', background: confirmText === equine.name && !deleting ? C.red : 'hsl(0 84.2% 55% / 0.4)', color: '#fff', fontWeight: 600, fontSize: 13, border: 'none', cursor: confirmText === equine.name && !deleting ? 'pointer' : 'not-allowed' }}
              >
                {deleting ? 'Excluindo…' : 'Excluir definitivamente'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
