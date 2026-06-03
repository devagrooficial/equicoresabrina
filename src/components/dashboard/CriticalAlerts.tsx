// ─── CriticalAlerts.tsx ──────────────────────────────────────────────────────
// REGRA: exportação NOMEADA obrigatória

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Alert {
  id: string;
  type: 'vaccine' | 'exam' | 'urgent';
  horse: string;
  description: string;
  daysLeft: number | null; // negativo = vencida; null = sem data (pendente)
  equineId?: string;
}

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

function getUrgencyConfig(daysLeft: number | null) {
  // Vencida ou crítica (<= 3 dias)
  if (daysLeft !== null && daysLeft <= 3) {
    return {
      bg: 'hsl(0 84.2% 60.2% / 0.08)',
      border: 'hsl(0 84.2% 60.2% / 0.25)',
      iconColor: 'hsl(0 84.2% 60.2%)',
      badgeBg: 'hsl(0 84.2% 60.2% / 0.12)',
      badgeText: 'hsl(0 84.2% 40%)',
      label: daysLeft < 0 ? 'VENCIDA' : 'CRÍTICO',
    };
  }
  if (daysLeft !== null && daysLeft <= 7) {
    return {
      bg: 'hsl(340 82% 52% / 0.08)',
      border: 'hsl(340 82% 52% / 0.25)',
      iconColor: 'hsl(340 82% 52%)',
      badgeBg: 'hsl(340 82% 52% / 0.12)',
      badgeText: 'hsl(340 82% 32%)',
      label: 'URGENTE',
    };
  }
  if (daysLeft !== null && daysLeft <= 15) {
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
    <a
      href={alert.equineId ? `/dashboard/equino/${alert.equineId}` : '/dashboard/alertas'}
      className="group flex items-start gap-3 p-3 rounded-xl border transition-all duration-200 cursor-pointer hover:scale-[1.01] no-underline"
      style={{
        background: cfg.bg,
        borderColor: cfg.border,
        textDecoration: 'none',
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
          {alert.daysLeft === null ? (
            <span className="font-semibold" style={{ color: cfg.iconColor }}>Aguardando data</span>
          ) : alert.daysLeft < 0 ? (
            <>Vencida há{' '}<span className="font-semibold" style={{ color: cfg.iconColor }}>{Math.abs(alert.daysLeft)} dia{Math.abs(alert.daysLeft) !== 1 ? 's' : ''}</span></>
          ) : (
            <>Vence em{' '}<span className="font-semibold" style={{ color: cfg.iconColor }}>{alert.daysLeft} dia{alert.daysLeft !== 1 ? 's' : ''}</span></>
          )}
        </p>
      </div>

      {/* Badge */}
      <span
        className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full tracking-wide"
        style={{ background: cfg.badgeBg, color: cfg.badgeText }}
      >
        {cfg.label}
      </span>
    </a>
  );
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export const CriticalAlerts = ({ alerts = [], total }: { alerts?: Alert[]; total?: number }) => {
  const count = total ?? alerts.length;
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
          {count}
        </span>
      </div>

      {/* Alerts list */}
      <div className="flex-1 flex flex-col gap-2 p-4 overflow-y-auto">
        {alerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-8 gap-1">
            <span style={{ fontSize: '1.5rem' }}>✅</span>
            <p className="text-sm font-semibold" style={{ color: 'hsl(var(--foreground))' }}>Nenhum alerta crítico</p>
            <p className="text-xs" style={{ color: 'hsl(var(--muted-foreground))' }}>Tudo em ordem por aqui</p>
          </div>
        ) : (
          alerts.map((alert) => (
            <AlertItem key={alert.id} alert={alert} />
          ))
        )}
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
