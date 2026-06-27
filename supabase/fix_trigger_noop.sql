-- ============================================================
-- RODAR AGORA NO SUPABASE SQL EDITOR — corrige o signup
-- Acesse: supabase.com → seu projeto → SQL Editor → New query
-- Cole este conteúdo e clique em Run
-- ============================================================

-- Torna o trigger seguro: não faz nada no banco.
-- O perfil é criado pelo próprio app após o cadastro.
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
