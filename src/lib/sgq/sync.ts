// Sincronização com o Portal Central de Requisições (SGQ), em passos curtos.
//
// Cada chamada de runTick() lê NO MÁXIMO uma página do portal (fora o login,
// quando a sessão expira). O navegador do veterinário dispara os passos com
// intervalo entre eles; o estado fica em sgq_sync_jobs / sgq_sync_items, então
// a sincronização pode ser interrompida e retomada.
//
// Fases: owners → properties → animals (as três listas) → details (fichas).
//
// Regras de gravação:
//  - dados do EquiCore nunca são sobrescritos: a importação só cria registros
//    novos ou preenche campos que estavam vazios;
//  - vet_owners / vet_properties / vet_equines são gravados com a sessão do
//    próprio veterinário (RLS + auditoria com o autor correto);
//  - credenciais e fila usam service_role e ficam invisíveis ao cliente.

import { randomUUID } from 'node:crypto';
import { decryptSecret, encryptSecret } from './crypto';
import { sgqGet, sgqLogin, sleep, SgqAuthError, SgqBlockedError } from './client';
import {
  normalizeKey, parseAnimalFicha, parseAnimalList, parseOwnerDetail,
  parseOwnerList, parsePropertyList,
  type SgqAnimalFicha,
} from './parse';

/** Intervalo mínimo entre dois acessos ao portal (aplicado no servidor). */
export const MIN_INTERVAL_MS = 2_500;
/** Trava de um passo em execução; expira sozinha se a função cair. */
const LOCK_MS = 90_000;
const MAX_ISSUES = 40;
const MAX_CONSECUTIVE_ERRORS = 5;

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface SyncContext {
  admin: any;     // service_role — credenciais, jobs e fila
  db: any;        // sessão do veterinário — tabelas vet_* (RLS)
  vetId: string;
}

export interface SyncStats {
  owners:     { found: number; created: number; matched: number; noCpf: number };
  properties: { found: number; created: number; matched: number };
  animals:    { found: number; created: number; matched: number; skipped: number };
  details:    { total: number; done: number; errors: number };
  issues:     string[];
  consecutiveErrors: number;
}

export interface JobView {
  id: string;
  status: 'running' | 'done' | 'error' | 'cancelled';
  phase: 'owners' | 'properties' | 'animals' | 'details' | 'done';
  stats: SyncStats;
  error: string | null;
  startedAt: string;
  finishedAt: string | null;
}

export function emptyStats(): SyncStats {
  return {
    owners:     { found: 0, created: 0, matched: 0, noCpf: 0 },
    properties: { found: 0, created: 0, matched: 0 },
    animals:    { found: 0, created: 0, matched: 0, skipped: 0 },
    details:    { total: 0, done: 0, errors: 0 },
    issues:     [],
    consecutiveErrors: 0,
  };
}

function withDefaults(stats: Partial<SyncStats> | null): SyncStats {
  const base = emptyStats();
  return {
    owners:     { ...base.owners,     ...stats?.owners },
    properties: { ...base.properties, ...stats?.properties },
    animals:    { ...base.animals,    ...stats?.animals },
    details:    { ...base.details,    ...stats?.details },
    issues:     stats?.issues ?? [],
    consecutiveErrors: stats?.consecutiveErrors ?? 0,
  };
}

export function jobView(job: any): JobView {
  return {
    id: job.id,
    status: job.status,
    phase: job.phase,
    stats: withDefaults(job.stats),
    error: job.error ?? null,
    startedAt: job.started_at,
    finishedAt: job.finished_at ?? null,
  };
}

function addIssue(stats: SyncStats, message: string) {
  if (stats.issues.length < MAX_ISSUES) stats.issues.push(message);
}

// ─── Banco ───────────────────────────────────────────────────────────────────

/** Lê todas as linhas de uma consulta (o PostgREST pagina em 1000). */
async function fetchAll(build: () => any): Promise<any[]> {
  const out: any[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await build().range(from, from + 999);
    if (error) throw error;
    out.push(...data);
    if (data.length < 1000) return out;
  }
}

