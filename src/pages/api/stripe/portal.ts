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

  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('stripe_customer_id')
    .eq('owner_id', user.id)
    .maybeSingle();

  if (!subscription?.stripe_customer_id) {
    return new Response('Nenhuma assinatura encontrada.', { status: 404 });
  }

  const origin = new URL(request.url).origin;

  try {
    const stripe = getStripe();
    const session = await stripe.billingPortal.sessions.create({
      customer: subscription.stripe_customer_id,
      return_url: `${origin}/dashboard/assinatura`,
    });

    const response = redirect(session.url, 303);
    responseHeaders.forEach((value, key) => response.headers.append(key, value));
    return response;
  } catch (err) {
    console.error('[stripe/portal]', err);
    return new Response('Falha ao abrir portal de cobrança.', { status: 502 });
  }
};
