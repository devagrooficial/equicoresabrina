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