async function insertChunks(client: any, table: string, rows: any[], size = 100) {
  for (let i = 0; i < rows.length; i += size) {
    const { error } = await client.from(table).insert(rows.slice(i, i + size));
    if (error) throw error;
  }
}

async function must<T>(query: PromiseLike<{ data: T; error: any }>): Promise<T> {
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

const blank = (v: unknown) => v === null || v === undefined || v === '';

/** Monta um patch só com os campos que estão vazios no EquiCore. */
function fillBlanks(local: Record<string, unknown>, remote: Record<string, unknown>): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(remote)) {
    if (!blank(value) && blank(local[key])) patch[key] = value;
  }
  return patch;
}

// ─── Sessão no portal ────────────────────────────────────────────────────────

async function loadIntegration(ctx: SyncContext) {
  const integration = await must<any>(
    ctx.admin.from('vet_integrations')
      .select('username, secret_enc, session_enc')
      .eq('vet_id', ctx.vetId).eq('provider', 'sgq')
      .maybeSingle(),
  );
  if (!integration) throw new SgqAuthError('Integração não configurada.');
  return integration;
}

/** Lê uma página reaproveitando a sessão salva; refaz o login uma única vez. */
async function fetchPage(ctx: SyncContext, page: string): Promise<string> {
  const integration = await loadIntegration(ctx);

  if (integration.session_enc) {
    let cookie: string | null = null;
    try { cookie = decryptSecret(integration.session_enc); } catch { /* chave trocada: refaz login */ }
    if (cookie) {
      const res = await sgqGet(cookie, page);
      if (res.loggedIn) return res.html;
      await sleep(800);
    }
  }

  const cookie = await sgqLogin(integration.username, decryptSecret(integration.secret_enc));
  await must(
    ctx.admin.from('vet_integrations')
      .update({ session_enc: encryptSecret(cookie) })
      .eq('vet_id', ctx.vetId).eq('provider', 'sgq'),
  );
  await sleep(800);

  const res = await sgqGet(cookie, page);
  if (!res.loggedIn) throw new SgqAuthError('A sessão do portal não se manteve.');
  return res.html;
}

// ─── Fase 1: proprietários ───────────────────────────────────────────────────

async function syncOwners(ctx: SyncContext, jobId: string, stats: SyncStats) {
  const rows = parseOwnerList(await fetchPage(ctx, 'proprietario_lista.php'));
  if (!rows) throw new Error('A lista de proprietários do portal mudou de formato.');

  const existing = await fetchAll(() =>
    ctx.db.from('vet_owners')
      .select('id, cpf_cnpj, phone, email, uf, city, address, district, cep')
      .eq('vet_id', ctx.vetId).order('id'),
  );
  const byCpf = new Map<string, any>(existing.map(o => [o.cpf_cnpj, o]));

  const inserts: any[] = [];
  const items: any[] = [];
  stats.owners = { found: rows.length, created: 0, matched: 0, noCpf: 0 };

  for (const row of rows) {
    const item = { job_id: jobId, kind: 'owner', sgq_code: row.code, label: normalizeKey(row.name) };

    if (row.cpfCnpj.length !== 11 && row.cpfCnpj.length !== 14) {
      stats.owners.noCpf++;
      addIssue(stats, `Proprietário sem CPF/CNPJ válido no portal (não importado): ${row.name}`);
      items.push({ ...item, local_id: null, status: 'skipped', note: 'sem CPF/CNPJ' });
      continue;
    }

    let local = byCpf.get(row.cpfCnpj);
    if (!local) {
      local = {
        id: randomUUID(), vet_id: ctx.vetId, name: row.name, cpf_cnpj: row.cpfCnpj,
        phone: row.phone, email: row.email, uf: row.uf, city: row.city,
      };
      inserts.push({ ...local });
      byCpf.set(row.cpfCnpj, local);
      stats.owners.created++;
    } else if (!local.queued) {
      stats.owners.matched++;
      // UF e cidade só entram juntas, para não misturar com um endereço já digitado
      const remote = blank(local.uf) && blank(local.city)
        ? { phone: row.phone, email: row.email, uf: row.uf, city: row.city }
        : { phone: row.phone, email: row.email };
      const patch = fillBlanks(local, remote);
      if (Object.keys(patch).length) {
        await must(ctx.db.from('vet_owners').update(patch).eq('id', local.id));
      }
    }

    // Endereço completo só existe na tela de edição: busca uma vez por proprietário
    const needsDetail = !local.queued && blank(local.address) && blank(local.district) && blank(local.cep);
    local.queued = true;
    items.push({ ...item, local_id: local.id, status: needsDetail ? 'pending' : 'skipped' });
  }

  await insertChunks(ctx.db, 'vet_owners', inserts);
  await insertChunks(ctx.admin, 'sgq_sync_items', items, 500);
}

