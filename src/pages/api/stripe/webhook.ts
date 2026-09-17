import type { APIRoute } from 'astro';
import type Stripe from 'stripe';
import { getStripe } from '../../../lib/stripe';
import { getSupabaseAdmin } from '../../../lib/supabaseAdmin';

export const prerender = false;

// Status da assinatura Stripe que destravam o tier "haras" (ilimitado).
// Qualquer outro status (past_due, canceled, unpaid, incomplete...) deixa
// o dono no tier gratuito — sem bloqueio, ele só perde o limite ampliado.
const ACTIVE_STATUSES = new Set(['active', 'trialing']);

async function syncOwnerPlan(
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>,
  ownerId: string,
  status: string,
) {
  const plan = ACTIVE_STATUSES.has(status) ? 'haras' : 'free';
  await supabaseAdmin.from('profiles').update({ plan }).eq('id', ownerId);
}

export const POST: APIRoute = async ({ request }) => {
  const signature = request.headers.get('stripe-signature');
  const webhookSecret = import.meta.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !webhookSecret) {
    return new Response('Webhook não configurado.', { status: 400 });
  }

  const body = await request.text();
  const stripe = getStripe();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error('[stripe/webhook] assinatura inválida', err);
    return new Response('Assinatura inválida.', { status: 400 });
  }

  const supabaseAdmin = getSupabaseAdmin();

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const ownerId = session.client_reference_id;
        const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id;
        const subscriptionId =
          typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;

        if (!ownerId || !customerId || !subscriptionId) break;

        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        const item = subscription.items.data[0];

        const { data: profile } = await supabaseAdmin
          .from('profiles')
          .select('full_name, email, farm_name')
          .eq('id', ownerId)
          .maybeSingle();

        await supabaseAdmin.from('subscriptions').upsert(
          {
            owner_id: ownerId,
            stripe_customer_id: customerId,
            stripe_subscription_id: subscription.id,
            status: subscription.status,
            price_cents: item?.price.unit_amount ?? null,
            currency: item?.price.currency ?? null,
            current_period_end: item ? new Date(item.current_period_end * 1000).toISOString() : null,
            cancel_at_period_end: subscription.cancel_at_period_end,
            owner_name: profile?.full_name ?? null,
            owner_email: profile?.email ?? null,
            farm_name: profile?.farm_name ?? null,
          },
          { onConflict: 'owner_id' },
        );

        await syncOwnerPlan(supabaseAdmin, ownerId, subscription.status);
        break;
      }

      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const item = subscription.items.data[0];

        const { data: existing } = await supabaseAdmin
          .from('subscriptions')
          .select('owner_id')
          .eq('stripe_subscription_id', subscription.id)
          .maybeSingle();

        // Sem vínculo local ainda (evento chegou antes de checkout.session.completed
        // ser processado, ou assinatura de outra origem) — nada a fazer aqui.
        if (!existing) {
          console.warn('[stripe/webhook] assinatura sem vínculo local:', subscription.id);
          break;
        }

        await supabaseAdmin
          .from('subscriptions')
          .update({
            status: subscription.status,
            price_cents: item?.price.unit_amount ?? null,
            currency: item?.price.currency ?? null,
            current_period_end: item ? new Date(item.current_period_end * 1000).toISOString() : null,
            cancel_at_period_end: subscription.cancel_at_period_end,
          })
          .eq('stripe_subscription_id', subscription.id);

        await syncOwnerPlan(supabaseAdmin, existing.owner_id as string, subscription.status);
        break;
      }

      default:
        break;
    }
  } catch (err) {
    console.error(`[stripe/webhook] falha ao processar ${event.type}`, err);
    return new Response('Erro interno.', { status: 500 });
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
