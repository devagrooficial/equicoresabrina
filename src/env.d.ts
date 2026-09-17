/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly PUBLIC_SUPABASE_URL: string;
  readonly PUBLIC_SUPABASE_ANON_KEY: string;
  // Server-only — nunca prefixar com PUBLIC_ (não deve ir para o bundle do cliente)
  readonly STRIPE_SECRET_KEY: string;
  readonly STRIPE_WEBHOOK_SECRET: string;
  readonly SUPABASE_SERVICE_ROLE_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