// ─── Fase 2: propriedades ────────────────────────────────────────────────────

async function syncProperties(ctx: SyncContext, stats: SyncStats) {
  const rows = parsePropertyList(await fetchPage(ctx, 'propriedade_lista.php'));
  if (!rows) throw new Error('A lista de propriedades do portal mudou de formato.');

  const existing = await fetchAll(() =>
    ctx.db.from('vet_properties')
      .select('id, name, city, uf, sgq_code')
      .eq('vet_id', ctx.vetId).order('id'),
  );
  const placeKey = (p: { name: string; city: string | null; uf: string | null }) =>
    [normalizeKey(p.name), normalizeKey(p.city), normalizeKey(p.uf)].join('|');

  const byCode = new Set(existing.filter(p => p.sgq_code).map(p => p.sgq_code));
  const unlinked = new Map<string, any>(existing.filter(p => !p.sgq_code).map(p => [placeKey(p), p]));

  const inserts: any[] = [];
  stats.properties = { found: rows.length, created: 0, matched: 0 };

  for (const row of rows) {
    if (byCode.has(row.code)) { stats.properties.matched++; continue; }
    byCode.add(row.code);

    // Propriedade já cadastrada à mão com mesmo nome e município: só vincula
    const manual = unlinked.get(placeKey(row));
    if (manual) {
      unlinked.delete(placeKey(row));
      await must(ctx.db.from('vet_properties').update({ sgq_code: row.code }).eq('id', manual.id));
      stats.properties.matched++;
      continue;
    }

    inserts.push({
      id: randomUUID(), vet_id: ctx.vetId, name: row.name, city: row.city, uf: row.uf,
      classification: row.classification, sgq_code: row.code,
    });
    stats.properties.created++;
  }

  await insertChunks(ctx.db, 'vet_properties', inserts);
}

// ─── Fase 3: equinos (lista) ─────────────────────────────────────────────────

const equineKey = (ownerId: string, name: string) => `${ownerId}|${normalizeKey(name)}`;

