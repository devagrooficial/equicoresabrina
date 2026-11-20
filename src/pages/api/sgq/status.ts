import type { APIRoute } from 'astro';
import { getSupabaseAdmin } from '../../../lib/supabaseAdmin';
import { json, maskUsername, requireVet } from '../../../lib/sgq/api';
import { isSgqConfigured } from '../../../lib/sgq/crypto';
import { jobView } from '../../../lib/sgq/sync';

export const prerender = false;

// Estado da integração do veterinário logado e do último job de sincronização.
export const GET: APIRoute = async ({ request }) => {
  const session = await requireVet(request);
  if (session instanceof Response) return session;

  let admin;
  try {
    admin = getSupabaseAdmin();
  } catch {
    return json({ error: 'Integração indisponível: servidor sem SUPABASE_SERVICE_ROLE_KEY.' }, 503, session.headers);
  }
  const [integration, job] = await Promise.all([
    admin.from('vet_integrations')
      .select('username, last_sync_at')
      .eq('vet_id', session.vetId).eq('provider', 'sgq').maybeSingle(),
    admin.from('sgq_sync_jobs')
      .select()
      .eq('vet_id', session.vetId)
      .order('started_at', { ascending: false }).limit(1).maybeSingle(),
  ]);

  const failure = integration.error ?? job.error;
  if (failure) {
    console.error('[sgq/status]', failure.code, failure.message);
    // O detalhe é o erro do banco/API (ex.: chave de serviço inválida, tabela ausente);
    // não contém segredo e poupa uma ida aos logs para descobrir a causa.
    const detail = [failure.code, failure.message].filter(Boolean).join(': ').slice(0, 160);
    return json({ error: 'Integração indisponível no servidor.', detail }, 500, session.headers);
  }

  return json({
    configured: isSgqConfigured(),
    connected: Boolean(integration.data),
    username: integration.data ? maskUsername(integration.data.username) : null,
    lastSyncAt: integration.data?.last_sync_at ?? null,
    job: job.data ? jobView(job.data) : null,
  }, 200, session.headers);
};
