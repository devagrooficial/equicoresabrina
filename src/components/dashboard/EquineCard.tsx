// ─── EquineCard.tsx ───────────────────────────────────────────────────────────
// REGRA: exportação NOMEADA obrigatória

// ─── Types ────────────────────────────────────────────────────────────────────

export type EquineStatus =
  | 'healthy'
  | 'vaccine_due'
  | 'doc_pending'
  | 'critical';

export interface Equine {
  id: string;
  name: string;
  breed: string;
  age: number;
  /** Texto pronto de idade (ex.: "7 anos"). Tem prioridade sobre `age`. */
  ageText?: string;
  status: EquineStatus;
  photoUrl?: string;
  /** Initials shown when photoUrl is absent */
  initials?: string;
}

// ─── Status Config ────────────────────────────────────────────────────────────

function getStatusConfig(status: EquineStatus) {
  switch (status) {
    case 'healthy':
      return {
        label: 'SAÚDE EM DIA',
        bg: 'hsl(142 71% 45% / 0.12)',
        text: 'hsl(142 71% 28%)',
        dot: 'hsl(142 71% 45%)',
        dotDark: 'hsl(142 71% 55%)',
      };
    case 'vaccine_due':
      return {
        label: 'VACINA VENCENDO',
        bg: 'hsl(38 92% 50% / 0.12)',
        text: 'hsl(38 92% 28%)',
        dot: 'hsl(38 92% 50%)',
        dotDark: 'hsl(38 92% 60%)',
      };
    case 'doc_pending':
      return {
        label: 'DOC PENDENTE',
        bg: 'hsl(340 82% 52% / 0.12)',
        text: 'hsl(340 82% 35%)',
        dot: 'hsl(340 82% 52%)',
        dotDark: 'hsl(340 82% 65%)',
      };
    case 'critical':
      return {
        label: 'ATENÇÃO URGENTE',
        bg: 'hsl(0 84.2% 60.2% / 0.12)',
        text: 'hsl(0 84.2% 38%)',
        dot: 'hsl(0 84.2% 60.2%)',
        dotDark: 'hsl(0 84.2% 70%)',
      };
  }
}

// ─── Avatar ───────────────────────────────────────────────────────────────────

// Deterministic pastel color from name for avatar bg
function nameToColor(name: string): string {
  const palettes = [
    'hsl(168 60% 35%)',
    'hsl(200 70% 40%)',
    'hsl(250 60% 50%)',
    'hsl(30 80% 45%)',
    'hsl(330 65% 45%)',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash += name.charCodeAt(i);
  return palettes[hash % palettes.length];
}

function EquineAvatar({
  name,
  initials,
  photoUrl,
}: {
  name: string;
  initials?: string;
  photoUrl?: string;
}) {
  const abbr = initials ?? name.slice(0, 2).toUpperCase();

  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt={name}
        className="w-12 h-12 rounded-xl object-cover shrink-0"
        onError={(e) => {
          (e.currentTarget as HTMLImageElement).style.display = 'none';
        }}
      />
    );
  }

  return (
    <div
      className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 text-sm font-bold text-white"
      style={{ background: nameToColor(name) }}
    >
      {abbr}
    </div>
  );
}

// ─── Chevron Icon ─────────────────────────────────────────────────────────────

function ChevronRightIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export const EquineCard = ({ equine }: { equine: Equine }) => {
  const status = getStatusConfig(equine.status);

  return (
    <a
      href={`/dashboard/equino/${equine.id}`}
      className="group flex items-center gap-4 px-4 py-3.5 rounded-xl border transition-all duration-200 cursor-pointer hover:shadow-md hover:-translate-y-px no-underline"
      style={{
        background: 'hsl(var(--card))',
        borderColor: 'hsl(var(--border))',
        display: 'flex',
        textDecoration: 'none',
        color: 'inherit',
      }}
      aria-label={`Ver perfil de ${equine.name}`}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor =
          'hsl(168 83% 29% / 0.35)';
        (e.currentTarget as HTMLElement).style.background =
          'hsl(var(--muted) / 0.5)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor =
          'hsl(var(--border))';
        (e.currentTarget as HTMLElement).style.background =
          'hsl(var(--card))';
      }}
    >
      {/* Avatar */}
      <EquineAvatar
        name={equine.name}
        initials={equine.initials}
        photoUrl={equine.photoUrl}
      />

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p
          className="text-sm font-bold leading-tight truncate"
          style={{ color: 'hsl(var(--foreground))' }}
        >
          {equine.name}
        </p>
        <p
          className="text-xs mt-0.5 truncate"
          style={{ color: 'hsl(var(--muted-foreground))' }}
        >
          {equine.breed} · {equine.ageText ?? `${equine.age} ${equine.age === 1 ? 'ano' : 'anos'}`}
        </p>
      </div>

      {/* Status Badge */}
      <div className="flex items-center gap-3 shrink-0">
        <span
          className="flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full tracking-wide whitespace-nowrap"
          style={{ background: status.bg, color: status.text }}
        >
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{ background: status.dot }}
          />
          {status.label}
        </span>

        {/* Arrow */}
        <span
          className="opacity-0 group-hover:opacity-100 transition-opacity duration-200"
          style={{ color: 'hsl(var(--muted-foreground))' }}
        >
          <ChevronRightIcon />
        </span>
      </div>
    </a>
  );
};
