import { defineMiddleware } from 'astro:middleware';
import { createServerSupabaseClient } from './lib/supabase';

const PROTECTED  = ['/dashboard', '/admin', '/vet'];
const AUTH_PAGES = ['/login', '/cadastro'];

// Área correta de cada usuário com base no perfil
function homeFor(profile: { role?: string | null; admin?: boolean | null } | null): string {
  if (profile?.admin)                  return '/admin';
  if (profile?.role === 'veterinario') return '/vet';
  return '/dashboard';
}

export const onRequest = defineMiddleware(async (context, next) => {
  const { request, redirect } = context;
  const url      = new URL(request.url);
  const pathname = url.pathname;

  const isProtected = PROTECTED.some((p) => pathname.startsWith(p));
  const isAuthPage  = AUTH_PAGES.some((p) => pathname.startsWith(p));

  if (!isProtected && !isAuthPage) return next();

  const responseHeaders = new Headers();
  const supabase = createServerSupabaseClient(request, responseHeaders);
  const { data: { session } } = await supabase.auth.getSession();

  if (isProtected && !session) {
    return redirect('/login');
  }

  if (session && (isProtected || isAuthPage)) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, admin')
      .eq('id', session.user.id)
      .maybeSingle();

    // Perfil nulo: trigger de criação falhou ou usuário incompleto.
    // Permite apenas /dashboard (área padrão pós-cadastro); bloqueia /vet e /admin.
    if (!profile) {
      if (isAuthPage) return redirect('/dashboard');
      if (!pathname.startsWith('/dashboard')) return redirect('/dashboard');
      return next();
    }

    const home = homeFor(profile);

    // Usuário autenticado em página de auth → área correta
    if (isAuthPage) return redirect(home);

    // Isolamento por persona: cada role acessa apenas a própria área
    // (admin pode navegar em qualquer área)
    const allowed =
      profile.admin === true ||
      (pathname.startsWith('/vet')       && profile.role === 'veterinario') ||
      (pathname.startsWith('/dashboard') && profile.role !== 'veterinario');

    if (!allowed) return redirect(home);
  }

  const response = await next();

  responseHeaders.forEach((value, key) => {
    response.headers.append(key, value);
  });

  return response;
});
