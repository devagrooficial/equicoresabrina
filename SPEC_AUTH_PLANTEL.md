# EquiCore — Spec Técnica: Auth + CRUD Plantel
**Versão:** 1.0 · **Data:** 2026-05-31 · **Escopo do dia**

---

## 1. Visão Geral

Implementar autenticação real via Supabase e persistência do cadastro de equinos.  
Ao fim do dia, o usuário deve conseguir:
1. Criar conta → confirmar e-mail → fazer login
2. Acessar o dashboard (protegido)
3. Cadastrar um equino via stepper → ver na listagem → abrir o perfil

---

## 2. Stack de Implementação

| Camada | Tecnologia |
|--------|-----------|
| Auth + DB | Supabase (Auth + PostgreSQL via RLS) |
| Frontend | Astro 6 + React 19 (já instalado) |
| SSR | `@astrojs/node` adapter (modo `hybrid`) |
| Validação | Zod |
| Novo pacote | `@supabase/supabase-js` |
| Env | `.env` com `PUBLIC_SUPABASE_URL` e `PUBLIC_SUPABASE_ANON_KEY` |

---

## 3. Configuração de Infraestrutura

### 3.1 Astro — SSR Hybrid

`astro.config.mjs` precisa de:
- `output: 'hybrid'` — páginas são estáticas por padrão; rotas protegidas marcam `export const prerender = false`
- adapter: `@astrojs/node` com `mode: 'standalone'`

### 3.2 Variáveis de Ambiente

```
PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

Prefixo `PUBLIC_` expõe para o cliente React (Astro convention).

### 3.3 Cliente Supabase

Criar `src/lib/supabase.ts` — exporta `createBrowserClient()` para uso nos componentes React e `createServerClient()` para uso nos `.astro` server-side.

---

## 4. Banco de Dados (Supabase)

### 4.1 Tabela `equinos`

```sql
create table equinos (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now(),

  -- Etapa 1 — Identificação
  name          text not null,
  nickname      text,
  breed         text not null,
  breed_other   text,
  sex           text not null,
  coat          text not null,
  coat_other    text,
  birth_date    date,
  estimated_age int,         -- em meses, usado quando birth_date é null
  microchip     text,
  brand_desc    text,
  purpose       text[],      -- array de valores enum
  stable        text,

  -- Etapa 2 — Registros
  reg_abqm      text,
  reg_abccm     text,
  reg_abpsi     text,
  reg_abccc     text,
  reg_other     text,
  reg_entity    text,
  passport      text,

  -- Etapa 3 — Atividade
  competition_level  text,
  training_status    text,

  -- Etapa 4 — Nutrição
  feed_kg_day   numeric(5,2),
  feed_brand    text,
  hay_kg_day    numeric(5,2),
  hay_type      text,
  water_access  text,
  supplements   text,

  -- Etapa 5 — Físico
  weight_kg     numeric(6,1),
  height_cm     numeric(5,1),
  last_weight   date,
  bcs           int check (bcs between 1 and 9),
  is_pregnant   boolean default false,
  foaling_date  date,
  breeding_method text,

  -- Etapa 6 — Genealogia
  father_name   text,
  father_reg    text,
  mother_name   text,
  mother_reg    text,
  pat_grandfather text,
  pat_grandmother text,
  mat_grandfather text,
  mat_grandmother text,

  -- Status calculado (health alert level)
  health_status text default 'healthy' check (health_status in ('healthy','attention','urgent','critical'))
);
```

### 4.2 Row Level Security (RLS)

```sql
alter table equinos enable row level security;

-- Usuário vê apenas seus próprios equinos
create policy "own equinos" on equinos
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```

**Regra de negócio crítica:** toda query de equinos no frontend DEVE deixar o RLS filtrar — não passar `userId` manualmente como filtro de aplicação. O Supabase aplica automaticamente.

### 4.3 Tabela `profiles` (extensão de `auth.users`)

```sql
create table profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text,
  phone       text,
  farm_name   text,
  plan        text default 'free' check (plan in ('free','starter','pro','haras')),
  created_at  timestamptz default now()
);

alter table profiles enable row level security;
create policy "own profile" on profiles
  for all using (auth.uid() = id)
  with check (auth.uid() = id);
