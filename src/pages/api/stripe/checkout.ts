import type { APIRoute } from 'astro';
import { createServerSupabaseClient } from '../../../lib/supabase';
import { getStripe } from '../../../lib/stripe';

export const prerender = false;

export const POST: APIRoute = async ({ request, redirect }) => {
  const responseHeaders = new Headers();
  const supabase = createServerSupabaseClient(request, responseHeaders);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return new Response('Não autenticado.', { status: 401 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, admin, email')
    .eq('id', user.id)
    .maybeSingle();

  // Veterinário nunca é cobrado; admin não é cliente pagante da própria plataforma.
  if (!profile || profile.role === 'veterinario' || profile.admin === true) {
    return new Response('Assinatura não se aplica a este perfil.', { status: 403 });
  }

  const { data: settings } = await supabase
    .from('billing_settings')
    .select('monthly_price_cents, currency, trial_days, product_name')
    .eq('id', 1)
    .maybeSingle();

  if (!settings || settings.monthly_price_cents <= 0) {
    return new Response('Valor de assinatura não configurado.', { status: 500 });
  }

  const { data: existing } = await supabase
    .from('subscriptions')
    .select('stripe_customer_id')
    .eq('owner_id', user.id)
    .maybeSingle();

  const origin = new URL(request.url).origin;

  try {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      client_reference_id: user.id,
      ...(existing?.stripe_customer_id
        ? { customer: existing.stripe_customer_id }
        : { customer_email: profile.email ?? user.email ?? undefined }),
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: settings.currency,
            unit_amount: settings.monthly_price_cents,
            recurring: { interval: 'month' },
            product_data: { name: settings.product_name },
          },
        },
      ],
      subscription_data: settings.trial_days > 0 ? { trial_period_days: settings.trial_days } : undefined,
      success_url: `${origin}/dashboard/assinatura?success=1`,
      cancel_url: `${origin}/dashboard/assinatura?canceled=1`,
    });

    if (!session.url) {
      return new Response('Falha ao iniciar checkout.', { status: 502 });
    }

    const response = redirect(session.url, 303);
    responseHeaders.forEach((value, key) => response.headers.append(key, value));
    return response;
  } catch (err) {
    console.error('[stripe/checkout]', err);
    return new Response('Falha ao iniciar checkout.', { status: 502 });
  }
};