async function syncAnimals(ctx: SyncContext, jobId: string, stats: SyncStats) {
  const rows = parseAnimalList(await fetchPage(ctx, 'animal_lista.php'));
  if (!rows) throw new Error('A lista de animais do portal mudou de formato.');

  const [existing, ownerItems] = await Promise.all([
    fetchAll(() =>
      ctx.db.from('vet_equines')
        .select('id, sgq_code, name, owner_id, sgq_synced_at')
        .eq('vet_id', ctx.vetId).order('id'),
    ),
    fetchAll(() =>
      ctx.admin.from('sgq_sync_items')
        .select('label, local_id')
        .eq('job_id', jobId).eq('kind', 'owner').not('local_id', 'is', null).order('id'),
    ),
  ]);

  // Nome do proprietário → cadastros locais. A lista do portal só traz o nome,
  // então o vínculo direto só vale quando o nome é único; homônimos ficam para
  // a ficha do animal, que traz o código do proprietário.
  const ownersByName = new Map<string, Set<string>>();
  for (const o of ownerItems) {
    if (!ownersByName.has(o.label)) ownersByName.set(o.label, new Set());
    ownersByName.get(o.label)!.add(o.local_id);
  }

  const byCode = new Map<string, any>(existing.filter(e => e.sgq_code).map(e => [e.sgq_code, e]));
  const unlinked = new Map<string, any>(
    existing.filter(e => !e.sgq_code).map(e => [equineKey(e.owner_id, e.name), e]),
  );

  const inserts: any[] = [];
  const items: any[] = [];
  stats.animals = { found: rows.length, created: 0, matched: 0, skipped: 0 };

  for (const row of rows) {
    const item = { job_id: jobId, kind: 'animal', sgq_code: row.code, label: normalizeKey(row.name) };

    const known = byCode.get(row.code);
    if (known) {
      stats.animals.matched++;
      items.push({ ...item, local_id: known.id, status: known.sgq_synced_at ? 'skipped' : 'pending' });
      continue;
    }

    const owners = ownersByName.get(normalizeKey(row.ownerName));
    if (owners?.size !== 1) {
      items.push({ ...item, local_id: null, status: 'pending' });
      continue;
    }
    const ownerId = [...owners][0];

    // Animal já cadastrado à mão para o mesmo dono: vincula em vez de duplicar
    const manual = unlinked.get(equineKey(ownerId, row.name));
    if (manual) {
      unlinked.delete(equineKey(ownerId, row.name));
      await must(ctx.db.from('vet_equines').update({ sgq_code: row.code }).eq('id', manual.id));
      byCode.set(row.code, manual);
      stats.animals.matched++;
      items.push({ ...item, local_id: manual.id, status: 'pending' });
      continue;
    }

    const id = randomUUID();
    inserts.push({
      id, vet_id: ctx.vetId, owner_id: ownerId, name: row.name,
      breed: row.breed, sex: row.sex, sgq_code: row.code,
    });
    byCode.set(row.code, { id });
    stats.animals.created++;
    items.push({ ...item, local_id: id, status: 'pending' });
  }

  await insertChunks(ctx.db, 'vet_equines', inserts);
  await insertChunks(ctx.admin, 'sgq_sync_items', items, 500);

  const { count, error } = await ctx.admin.from('sgq_sync_items')
    .select('id', { count: 'exact', head: true })
    .eq('job_id', jobId).eq('status', 'pending');
  if (error) throw error;
  stats.details = { total: count ?? 0, done: 0, errors: 0 };
}

// ─── Fase 4: fichas (uma por passo) ──────────────────────────────────────────

function fichaToColumns(f: SgqAnimalFicha) {
  return {
    registry_brand: f.registryBrand,
    chip:           f.chip,
    species:        f.species,
    breed:          f.breed,
    coat:           f.coat,
    sex:            f.sex,
    birth_date:     f.birthDate,
    age_years:      f.ageYears,
    signs_desc:     f.signsDesc,
  };
}

type ItemResult = { status: 'done' | 'skipped'; note?: string; localId?: string };

