import type { APIRoute } from 'astro';
import { createServerSupabaseClient, isValidUUID } from '../../../lib/supabase';
import { getSupabaseAdmin } from '../../../lib/supabaseAdmin';
import { isSgqConfigured } from '../../../lib/sgq/crypto';
import { sgqGetLaudo, SgqAuthError, SgqBlockedError } from '../../../lib/sgq/client';
import { parseLaudoUrl } from '../../../lib/sgq/parse';
import { fetchPage } from '../../../lib/sgq/sync';

export const prerender = false;

const SIGNED_URL_TTL = 600; // 10 min

function message(text: string, status: number, headers: Headers): Response {
  const res = new Response(text, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  headers.forEach((value, key) => res.headers.append(key, value));
  return res;
}

// Abre o laudo (PDF) de um exame. Na primeira vez busca no portal SGQ com a
// integração do veterinário e guarda no bucket docs; depois serve direto do
// EquiCore. Assim nenhum laudo é baixado em massa: só os que alguém abre.
//
// Quem pode abrir é decidido pelo RLS de vet_equine_exams: o veterinário dono
// do exame, ou o proprietário de um animal que o veterinário compartilhou.
// Passada essa checagem, o download e a gravação usam service_role (o dono não
// tem, nem deve ter, acesso às credenciais nem à pasta do veterinário).
export const GET: APIRoute = async ({ request, url }) => {
  const headers = new Headers();
  const db = createServerSupabaseClient(request, headers);
  const { data: { user } } = await db.auth.getUser();
  if (!user) return message('Faça login para abrir o laudo.', 401, headers);

  const id = url.searchParams.get('id') ?? '';
  if (!isValidUUID(id)) return message('Exame inválido.', 400, headers);

  const { data: exam, error } = await db.from('vet_equine_exams')
    .select('id, vet_id, equine_id, exam_type, number, sgq_code, laudo_path')
    .eq('id', id).maybeSingle();
  if (error || !exam) return message('Exame não encontrado.', 404, headers);

  let admin;
  try {
    admin = getSupabaseAdmin();
  } catch {
    return message('Laudos indisponíveis no servidor.', 503, headers);
  }
  const vetId: string = exam.vet_id;

  const redirectTo = async (path: string) => {
    const { data, error: signError } = await admin.storage.from('docs').createSignedUrl(path, SIGNED_URL_TTL);
    if (signError || !data?.signedUrl) return message('Não foi possível abrir o laudo.', 500, headers);
    const res = new Response(null, { status: 302, headers: { Location: data.signedUrl, 'Cache-Control': 'no-store' } });
    headers.forEach((value, key) => res.headers.append(key, value));
    return res;
  };

  if (exam.laudo_path) return redirectTo(exam.laudo_path);

  if (!isSgqConfigured()) return message('Integração com o portal SGQ indisponível no servidor.', 503, headers);
  if (!exam.sgq_code) {
    return message('Este exame ainda não foi localizado nas listas do portal. Sincronize de novo e tente outra vez.', 404, headers);
  }

  try {
    const ctx = { admin, db: admin, vetId };
    const page = await fetchPage(ctx, `requisicao_${exam.exam_type}_resenha_laudo.php?cod_requisicoes=${exam.sgq_code}`);
    const laudoUrl = parseLaudoUrl(page);
    if (!laudoUrl) return message('O portal SGQ ainda não disponibilizou o laudo deste exame.', 404, headers);

    const file = await sgqGetLaudo(laudoUrl);
    if (!file) return message('Não foi possível baixar o laudo no portal SGQ. Tente novamente mais tarde.', 502, headers);

    const folder = exam.equine_id ? `equinos/${exam.equine_id}` : 'exames';
    const name = String(exam.number).replace(/[^A-Za-z0-9_-]/g, '');
    const path = `${vetId}/${folder}/laudo-${name}.pdf`;

    const { error: uploadError } = await admin.storage.from('docs')
      .upload(path, file.bytes, { contentType: 'application/pdf', upsert: true });
    if (uploadError) throw uploadError;

    await admin.from('vet_equine_exams').update({ laudo_path: path, laudo_available: true }).eq('id', exam.id);
    return redirectTo(path);
  } catch (err) {
    if (err instanceof SgqAuthError) {
      return message('Não foi possível acessar o portal SGQ com a conta do veterinário. Ele precisa reconectar a integração.', 502, headers);
    }
    if (err instanceof SgqBlockedError) {
      return message('O portal SGQ recusou o acesso. Tente novamente mais tarde.', 502, headers);
    }
    console.error('[sgq/laudo]', err);
    return message('Não foi possível abrir o laudo.', 500, headers);
  }
};