```

**Trigger para criação automática do perfil no signup:**
```sql
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into profiles (id, full_name, phone, farm_name, plan)
  values (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'phone',
    new.raw_user_meta_data->>'farm_name',
    coalesce(new.raw_user_meta_data->>'plan', 'free')
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();
```

---

## 5. Autenticação

### 5.1 Fluxo de Registro

1. Usuário preenche step 1: `full_name`, `email`, `phone`, `farm_name`, `password`, `confirm_password`
2. Frontend valida com Zod:
   - `email`: formato válido
   - `password`: mínimo 8 chars, deve conter letra e número
   - `confirm_password`: igual a `password`
3. Usuário escolhe plano (step 2) e aceita termos
4. Chamada: `supabase.auth.signUp({ email, password, options: { data: { full_name, phone, farm_name, plan } } })`
5. Supabase envia e-mail de confirmação
6. Frontend exibe tela de "Verifique seu e-mail"
7. Após confirmação, trigger cria o `profiles` automaticamente

### 5.2 Fluxo de Login

1. Usuário envia `email` + `password`
2. Chamada: `supabase.auth.signInWithPassword({ email, password })`
3. Supabase retorna session com `access_token` + `refresh_token`
4. Tokens são armazenados em cookies `HttpOnly` via Supabase SSR helper
5. Redirect para `/dashboard`

**Erros mapeados para PT-BR:**
| Código Supabase | Mensagem exibida |
|-----------------|-----------------|
| `invalid_credentials` | E-mail ou senha incorretos |
| `email_not_confirmed` | Confirme seu e-mail antes de entrar |
| `user_already_exists` | Este e-mail já está cadastrado |
| `weak_password` | A senha não atende aos requisitos mínimos |

### 5.3 Proteção de Rotas (Middleware Astro)

Criar `src/middleware.ts`:
- Rotas `/dashboard/*` e `/admin/*` verificam sessão server-side
- Se não autenticado → redirect para `/login`
- Se autenticado tentando acessar `/login` ou `/cadastro` → redirect para `/dashboard`

### 5.4 Logout

- Botão no `Header.tsx` chama `supabase.auth.signOut()`
- Limpa cookies de sessão
- Redirect para `/login`

---

## 6. CRUD de Equinos

### 6.1 Regras de Negócio

**Limite por plano (aplicar no frontend E via RLS/function no banco):**

| Plano | Máx. equinos |
|-------|-------------|
| free | 2 |
| starter | 5 |
| pro | 15 |
| haras | ilimitado (9999) |

Antes de salvar um novo equino, consultar `profiles.plan` do usuário e contar os equinos existentes. Se no limite, exibir modal de upgrade.

**Campos obrigatórios no save:**
- `name` (não pode ser vazio ou só espaços)
- `breed`
- `sex`
- `coat`
- `purpose` (pelo menos 1 item no array)

Campos das demais etapas são todos opcionais — o usuário pode salvar "parcialmente" e completar depois no perfil do equino.

### 6.2 Criar Equino (POST)

Fluxo no `EquineFormStepper.tsx` ao clicar em "Salvar Equino" (step 7):

1. Validar campos obrigatórios (Zod)
2. Verificar limite do plano
3. Chamada: `supabase.from('equinos').insert({ ...formData, user_id: session.user.id })`
4. Em caso de sucesso → redirect para `/dashboard/plantel`
5. Exibir toast de sucesso: "Equino [nome] cadastrado com sucesso!"

**Não enviar campos vazios como string vazia** — converter `'' → null` antes do insert.

### 6.3 Listar Equinos (GET)

No `PlantelList.tsx`:
- Substituir `MOCK_EQUINES` por query real: `supabase.from('equinos').select('*').order('created_at', { ascending: false })`
- RLS garante que só retorna os equinos do usuário logado
- Calcular `health_status` dinamicamente a partir das datas (implementação futura dos alertas)
- Por ora usar o campo `health_status` do banco (default `'healthy'`)

**Card do equino** — link deve apontar para `/dashboard/equino/[id]` (rota dinâmica com o UUID do equino)

### 6.4 Buscar Equino (GET by ID)

Criar rota dinâmica `src/pages/dashboard/equino/[id].astro`:
- Server-side: `supabase.from('equinos').select('*').eq('id', id).single()`
- RLS protege automaticamente (404 se não for do usuário)
- Passar dados para o componente `EquineProfile`

### 6.5 Editar Equino (PUT)

- No perfil do equino, botão "Editar" abre o stepper pré-populado com os dados existentes
- Submit chama: `supabase.from('equinos').update({ ...formData }).eq('id', id)`
- `updated_at` atualizado via trigger ou no update explícito

### 6.6 Excluir Equino (DELETE)

- Botão "Excluir" no perfil do equino exibe modal de confirmação com nome do equino
- Usuário digita o nome para confirmar (prevenção de exclusão acidental)
- Chamada: `supabase.from('equinos').delete().eq('id', id)`
- Redirect para `/dashboard/plantel` após exclusão

---

## 7. Estrutura de Arquivos a Criar/Modificar

```
equicore_app/
├── .env                                  ← CRIAR (não commitar)
├── .env.example                          ← CRIAR (para documentar vars)
├── astro.config.mjs                      ← MODIFICAR (add SSR + adapter)
├── package.json                          ← MODIFICAR (add deps)
│
├── src/
│   ├── lib/
│   │   └── supabase.ts                   ← CRIAR (browser + server clients)
│   │
│   ├── middleware.ts                     ← CRIAR (proteção de rotas)
│   │
│   ├── components/
│   │   ├── auth/
│   │   │   ├── LoginForm.tsx             ← MODIFICAR (integrar Supabase)
│   │   │   └── RegisterForm.tsx          ← MODIFICAR (integrar Supabase)
│   │   │
│   │   ├── plantel/
│   │   │   ├── EquineFormStepper.tsx     ← MODIFICAR (save real + validação Zod)
│   │   │   └── PlantelList.tsx           ← MODIFICAR (query real Supabase)
│   │   │
│   │   └── dashboard/
│   │       └── Header.tsx               ← MODIFICAR (add logout)
│   │
│   └── pages/
│       ├── login.astro                   ← MODIFICAR (export prerender = false)
│       ├── cadastro.astro                ← MODIFICAR (export prerender = false)
│       └── dashboard/
│           ├── index.astro               ← MODIFICAR (export prerender = false)
│           ├── plantel/
│           │   ├── index.astro           ← MODIFICAR (export prerender = false)
│           │   └── novo/index.astro      ← MODIFICAR (export prerender = false)
│           └── equino/
│               ├── index.astro           ← MANTER (redirect ou remover)
│               └── [id].astro            ← CRIAR (rota dinâmica)
```

---

## 8. Validações Zod

### Schema de Login
```ts
z.object({
  email: z.string().email('E-mail inválido'),
  password: z.string().min(1, 'Senha obrigatória'),
})
```

### Schema de Registro (Step 1)
```ts
z.object({
  full_name: z.string().min(3, 'Nome deve ter pelo menos 3 caracteres'),
  email: z.string().email('E-mail inválido'),
  phone: z.string().optional(),
  farm_name: z.string().optional(),
  password: z.string()
    .min(8, 'Mínimo 8 caracteres')
    .regex(/[a-zA-Z]/, 'Deve conter pelo menos uma letra')
    .regex(/[0-9]/, 'Deve conter pelo menos um número'),
  confirm_password: z.string(),
}).refine(d => d.password === d.confirm_password, {
  message: 'As senhas não coincidem',
  path: ['confirm_password'],
})
```

### Schema de Equino (campos obrigatórios)
```ts
z.object({
  name: z.string().min(1, 'Nome é obrigatório').trim(),
  breed: z.string().min(1, 'Raça é obrigatória'),
  sex: z.string().min(1, 'Sexo é obrigatório'),
  coat: z.string().min(1, 'Pelagem é obrigatória'),
  purpose: z.array(z.string()).min(1, 'Selecione pelo menos uma finalidade'),
  // Restante dos campos: opcional
})
```

---

## 9. Tratamento de Estado de Loading / Erros

### Padrão nos formulários React:
```ts
const [state, setState] = useState<{
  loading: boolean;
  error: string | null;
  success: boolean;
}>({ loading: false, error: null, success: false });
```

- **Loading:** desabilitar botão + mostrar spinner/texto "Salvando…"
- **Erro:** exibir inline abaixo do formulário (campo específico) ou banner (erro geral)
- **Sucesso auth:** redirect automático
- **Sucesso CRUD:** toast + redirect

---

## 10. Ordem de Implementação (prioridade do dia)

```
[1] Instalar dependências + configurar Supabase no Astro (SSR)
[2] Criar tabelas no Supabase (equinos + profiles + trigger)
[3] src/lib/supabase.ts (clientes browser + server)
[4] src/middleware.ts (proteção de rotas)
[5] LoginForm.tsx (auth real)
[6] RegisterForm.tsx (auth real + validação senha)
[7] Header.tsx (logout)
[8] EquineFormStepper.tsx (save real + validação Zod)
[9] PlantelList.tsx (listagem real)
[10] src/pages/dashboard/equino/[id].astro (rota dinâmica)
```

---

## 11. Fora do Escopo de Hoje

- Upload de foto do equino (S3/Storage)
- Sistema de alertas e vacinas
- Módulo de saúde (vermifugação, histórico vet)
- Genealogia visual (árvore)
- Integração Stripe (planos pagos)
- Painel admin
- E-mail de boas-vindas customizado
- Forgot password (fluxo existe na UI mas não será conectado hoje)
