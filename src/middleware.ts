import { defineMiddleware } from 'astro:middleware';
import { createServerSupabaseClient } from './lib/supabase';

const PROTECTED = ['/dashboard', '/admin'];
const AUTH_PAGES = ['/login', '/cadastro'];

export const onRequest = defineMiddleware(async (context, next) => {
  const { request, redirect } = context;
  const url = new URL(request.url);
  const pathname = url.pathname;

  const isProtected = PROTECTED.some((p) => pathname.startsWith(p));
  const isAuthPage = AUTH_PAGES.some((p) => pathname.startsWith(p));

  if (!isProtected && !isAuthPage) return next();

  const responseHeaders = new Headers();
  const supabase = createServerSupabaseClient(request, responseHeaders);
  const { data: { session } } = await supabase.auth.getSession();

  if (isProtected && !session) {
    return redirect('/login');
  }

  if (isAuthPage && session) {
    return redirect('/dashboard');
  }

  const response = await next();

  // Propaga cookies de sessão definidos pelo Supabase SSR
  responseHeaders.forEach((value, key) => {
    response.headers.append(key, value);
  });

  return response;
});
