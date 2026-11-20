import type { APIRoute } from 'astro';
import { z } from 'zod';
import { getSupabaseAdmin } from '../../../lib/supabaseAdmin';
import { json, maskUsername, requireVet } from '../../../lib/sgq/api';
import { encryptSecret, isSgqConfigured } from '../../../lib/sgq/crypto';
import { sgqLogin, SgqAuthError, SgqBlockedError } from '../../../lib/sgq/client';

export const prerender = false;

const schema = z.object({
  username: z.string().trim().min(3).max(200),
  password: z.string().min(1).max(200),
  // Aceite explícito do termo de importação (LGPD)
  consent: z.literal(true),
});

// Salva as credenciais do portal SGQ depois de confirmar que o login funciona.
export const POST: APIRoute = async ({ request }) => {
  const session = await requireVet(request);
  if (session instanceof Response) return session;

  if (!isSgqConfigured()) {
    return json({ error: 'Integração indisponível: servidor sem chave de criptografia.' }, 503, session.headers);
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return json({ error: 'Informe e-mail, senha e aceite o termo de importação.' }, 400, session.headers);
  }
  const { username, password } = parsed.data;

  let cookie: string;
  try {
    cookie = await sgqLogin(username, password);
  } catch (err) {
    if (err instanceof SgqAuthError) {
      return json({ error: 'O portal SGQ não aceitou esse e-mail e senha.' }, 400, session.headers);
    }
    if (err instanceof SgqBlockedError) {
      return json({ error: 'O portal SGQ recusou o acesso. Tente novamente mais tarde.' }, 502, session.headers);
    }
    return json({ error: 'Portal SGQ indisponível no momento.' }, 502, session.headers);
  }

  try {
    const { error } = await getSupabaseAdmin().from('vet_integrations').upsert({
      vet_id: session.vetId,
      provider: 'sgq',
      username,
      secret_enc: encryptSecret(password),
      session_enc: encryptSecret(cookie),
      consent_at: new Date().toISOString(),
    });
    if (error) throw error;
  } catch (err) {
    console.error('[sgq/credentials]', err instanceof Error ? err.message : err);
    return json({ error: 'Não foi possível salvar a integração.' }, 500, session.headers);
  }

  return json({ connected: true, username: maskUsername(username) }, 200, session.headers);
};

// Remove as credenciais e interrompe qualquer sincronização em andamento.
// Os registros já importados permanecem no EquiCore.
export const DELETE: APIRoute = async ({ request }) => {
  const session = await requireVet(request);
  if (session instanceof Response) return session;

  try {
    const admin = getSupabaseAdmin();
    await admin.from('sgq_sync_jobs')
      .update({ status: 'cancelled', finished_at: new Date().toISOString() })
      .eq('vet_id', session.vetId).eq('status', 'running');

    const { error } = await admin.from('vet_integrations')
      .delete().eq('vet_id', session.vetId).eq('provider', 'sgq');
    if (error) throw error;
  } catch (err) {
    console.error('[sgq/credentials]', err instanceof Error ? err.message : err);
    return json({ error: 'Não foi possível remover a integração.' }, 500, session.headers);
  }
  return json({ connected: false }, 200, session.headers);
};
