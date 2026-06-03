-- Adiciona localização do haras ao perfil
alter table profiles
  add column if not exists farm_city  text,
  add column if not exists farm_state text,
  add column if not exists avatar_url text;
