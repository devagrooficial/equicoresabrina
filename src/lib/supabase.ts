import { createBrowserClient, createServerClient, parseCookieHeader, serializeCookieHeader } from '@supabase/ssr';

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

// Usado em componentes React (browser)
export function createClient() {
  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}

// Usado em páginas .astro e middleware (server-side)
export function createServerSupabaseClient(request: Request, responseHeaders: Headers) {
  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return parseCookieHeader(request.headers.get('Cookie') ?? '');
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          responseHeaders.append('Set-Cookie', serializeCookieHeader(name, value, options));
        });
      },
    },
  });
}

// Limites de equinos por plano
export const PLAN_LIMITS: Record<string, number> = {
  free: 2,
  starter: 5,
  pro: 15,
  haras: 9999,
};

// ─── Helpers de segurança ────────────────────────────────────────────────────

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Valida se a string é um UUID v4 bem formado. */
export const isValidUUID = (v: string): boolean => UUID_RE.test(v);

/**
 * Resolve um path de storage ou URL legada (pública) para uma URL assinada
 * com TTL de 12 horas. Trata o formato antigo (URL completa) e o novo (path
 * relativo ao bucket "docs").
 *
 * Formato legado: https://*.supabase.co/storage/v1/object/public/docs/{path}
 * Formato novo:   {vetId}/equinos/{equineId}/{arquivo}
 */
export async function resolveDocUrl(pathOrUrl: string, expiresIn = 43_200): Promise<string> {
  if (!pathOrUrl) return pathOrUrl;

  const sb = createClient();

  let storagePath: string;
  if (pathOrUrl.startsWith('http')) {
    // Extrai o path relativo de uma URL pública legada
    const marker = '/object/public/docs/';
    const idx = pathOrUrl.indexOf(marker);
    if (idx === -1) return pathOrUrl;
    storagePath = decodeURIComponent(pathOrUrl.slice(idx + marker.length));
  } else {
    storagePath = pathOrUrl;
  }

  const { data, error } = await sb.storage.from('docs').createSignedUrl(storagePath, expiresIn);
  if (error || !data?.signedUrl) return pathOrUrl;
  return data.signedUrl;
}
