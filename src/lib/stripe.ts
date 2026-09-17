import Stripe from 'stripe';

let client: Stripe | null = null;

// Singleton server-side. NUNCA importar este módulo em código de cliente.
export function getStripe(): Stripe {
  if (client) return client;

  const secretKey = import.meta.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error('STRIPE_SECRET_KEY não configurada.');
  }

  client = new Stripe(secretKey);
  return client;
}
