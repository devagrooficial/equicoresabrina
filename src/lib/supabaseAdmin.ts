import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;

// Tipado como `any` — mesmo padrão do restante do projeto, que não usa
// tipos gerados do schema do Supabase (ver uso de `as any` em VinculosAdmin.tsx).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let client: any = null;

// Client com service_role — ignora RLS. Uso exclusivo em rotas server-side
// sem sessão de usuário (ex.: webhook da Stripe). NUNCA importar em
// código de cliente nem expor a service role key com prefixo PUBLIC_.
export function getSupabaseAdmin(): any {
  if (client) return client;

  const serviceRoleKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY não configurada.');
  }

  client = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}
