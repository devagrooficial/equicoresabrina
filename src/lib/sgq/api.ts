// Apoio às rotas /api/sgq/*: autenticação do veterinário e respostas JSON.

import { createServerSupabaseClient } from '../supabase';

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface VetSession {
  db: any;            // client com a sessão do veterinário (RLS)
  vetId: string;
  headers: Headers;   // cookies renovados da sessão
}

export function json(body: unknown, status = 200, headers?: Headers): Response {
  const res = new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
  headers?.forEach((value, key) => res.headers.append(key, value));
  return res;
}

/** Sessão válida de um usuário com perfil de veterinário, ou a resposta de erro. */
export async function requireVet(request: Request): Promise<VetSession | Response> {
  const headers = new Headers();
  const db = createServerSupabaseClient(request, headers);

  const { data: { user } } = await db.auth.getUser();
  if (!user) return json({ error: 'Não autenticado.' }, 401);

  const { data: profile } = await db
    .from('profiles')
    .select('role, suspended')
    .eq('id', user.id)
    .maybeSingle();

  if (profile?.role !== 'veterinario' || profile?.suspended === true) {
    return json({ error: 'Disponível apenas para veterinários.' }, 403);
  }
  return { db, vetId: user.id, headers };
}

/** "sabrina@exemplo.com" → "sa•••@exemplo.com" */
export function maskUsername(username: string): string {
  const at = username.indexOf('@');
  if (at <= 0) return `${username.slice(0, 2)}•••`;
  return `${username.slice(0, Math.min(2, at))}•••${username.slice(at)}`;
}