async function syncAnimalDetail(ctx: SyncContext, jobId: string, item: any, stats: SyncStats): Promise<ItemResult> {
  const ficha = parseAnimalFicha(await fetchPage(ctx, `animal_ficha.php?cod_animal=${item.sgq_code}`));
  if (!ficha) throw new Error('ficha do animal em formato inesperado');

  const syncedAt = new Date().toISOString();

  if (item.local_id) {
    const local = await must<any>(
      ctx.db.from('vet_equines')
        .select('id, registry_brand, chip, species, breed, coat, sex, birth_date, age_years, signs_desc')
        .eq('id', item.local_id).maybeSingle(),
    );
    if (!local) return { status: 'skipped', note: 'registro removido no EquiCore' };
    const patch = { ...fillBlanks(local, fichaToColumns(ficha)), sgq_synced_at: syncedAt };
    await must(ctx.db.from('vet_equines').update(patch).eq('id', local.id));
    return { status: 'done' };
  }

  // Sem vínculo pela lista (homônimo ou nome divergente): resolve pelo código do dono
  const ownerItem = ficha.ownerCode
    ? await must<any>(
        ctx.admin.from('sgq_sync_items').select('local_id')
          .eq('job_id', jobId).eq('kind', 'owner').eq('sgq_code', ficha.ownerCode).maybeSingle(),
      )
    : null;
  const ownerId: string | undefined = ownerItem?.local_id ?? undefined;
  if (!ownerId) {
    stats.animals.skipped++;
    addIssue(stats, `Animal não importado (proprietário sem CPF/CNPJ no portal): ${ficha.name}`);
    return { status: 'skipped', note: 'proprietário sem CPF/CNPJ' };
  }

  const sameOwner = await must<any[]>(
    ctx.db.from('vet_equines').select('id, name, registry_brand, chip, species, breed, coat, sex, birth_date, age_years, signs_desc')
      .eq('vet_id', ctx.vetId).eq('owner_id', ownerId).is('sgq_code', null),
  );
  const manual = sameOwner.find(e => normalizeKey(e.name) === normalizeKey(ficha.name));

  if (manual) {
    const patch = { ...fillBlanks(manual, fichaToColumns(ficha)), sgq_code: item.sgq_code, sgq_synced_at: syncedAt };
    await must(ctx.db.from('vet_equines').update(patch).eq('id', manual.id));
    stats.animals.matched++;
    return { status: 'done', localId: manual.id };
  }

  const id = randomUUID();
  await must(ctx.db.from('vet_equines').insert({
    id, vet_id: ctx.vetId, owner_id: ownerId, name: ficha.name,
    ...fichaToColumns(ficha), sgq_code: item.sgq_code, sgq_synced_at: syncedAt,
  }));
  stats.animals.created++;
  return { status: 'done', localId: id };
}

async function syncOwnerDetail(ctx: SyncContext, item: any): Promise<ItemResult> {
  const detail = parseOwnerDetail(await fetchPage(ctx, `proprietario_editar.php?cod_pro=${item.sgq_code}`));
  if (!detail) throw new Error('cadastro do proprietário em formato inesperado');

  const local = await must<any>(
    ctx.db.from('vet_owners')
      .select('id, address, district, cep, producer_number')
      .eq('id', item.local_id).maybeSingle(),
  );
  if (!local) return { status: 'skipped', note: 'registro removido no EquiCore' };

  const patch = fillBlanks(local, {
    address: detail.address, district: detail.district, cep: detail.cep, producer_number: detail.producerNumber,
  });
  if (Object.keys(patch).length) {
    await must(ctx.db.from('vet_owners').update(patch).eq('id', local.id));
  }
  return { status: 'done' };
}

/** Processa o próximo item pendente. Devolve false quando a fila acabou. */
async function syncNextDetail(ctx: SyncContext, jobId: string, stats: SyncStats): Promise<boolean> {
  // 'animal' < 'owner': as fichas dos animais vêm antes dos endereços
  const item = await must<any>(
    ctx.admin.from('sgq_sync_items').select('*')
      .eq('job_id', jobId).eq('status', 'pending')
      .order('kind').order('id').limit(1).maybeSingle(),
  );
  if (!item) return false;

  let update: Record<string, unknown>;
  try {
    const result = item.kind === 'animal'
      ? await syncAnimalDetail(ctx, jobId, item, stats)
      : await syncOwnerDetail(ctx, item);
    update = { status: result.status, note: result.note ?? null, ...(result.localId ? { local_id: result.localId } : {}) };
    stats.consecutiveErrors = 0;
  } catch (err) {
    // Login recusado ou portal bloqueando: interrompe o job inteiro
    if (err instanceof SgqAuthError || err instanceof SgqBlockedError) throw err;
    console.error('[sgq/sync] item', item.kind, item.sgq_code, err);
    update = { status: 'error', note: err instanceof Error ? err.message.slice(0, 200) : 'erro' };
    stats.details.errors++;
    stats.consecutiveErrors++;
  }

  await must(ctx.admin.from('sgq_sync_items').update(update).eq('id', item.id));
  stats.details.done++;

  if (stats.consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
    throw new Error('Muitas falhas seguidas ao ler o portal.');
  }
  return true;
}

