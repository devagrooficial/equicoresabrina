import type { APIRoute } from 'astro';
import { z } from 'zod';
import { getSupabaseAdmin } from '../../../lib/supabaseAdmin';
import { json, requireVet } from '../../../lib/sgq/api';
import { isSgqConfigured } from '../../../lib/sgq/crypto';
import { claimTick, emptyStats, jobView, runTick } from '../../../lib/sgq/sync';

export const prerender = false;

const schema = z.object({
  action: z.enum(['start', 'tick', 'cancel']),
  // start: reler também as fichas dos animais já importados
  full: z.boolean().optional(),
});

// Controle da sincronização com o portal SGQ.
//   start  — cria o job (ou devolve o que já está em andamento); não acessa o portal
//   tick   — executa um passo: no máximo uma página do portal por chamada
//   cancel — interrompe o job em andamento
export const POST: APIRoute = async ({ request }) => {
  const session = await requireVet(request);
  if (session instanceof Response) return session;
  const { vetId, headers } = session;

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: 'Ação inválida.' }, 400, headers);
  const { action, full } = parsed.data;

  if (!isSgqConfigured()) {
    return json({ error: 'Integração indisponível: servidor sem chave de criptografia.' }, 503, headers);
  }

  try {
    const admin = getSupabaseAdmin();
    const running = async () => {
      const { data, error } = await admin.from('sgq_sync_jobs')
        .select().eq('vet_id', vetId).eq('status', 'running').maybeSingle();
      if (error) throw error;
      return data;
    };

    if (action === 'cancel') {
      const { error } = await admin.from('sgq_sync_jobs')
        .update({ status: 'cancelled', finished_at: new Date().toISOString() })
        .eq('vet_id', vetId).eq('status', 'running');
      if (error) throw error;
      return json({ job: null }, 200, headers);
    }

    if (action === 'start') {
      const existing = await running();
      if (existing) return json({ job: jobView(existing) }, 200, headers);

      const { data: integration } = await admin.from('vet_integrations')
        .select('vet_id').eq('vet_id', vetId).eq('provider', 'sgq').maybeSingle();
      if (!integration) return json({ error: 'Conecte sua conta do portal SGQ primeiro.' }, 400, headers);

      // Confere o banco antes de tocar no portal: sem a migration de exames a
      // sincronização falharia no meio, depois de já ter lido as listas.
      const schemaCheck = await admin.from('vet_equine_exams').select('id', { count: 'exact', head: true });
      if (schemaCheck.error) {
        return json({
          error: 'Atualização pendente no banco: rode supabase/sgq_exams_health.sql no SQL Editor do Supabase.',
          detail: [schemaCheck.error.code, schemaCheck.error.message].filter(Boolean).join(': ').slice(0, 160),
        }, 409, headers);
      }

      const { data, error } = await admin.from('sgq_sync_jobs')
        .insert({ vet_id: vetId, stats: emptyStats(full === true) }).select().single();
      if (error) {
        // Corrida entre duas abas: o índice único garante um job por veterinário
        const raced = await running();
        if (raced) return json({ job: jobView(raced) }, 200, headers);
        throw error;
      }
      return json({ job: jobView(data) }, 200, headers);
    }

    // tick
    const job = await running();
    if (!job) return json({ job: null }, 200, headers);

    const claimed = await claimTick(admin, job.id);
    if (!claimed) return json({ job: jobView(job), wait: true }, 200, headers);

    const result = await runTick({ admin, db: session.db, vetId }, claimed);
    return json(result, 200, headers);
  } catch (err) {
    console.error('[sgq/sync]', action, err);
    const e = err as { code?: unknown; message?: unknown } | null;
    const detail = [e?.code, e?.message].filter(v => typeof v === 'string' && v).join(': ').slice(0, 160);
    return json({ error: 'Falha na sincronização.', detail: detail || undefined }, 500, headers);
  }
};
