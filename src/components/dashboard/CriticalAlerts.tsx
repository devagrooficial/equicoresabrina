// ─── CriticalAlerts.tsx ──────────────────────────────────────────────────────
// REGRA: exportação NOMEADA obrigatória

// ─── Types ────────────────────────────────────────────────────────────────────

interface Alert {
  id: string;
  type: 'vaccine' | 'exam' | 'urgent';
  horse: string;
  description: string;
  daysLeft: number;
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

const ALERTS: Alert[] = [
  {
    id: '1',
    type: 'vaccine',
    horse: 'Trovão',
    description: 'Raiva',
    daysLeft: 15,
  },
  {
    id: '2',
    type: 'vaccine',
    horse: 'Serena',
    description: 'Influenza',
    daysLeft: 6,
  },
  {
    id: '3',
    type: 'exam',
    horse: 'Duque',
    description: 'Exame de Mormo',
    daysLeft: 3,
  },
];

// ─── Icons ────────────────────────────────────────────────────────────────────

function AlertIcon({ type }: { type: Alert['type'] }) {
  if (type === 'exam') {
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
        <path d="M9 12h6" />
        <path d="M12 9v6" />
        <path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
      </svg>
    );
  }
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
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
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

// ─── Urgency config ───────────────────────────────────────────────────────────

function getUrgencyConfig(daysLeft: number) {
  if (daysLeft <= 5) {
    return {
      bg: 'hsl(0 84.2% 60.2% / 0.08)',
      border: 'hsl(0 84.2% 60.2% / 0.25)',
      iconColor: 'hsl(0 84.2% 60.2%)',
      badgeBg: 'hsl(0 84.2% 60.2% / 0.12)',
      badgeText: 'hsl(0 84.2% 40%)',
      label: 'URGENTE',
    };
  }
  if (daysLeft <= 10) {
    return {
      bg: 'hsl(38 92% 50% / 0.08)',
      border: 'hsl(38 92% 50% / 0.25)',
      iconColor: 'hsl(38 92% 45%)',
      badgeBg: 'hsl(38 92% 50% / 0.12)',
      badgeText: 'hsl(38 92% 30%)',
      label: 'ATENÇÃO',
    };
  }
  return {
    bg: 'hsl(168 83% 29% / 0.06)',
    border: 'hsl(168 83% 29% / 0.2)',
    iconColor: 'hsl(168 83% 29%)',
    badgeBg: 'hsl(168 83% 29% / 0.1)',
    badgeText: 'hsl(168 83% 25%)',
    label: 'PENDENTE',
  };
}

// ─── Single Alert Item ────────────────────────────────────────────────────────

function AlertItem({ alert }: { alert: Alert }) {
  const cfg = getUrgencyConfig(alert.daysLeft);

  return (
    <div
      className="group flex items-start gap-3 p-3 rounded-xl border transition-all duration-200 cursor-pointer hover:scale-[1.01]"
      style={{
        background: cfg.bg,
        borderColor: cfg.border,
      }}
    >
      {/* Icon */}
      <div
        className="mt-0.5 shrink-0 w-7 h-7 rounded-lg flex items-center justify-center"
        style={{ background: cfg.badgeBg, color: cfg.iconColor }}
      >
        <AlertIcon type={alert.type} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p
          className="text-sm font-semibold leading-tight"
          style={{ color: 'hsl(var(--foreground))' }}
        >
          {alert.description}
          <span
            className="ml-1 font-normal"
            style={{ color: 'hsl(var(--muted-foreground))' }}
          >
            — {alert.horse}
          </span>
        </p>
        <p
          className="text-xs mt-0.5"
          style={{ color: 'hsl(var(--muted-foreground))' }}
        >
          Vence em{' '}
          <span className="font-semibold" style={{ color: cfg.iconColor }}>
            {alert.daysLeft} dias
          </span>
        </p>
      </div>

      {/* Badge */}
      <span
        className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full tracking-wide"
        style={{ background: cfg.badgeBg, color: cfg.badgeText }}
      >
        {cfg.label}
      </span>
    </div>
  );
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export const CriticalAlerts = () => {
  return (
    <div
      className="rounded-2xl border h-full flex flex-col"
      style={{
        background: 'hsl(var(--card))',
        borderColor: 'hsl(var(--border))',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-5 py-4 border-b"
        style={{ borderColor: 'hsl(var(--border))' }}
      >
        <div className="flex items-center gap-2">
          <div
            className="w-2 h-2 rounded-full animate-pulse"
            style={{ background: 'hsl(0 84.2% 60.2%)' }}
          />
          <h2
            className="text-sm font-semibold tracking-tight"
            style={{ color: 'hsl(var(--foreground))' }}
          >
            Alertas Críticos
          </h2>
        </div>
        <span
          className="text-xs font-bold px-2 py-0.5 rounded-full"
          style={{
            background: 'hsl(0 84.2% 60.2% / 0.12)',
            color: 'hsl(0 84.2% 50%)',
          }}
        >
          {ALERTS.length}
        </span>
      </div>

      {/* Alerts list */}
      <div className="flex-1 flex flex-col gap-2 p-4 overflow-y-auto">
        {ALERTS.map((alert) => (
          <AlertItem key={alert.id} alert={alert} />
        ))}
      </div>

      {/* Footer CTA */}
      <div
        className="px-5 py-3 border-t"
        style={{ borderColor: 'hsl(var(--border))' }}
      >
        <a
          href="/dashboard/alertas"
          className="flex items-center justify-center gap-1.5 w-full text-xs font-medium py-2 rounded-lg transition-all duration-200 hover:bg-[hsl(var(--muted))]"
          style={{ color: 'hsl(var(--muted-foreground))' }}
        >
          Ver todos os alertas
          <ChevronRightIcon />
        </a>
      </div>
    </div>
  );
};