// ─── Orquestração ────────────────────────────────────────────────────────────

/**
 * Reserva o próximo passo do job. Devolve null se outro passo está em
 * andamento ou se o intervalo mínimo ainda não passou.
 */
export async function claimTick(admin: any, jobId: string): Promise<any | null> {
  const now = Date.now();
  const { data, error } = await admin.from('sgq_sync_jobs')
    .update({ tick_lock_until: new Date(now + LOCK_MS).toISOString() })
    .eq('id', jobId).eq('status', 'running')
    .lt('tick_lock_until', new Date(now).toISOString())
    .select().maybeSingle();
  if (error) throw error;
  return data;
}

function errorMessage(err: unknown): string {
  if (err instanceof SgqAuthError) {
    return 'O portal SGQ recusou o login. Confira o e-mail e a senha da integração.';
  }
  if (err instanceof SgqBlockedError) {
    return 'O portal SGQ recusou o acesso. A sincronização foi interrompida — tente novamente mais tarde.';
  }
  if (err instanceof Error && /portal/i.test(err.message)) return err.message;
  return 'Falha inesperada na sincronização.';
}

/** Executa um passo de um job já reservado por claimTick(). */
export async function runTick(ctx: SyncContext, job: any): Promise<JobView> {
  const stats = withDefaults(job.stats);
  let update: Record<string, unknown>;

  try {
    let phase: JobView['phase'] = job.phase;

    if (phase === 'owners') {
      // Recomeço limpo caso um passo anterior tenha caído no meio
      await must(ctx.admin.from('sgq_sync_items').delete().eq('job_id', job.id));
      await syncOwners(ctx, job.id, stats);
      phase = 'properties';
    } else if (phase === 'properties') {
      await syncProperties(ctx, stats);
      phase = 'animals';
    } else if (phase === 'animals') {
      await must(ctx.admin.from('sgq_sync_items').delete().eq('job_id', job.id).eq('kind', 'animal'));
      await syncAnimals(ctx, job.id, stats);
      phase = 'details';
    } else if (phase === 'details') {
      const more = await syncNextDetail(ctx, job.id, stats);
      if (!more) phase = 'done';
    }

    update = { phase, stats, tick_lock_until: new Date(Date.now() + MIN_INTERVAL_MS).toISOString() };

    if (phase === 'done') {
      const finishedAt = new Date().toISOString();
      update = { ...update, status: 'done', finished_at: finishedAt };
      await must(
        ctx.admin.from('vet_integrations')
          .update({ last_sync_at: finishedAt })
          .eq('vet_id', ctx.vetId).eq('provider', 'sgq'),
      );
    }
  } catch (err) {
    if (!(err instanceof SgqAuthError) && !(err instanceof SgqBlockedError)) {
      console.error('[sgq/sync] job', job.id, job.phase, err);
    }
    update = { stats, status: 'error', error: errorMessage(err), finished_at: new Date().toISOString() };
  }

  // Só grava se o job continua em andamento (pode ter sido cancelado durante o passo)
  const saved = await must<any>(
    ctx.admin.from('sgq_sync_jobs').update(update)
      .eq('id', job.id).eq('status', 'running').select().maybeSingle(),
  );
  if (saved) return jobView(saved);
  return jobView(await must<any>(ctx.admin.from('sgq_sync_jobs').select().eq('id', job.id).single()));
}
