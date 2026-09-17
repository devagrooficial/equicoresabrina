import { useEffect, useState } from 'react';

const C = {
  green: 'hsl(168 83% 29%)',
  greenLight: 'hsl(168 83% 29% / 0.08)',
  fg: 'hsl(var(--foreground))',
  muted: 'hsl(var(--muted-foreground))',
  card: 'hsl(var(--card))',
  border: 'hsl(var(--border))',
  bg: 'hsl(var(--background))',
  muted_bg: 'hsl(var(--muted))',
  amber: 'hsl(38 92% 50%)',
  amberText: 'hsl(38 92% 28%)',
  amberLight: 'hsl(38 92% 50% / 0.1)',
  red: 'hsl(0 84.2% 55%)',
  redText: 'hsl(0 84.2% 38%)',
  redLight: 'hsl(0 84.2% 55% / 0.08)',
  blue: 'hsl(217 91% 50%)',
  blueText: 'hsl(217 91% 32%)',
  blueLight: 'hsl(217 91% 50% / 0.1)',
};

interface SubscriptionRow {
  status: string;
  price_cents: number | null;
  currency: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
}

interface Props {
  subscription: SubscriptionRow | null;
  priceCents: number;
  currency: string;
  trialDays: number;
  productName: string;
}

const STATUS_CFG: Record<string, { label: string; bg: string; text: string }> = {
  active:    { label: 'Ativo',              bg: 'hsl(142 71% 45% / 0.12)', text: 'hsl(142 71% 28%)' },
  trialing:  { label: 'Período de teste',   bg: C.blueLight,               text: C.blueText },
  past_due:  { label: 'Pagamento atrasado', bg: C.amberLight,              text: C.amberText },
  unpaid:    { label: 'Pagamento pendente', bg: C.amberLight,              text: C.amberText },
  incomplete:{ label: 'Pagamento pendente', bg: C.amberLight,              text: C.amberText },
  canceled:  { label: 'Cancelada',          bg: C.redLight,                text: C.redText },
};

function formatMoney(cents: number, currency: string): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: currency.toUpperCase() });
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: '1rem', overflow: 'hidden', marginBottom: '1rem' }}>
      <div style={{ padding: '1rem 1.25rem', borderBottom: `1px solid ${C.border}` }}>
        <p style={{ fontSize: '0.875rem', fontWeight: 700, color: C.fg }}>{title}</p>
      </div>
      <div style={{ padding: '1.25rem' }}>{children}</div>
    </div>
  );
}

export default function AssinaturaPage({ subscription, priceCents, currency, trialDays, productName }: Props) {
  const [banner, setBanner] = useState<'success' | 'canceled' | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has('success')) setBanner('success');
    else if (params.has('canceled')) setBanner('canceled');
  }, []);

  const isActive = subscription?.status === 'active' || subscription?.status === 'trialing';
  const statusCfg = subscription ? STATUS_CFG[subscription.status] ?? { label: subscription.status, bg: C.muted_bg, text: C.muted } : null;

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.25rem', fontWeight: 800, color: C.fg, letterSpacing: '-0.02em' }}>Assinatura</h1>
        <p style={{ fontSize: '0.8125rem', color: C.muted, marginTop: 2 }}>{productName}</p>
      </div>

      {banner === 'success' && (
        <div style={{ padding: '0.875rem 1.125rem', borderRadius: '0.75rem', background: C.greenLight, border: `1px solid ${C.green}33`, color: C.green, fontSize: '0.8125rem', fontWeight: 600, marginBottom: '1.25rem' }}>
          Assinatura confirmada. Pode levar alguns instantes até o status atualizar aqui.
        </div>
      )}
      {banner === 'canceled' && (
        <div style={{ padding: '0.875rem 1.125rem', borderRadius: '0.75rem', background: C.muted_bg, border: `1px solid ${C.border}`, color: C.muted, fontSize: '0.8125rem', fontWeight: 600, marginBottom: '1.25rem' }}>
          Checkout cancelado — nenhuma cobrança foi feita.
        </div>
      )}

      <SectionCard title="Status">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <span style={{ fontSize: '1.125rem', fontWeight: 800, color: C.fg }}>
                {subscription ? formatMoney(subscription.price_cents ?? priceCents, subscription.currency ?? currency) : formatMoney(priceCents, currency)}
                <span style={{ fontSize: '0.8125rem', fontWeight: 500, color: C.muted }}> /mês</span>
              </span>
              {statusCfg && (
                <span style={{ fontSize: '0.6875rem', fontWeight: 700, padding: '2px 9px', borderRadius: 999, background: statusCfg.bg, color: statusCfg.text }}>
                  {statusCfg.label}
                </span>
              )}
              {!subscription && (
                <span style={{ fontSize: '0.6875rem', fontWeight: 700, padding: '2px 9px', borderRadius: 999, background: C.muted_bg, color: C.muted }}>
                  Sem assinatura
                </span>
              )}
            </div>
            {subscription?.current_period_end && (
              <p style={{ fontSize: '0.8125rem', color: C.muted }}>
                {subscription.cancel_at_period_end ? 'Acesso até ' : 'Próxima cobrança em '}
                {new Date(subscription.current_period_end).toLocaleDateString('pt-BR')}
              </p>
            )}
            {!subscription && trialDays > 0 && (
              <p style={{ fontSize: '0.8125rem', color: C.muted }}>Inclui {trialDays} dias de teste grátis.</p>
            )}
            {!subscription && (
              <p style={{ fontSize: '0.8125rem', color: C.muted, marginTop: 2 }}>
                Sem assinatura, sua conta continua no plano gratuito (limite de equinos reduzido).
              </p>
            )}
          </div>

          {isActive ? (
            <form method="POST" action="/api/stripe/portal">
              <button type="submit" style={{ padding: '0.625rem 1.375rem', borderRadius: '0.625rem', border: `1px solid ${C.border}`, background: C.muted_bg, color: C.fg, fontSize: '0.875rem', fontWeight: 700, cursor: 'pointer' }}>
                Gerenciar assinatura
              </button>
            </form>
          ) : (
            <form method="POST" action="/api/stripe/checkout">
              <button type="submit" style={{ padding: '0.625rem 1.375rem', borderRadius: '0.625rem', border: 'none', background: C.green, color: '#fff', fontSize: '0.875rem', fontWeight: 700, cursor: 'pointer' }}>
                Assinar agora
              </button>
            </form>
          )}
        </div>
      </SectionCard>

      {isActive && (
        <p style={{ fontSize: '0.75rem', color: C.muted }}>
          Faturas, forma de pagamento e cancelamento ficam disponíveis em "Gerenciar assinatura", via portal seguro da Stripe.
        </p>
      )}
    </div>
  );
}
