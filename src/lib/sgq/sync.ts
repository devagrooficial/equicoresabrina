// Sincronização com o Portal Central de Requisições (SGQ), em passos curtos.
//
// Cada chamada de runTick() lê NO MÁXIMO uma página do portal (fora o login,
// quando a sessão expira). O navegador do veterinário dispara os passos com
// intervalo entre eles; o estado fica em sgq_sync_jobs / sgq_sync_items, então
// a sincronização pode ser interrompida e retomada.
//
// Fases: owners → properties → animals → exams (listas) → details (fichas,
// endereços, propriedades e, no fim, o vínculo animal–propriedade).
//
// Regras de gravação:
//  - dados do EquiCore nunca são sobrescritos: a importação só cria registros
//    novos ou preenche campos que estavam vazios;
//  - vet_owners / vet_properties / vet_equines são gravados com a sessão do
//    próprio veterinário (RLS + auditoria com o autor correto);
//  - credenciais e fila usam service_role e ficam invisíveis ao cliente.

import { createHash, randomUUID } from 'node:crypto';
import { decryptSecret, encryptSecret } from './crypto';
import { sgqGet, sgqGetUpload, sgqLogin, sleep, SgqAuthError, SgqBlockedError } from './client';
import {
  EXAM_LABEL, EXAM_TYPES, HEALTH_LABEL, normalizeKey, parseAnimalFicha, parseAnimalList,
  parseExamList, parseOwnerDetail, parseOwnerList, parsePropertyDetail, parsePropertyList,
  parseRequisitionProperty,
  type ExamType, type HealthKind, type SgqAnimalFicha,
} from './parse';
import { maskCpfCnpj } from '../br';

/** Intervalo mínimo entre dois acessos ao portal (aplicado no servidor). */
export const MIN_INTERVAL_MS = 2_500;
/** Trava de um passo em execução; expira sozinha se a função cair (o limite da função é 60 s). */
const LOCK_MS = 70_000;
/**
 * Tempo máximo de um passo. Fica abaixo do limite da função para que o
 * servidor ainda consiga responder dizendo ONDE parou, em vez de ser
 * derrubado sem resposta.
 */
const TICK_BUDGET_MS = 45_000;

class TickTimeout extends Error {}
const MAX_ISSUES = 40;
const MAX_CONSECUTIVE_ERRORS = 5;

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface SyncContext {
  admin: any;     // service_role — credenciais, jobs e fila
  db: any;        // sessão do veterinário — tabelas vet_* (RLS)
  vetId: string;
  /** O que o passo está fazendo agora — vai na mensagem se ele estourar o tempo */
  trace?: string;
}

const mark = (ctx: SyncContext, what: string) => { ctx.trace = what; };

export interface SyncStats {
  owners:     { found: number; created: number; matched: number; noCpf: number };
  properties: { found: number; created: number; matched: number };
  animals:    { found: number; created: number; matched: number; skipped: number };
  /** cursor: quantas das listas de requisição (EXAM_TYPES) já foram lidas */
  exams:      { found: number; created: number; linked: number; cursor: number };
  health:     { records: number };
  files:      { resenhos: number; photos: number };
  /** Vínculo animal–propriedade, lido da última requisição de cada animal */
  links:      { queued: boolean; total: number; linked: number };
  details:    { total: number; done: number; errors: number };
  issues:     string[];
  consecutiveErrors: number;
  /** true = reler também as fichas de animais já importados (pega exames e histórico novos) */
  full: boolean;
}

export interface JobView {
  id: string;
  status: 'running' | 'done' | 'error' | 'cancelled';
  phase: 'owners' | 'properties' | 'animals' | 'exams' | 'details' | 'done';
  stats: SyncStats;
  error: string | null;
  startedAt: string;
  finishedAt: string | null;
}

/** Um campo do de-para: valor no portal → valor gravado no EquiCore. */
export interface SyncChange {
  field: string;            // nome do campo no EquiCore
  from: string | null;      // como está no portal SGQ
  to: string | null;        // como fica no EquiCore
  written: boolean;         // false = o EquiCore já tinha valor e ele foi mantido
}

/** O que um passo fez — exibido na tela como atividade; não é persistido. */
export interface SyncEvent {
  scope: 'owners' | 'properties' | 'animals' | 'exams' | 'animal' | 'owner' | 'property' | 'link';
  title: string;
  outcome: 'created' | 'updated' | 'unchanged' | 'skipped' | 'error';
  note?: string;
  changes: SyncChange[];
  /** Nas listas: primeiros registros, como amostra do de-para */
  samples?: { title: string; changes: SyncChange[] }[];
}

const SAMPLE_SIZE = 5;

function change(field: string, from: string | null | undefined, to: string | null | undefined, written = true): SyncChange | null {
  if (blank(from) && blank(to)) return null;
  return { field, from: from || null, to: to || null, written };
}

const compact = (list: (SyncChange | null)[]): SyncChange[] => list.filter((c): c is SyncChange => c !== null);

const placeLabel = (city: string | null, uf: string | null) => [city, uf].filter(Boolean).join(' / ') || null;

function listNote(found: number, created: number, matched: number, extra?: string): string {
  return `${found} lidos — ${created} novos, ${matched} já no EquiCore${extra ? `, ${extra}` : ''}`;
}

export function emptyStats(full = false): SyncStats {
  return {
    full,
    owners:     { found: 0, created: 0, matched: 0, noCpf: 0 },
    properties: { found: 0, created: 0, matched: 0 },
    animals:    { found: 0, created: 0, matched: 0, skipped: 0 },
    exams:      { found: 0, created: 0, linked: 0, cursor: 0 },
    health:     { records: 0 },
    files:      { resenhos: 0, photos: 0 },
    links:      { queued: false, total: 0, linked: 0 },
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
    exams:      { ...base.exams,      ...stats?.exams },
    health:     { ...base.health,     ...stats?.health },
    files:      { ...base.files,      ...stats?.files },
    links:      { ...base.links,      ...stats?.links },
    details:    { ...base.details,    ...stats?.details },
    issues:     stats?.issues ?? [],
    consecutiveErrors: stats?.consecutiveErrors ?? 0,
    full:       stats?.full ?? false,
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
export async function fetchPage(ctx: SyncContext, page: string): Promise<string> {
  const pageName = page.replace(/\?.*$/, '');
  mark(ctx, `lendo credenciais da integração (${pageName})`);
  const integration = await loadIntegration(ctx);
  mark(ctx, `aguardando o portal SGQ responder ${pageName}`);

  if (integration.session_enc) {
    let cookie: string | null = null;
    try { cookie = decryptSecret(integration.session_enc); } catch { /* chave trocada: refaz login */ }
    if (cookie) {
      const res = await sgqGet(cookie, page);
      if (res.loggedIn) return res.html;
      await sleep(800);
    }
  }

  mark(ctx, `refazendo o login no portal SGQ (${pageName})`);
  const cookie = await sgqLogin(integration.username, decryptSecret(integration.secret_enc));
  await must(
    ctx.admin.from('vet_integrations')
      .update({ session_enc: encryptSecret(cookie) })
      .eq('vet_id', ctx.vetId).eq('provider', 'sgq'),
  );
  await sleep(800);

  mark(ctx, `aguardando o portal SGQ responder ${pageName} (após novo login)`);
  const res = await sgqGet(cookie, page);
  if (!res.loggedIn) throw new SgqAuthError('A sessão do portal não se manteve.');
  return res.html;
}

// ─── Fase 1: proprietários ───────────────────────────────────────────────────

async function syncOwners(ctx: SyncContext, jobId: string, stats: SyncStats): Promise<SyncEvent> {
  const rows = parseOwnerList(await fetchPage(ctx, 'proprietario_lista.php'));
  if (!rows) throw new Error('A lista de proprietários do portal mudou de formato.');
  mark(ctx, `gravando ${rows.length} proprietários no banco`);

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

  const { found, created, matched, noCpf } = stats.owners;
  return {
    scope: 'owners',
    title: 'Lista de proprietários',
    outcome: created ? 'created' : 'unchanged',
    note: listNote(found, created, matched, noCpf ? `${noCpf} sem CPF/CNPJ (não importados)` : undefined),
    changes: [],
    samples: rows.filter(r => r.cpfCnpj.length === 11 || r.cpfCnpj.length === 14).slice(0, SAMPLE_SIZE).map(r => ({
      title: r.name,
      changes: compact([
        change('CPF/CNPJ', r.cpfCnpj, maskCpfCnpj(r.cpfCnpj)),
        change('Cidade / UF', r.raw.cityUf, placeLabel(r.city, r.uf)),
        change('Telefone', r.raw.phone, r.phone),
        change('E-mail', r.email, r.email),
      ]),
    })),
  };
}

// ─── Fase 2: propriedades ────────────────────────────────────────────────────

async function syncProperties(ctx: SyncContext, jobId: string, stats: SyncStats): Promise<SyncEvent> {
  const rows = parsePropertyList(await fetchPage(ctx, 'propriedade_lista.php'));
  if (!rows) throw new Error('A lista de propriedades do portal mudou de formato.');
  mark(ctx, `gravando ${rows.length} propriedades no banco`);

  const existing = await fetchAll(() =>
    ctx.db.from('vet_properties')
      .select('id, name, city, uf, sgq_code, classification, address, oesa_code, animal_count')
      .eq('vet_id', ctx.vetId).order('id'),
  );
  const placeKey = (p: { name: string; city: string | null; uf: string | null }) =>
    [normalizeKey(p.name), normalizeKey(p.city), normalizeKey(p.uf)].join('|');

  const byCode = new Map<string, any>(existing.filter(p => p.sgq_code).map(p => [p.sgq_code, p]));
  const unlinked = new Map<string, any>(existing.filter(p => !p.sgq_code).map(p => [placeKey(p), p]));

  const inserts: any[] = [];
  const items: any[] = [];
  stats.properties = { found: rows.length, created: 0, matched: 0 };

  for (const row of rows) {
    let local = byCode.get(row.code);

    if (local) {
      stats.properties.matched++;
      if (blank(local.classification) && row.classification) {
        await must(ctx.db.from('vet_properties').update({ classification: row.classification }).eq('id', local.id));
      }
    } else {
      // Propriedade já cadastrada à mão com mesmo nome e município: só vincula
      const manual = unlinked.get(placeKey(row));
      if (manual) {
        unlinked.delete(placeKey(row));
        const patch = { sgq_code: row.code, ...fillBlanks(manual, { classification: row.classification }) };
        await must(ctx.db.from('vet_properties').update(patch).eq('id', manual.id));
        local = manual;
        stats.properties.matched++;
      } else {
        local = {
          id: randomUUID(), vet_id: ctx.vetId, name: row.name, city: row.city, uf: row.uf,
          classification: row.classification, sgq_code: row.code,
        };
        inserts.push({ ...local });
        stats.properties.created++;
      }
      byCode.set(row.code, local);
    }

    // Endereço, Nº OESA e quantidade de animais só existem na tela de edição
    const needsDetail = blank(local.address) && blank(local.oesa_code) && blank(local.animal_count);
    items.push({
      job_id: jobId, kind: 'property', sgq_code: row.code, label: normalizeKey(row.name),
      local_id: local.id, status: needsDetail ? 'pending' : 'skipped',
    });
  }

  await insertChunks(ctx.db, 'vet_properties', inserts);
  await insertChunks(ctx.admin, 'sgq_sync_items', items, 500);

  const { found, created, matched } = stats.properties;
  return {
    scope: 'properties',
    title: 'Lista de propriedades',
    outcome: created ? 'created' : 'unchanged',
    note: listNote(found, created, matched),
    changes: [],
    samples: rows.slice(0, SAMPLE_SIZE).map(r => ({
      title: r.name,
      changes: compact([
        change('Cidade / UF', r.raw.cityUf, placeLabel(r.city, r.uf)),
        change('Classificação', r.raw.classification, r.classification, r.classification !== null),
      ]),
    })),
  };
}

// ─── Fase 3: equinos (lista) ─────────────────────────────────────────────────

const equineKey = (ownerId: string, name: string) => `${ownerId}|${normalizeKey(name)}`;

async function syncAnimals(ctx: SyncContext, jobId: string, stats: SyncStats): Promise<SyncEvent> {
  const rows = parseAnimalList(await fetchPage(ctx, 'animal_lista.php'));
  if (!rows) throw new Error('A lista de animais do portal mudou de formato.');
  mark(ctx, `gravando ${rows.length} animais no banco`);

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
      items.push({ ...item, local_id: known.id, status: known.sgq_synced_at && !stats.full ? 'skipped' : 'pending' });
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

  const { found, created, matched } = stats.animals;
  const waiting = found - created - matched;
  return {
    scope: 'animals',
    title: 'Lista de animais',
    outcome: created ? 'created' : 'unchanged',
    note: listNote(found, created, matched, waiting > 0 ? `${waiting} aguardam a ficha para identificar o dono` : undefined),
    changes: [],
    samples: rows.slice(0, SAMPLE_SIZE).map(r => ({
      title: r.name,
      changes: compact([
        change('Proprietário', r.ownerName, r.ownerName),
        change('Raça', r.raw.breed, r.breed),
        change('Sexo', r.raw.sex, r.sex),
      ]),
    })),
  };
}

// ─── Fase 4: exames (uma lista de requisições por passo) ─────────────────────

/**
 * Lê uma das listas de requisição (AIE IDGA, AIE ELISA, mormo ELISA) e grava os
 * exames. O animal é ligado pelo par proprietário + nome quando ele é único;
 * o resto é ligado depois, pela ficha do animal, que lista os próprios exames.
 */
async function syncExams(ctx: SyncContext, stats: SyncStats): Promise<SyncEvent> {
  const type: ExamType = EXAM_TYPES[stats.exams.cursor];
  const rows = parseExamList(await fetchPage(ctx, `requisicao_${type}_lista.php`));
  if (!rows) throw new Error('A lista de requisições do portal mudou de formato.');

  mark(ctx, `lendo exames e animais já cadastrados (${rows.length} requisições de ${EXAM_LABEL[type]})`);
  const [existing, equines, owners] = await Promise.all([
    fetchAll(() =>
      ctx.db.from('vet_equine_exams')
        .select('id, number, equine_id, sgq_code, laboratory, collection_date, laudo_available')
        .eq('vet_id', ctx.vetId).order('id'),
    ),
    fetchAll(() => ctx.db.from('vet_equines').select('id, name, owner_id').eq('vet_id', ctx.vetId).order('id')),
    fetchAll(() => ctx.db.from('vet_owners').select('id, name').eq('vet_id', ctx.vetId).order('id')),
  ]);

  const ownerName = new Map<string, string>(owners.map(o => [o.id, normalizeKey(o.name)]));
  const byPair = new Map<string, Set<string>>();
  const byName = new Map<string, Set<string>>();
  const add = (map: Map<string, Set<string>>, key: string, id: string) => {
    if (!map.has(key)) map.set(key, new Set());
    map.get(key)!.add(id);
  };
  for (const e of equines) {
    const name = normalizeKey(e.name);
    add(byPair, `${ownerName.get(e.owner_id) ?? ''}|${name}`, e.id);
    add(byName, name, e.id);
  }
  const resolve = (owner: string, animal: string): string | null => {
    const pair = byPair.get(`${normalizeKey(owner)}|${normalizeKey(animal)}`);
    if (pair?.size === 1) return [...pair][0];
    if (pair) return null;                                   // homônimos do mesmo dono
    const name = byName.get(normalizeKey(animal));
    return name?.size === 1 ? [...name][0] : null;
  };

  const byNumber = new Map<string, any>(existing.map(e => [e.number, e]));
  const inserts: any[] = [];
  let created = 0;
  let linked = 0;

  mark(ctx, `atualizando exames de ${EXAM_LABEL[type]} já cadastrados`);
  for (const row of rows) {
    const equineId = resolve(row.ownerName, row.animalName);
    const known = byNumber.get(row.number);

    if (!known) {
      inserts.push({
        vet_id: ctx.vetId, equine_id: equineId, exam_type: type, number: row.number, sgq_code: row.code,
        collection_date: row.collectionDate, laboratory: row.laboratory, laudo_available: row.laudoAvailable,
        owner_name: row.ownerName, animal_name: row.animalName,
      });
      byNumber.set(row.number, { number: row.number });
      created++;
      if (equineId) linked++;
      continue;
    }

    const patch: Record<string, unknown> = fillBlanks(known, {
      sgq_code: row.code, laboratory: row.laboratory, collection_date: row.collectionDate, equine_id: equineId,
    });
    if (!known.laudo_available && row.laudoAvailable) patch.laudo_available = true;
    if (Object.keys(patch).length) {
      await must(ctx.db.from('vet_equine_exams').update(patch).eq('id', known.id));
      if (patch.equine_id) linked++;
    }
  }

  mark(ctx, `gravando ${inserts.length} exames de ${EXAM_LABEL[type]} no banco`);
  await insertChunks(ctx.db, 'vet_equine_exams', inserts, 500);

  stats.exams.found += rows.length;
  stats.exams.created += created;
  stats.exams.linked += linked;
  stats.exams.cursor += 1;

  return {
    scope: 'exams',
    title: `Requisições de ${EXAM_LABEL[type]}`,
    outcome: created ? 'created' : 'unchanged',
    note: `${rows.length} lidas — ${created} novas, ${rows.length - created} já no EquiCore`,
    changes: [],
    samples: rows.slice(0, SAMPLE_SIZE).map(r => ({
      title: `${r.number} · ${r.animalName}`,
      changes: compact([
        change('Proprietário', r.ownerName, r.ownerName),
        change('Colheita', r.collectionDate ? isoToBr(r.collectionDate) : null, r.collectionDate ? isoToBr(r.collectionDate) : null),
        change('Laboratório', r.laboratory, r.laboratory),
        change('Laudo', r.laudoAvailable ? 'Disponível' : 'Aguardando', r.laudoAvailable ? 'Disponível' : 'Aguardando'),
      ]),
    })),
  };
}

// ─── Fase 5: fichas (uma por passo) ──────────────────────────────────────────

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

const isoToBr = (iso: string | null) => (iso ? iso.split('-').reverse().join('/') : null);

/** De-para da ficha. `written` = colunas gravadas agora (null = todas, registro novo). */
function fichaChanges(f: SgqAnimalFicha, written: Set<string> | null): SyncChange[] {
  const w = (column: string) => written === null || written.has(column);
  return compact([
    change('Registro/Marca',      f.registryBrand,  f.registryBrand,                              w('registry_brand')),
    change('Nº Chip',             f.chip,           f.chip,                                       w('chip')),
    change('Espécie',             f.raw.species,    f.species,                                    w('species')),
    change('Raça',                f.raw.breed,      f.breed,                                      w('breed')),
    change('Pelagem',             f.raw.coat,       f.coat,                                       w('coat')),
    change('Sexo',                f.raw.sex,        f.sex,                                        w('sex')),
    change('Data de nascimento',  f.raw.birthDate,  isoToBr(f.birthDate),                         w('birth_date')),
    change('Idade',               f.raw.age,        f.ageYears !== null ? `${f.ageYears} anos` : null, w('age_years')),
    change('Descrição de sinais', f.signsDesc,      f.signsDesc,                                  w('signs_desc')),
  ]);
}

type ItemResult = { status: 'done' | 'skipped'; note?: string; localId?: string; event: SyncEvent };

const EQUINE_COLUMNS =
  'id, name, registry_brand, chip, species, breed, coat, sex, birth_date, age_years, signs_desc, resenha_url, portal_photo_url';

const sourceKey = (data: Record<string, string>) =>
  createHash('sha1').update(JSON.stringify(data)).digest('hex');

/** Grava um arquivo do portal na pasta do animal (bucket docs) e devolve o path. */
async function storeEquineFile(ctx: SyncContext, equineId: string, name: string, src: string): Promise<string | null> {
  await sleep(600);
  const file = await sgqGetUpload(src);         // SgqBlockedError sobe: o portal mandou parar
  if (!file) return null;
  const path = `${ctx.vetId}/equinos/${equineId}/${name}.${file.ext}`;
  const { error } = await ctx.db.storage.from('docs').upload(path, file.bytes, { contentType: file.contentType, upsert: true });
  if (error) {
    // Falha de armazenamento não invalida o resto da ficha; a imagem fica para uma próxima vez
    console.error('[sgq/sync] upload', name, error.message);
    return null;
  }
  return path;
}

/**
 * O que a ficha traz além do cadastro: exames do animal, histórico de saúde,
 * resenho e foto. `equine` é a linha local já gravada.
 */
async function syncFichaExtras(ctx: SyncContext, equine: any, ficha: SgqAnimalFicha, stats: SyncStats): Promise<SyncChange[]> {
  const changes: SyncChange[] = [];

  if (ficha.exams.length) {
    const existing = await must<any[]>(
      ctx.db.from('vet_equine_exams')
        .select('id, number, equine_id, requested_date, laudo_available')
        .eq('vet_id', ctx.vetId).in('number', ficha.exams.map(e => e.number)),
    );
    const byNumber = new Map<string, any>(existing.map(e => [e.number, e]));
    const inserts: any[] = [];
    let touched = 0;

    for (const exam of ficha.exams) {
      const known = byNumber.get(exam.number);
      if (known) {
        // A ficha é a fonte exata do vínculo: corrige o que a lista ligou só pelo nome
        const patch: Record<string, unknown> = {};
        if (known.equine_id !== equine.id) patch.equine_id = equine.id;
        if (blank(known.requested_date) && exam.requestedDate) patch.requested_date = exam.requestedDate;
        if (!known.laudo_available && exam.laudoAvailable) patch.laudo_available = true;
        if (Object.keys(patch).length) {
          await must(ctx.db.from('vet_equine_exams').update(patch).eq('id', known.id));
          touched++;
          if (patch.equine_id && !known.equine_id) stats.exams.linked++;
        }
      } else if (exam.type) {
        inserts.push({
          vet_id: ctx.vetId, equine_id: equine.id, exam_type: exam.type, number: exam.number,
          requested_date: exam.requestedDate, collection_date: exam.collectionDate,
          laudo_available: exam.laudoAvailable, animal_name: ficha.name,
        });
      }
    }
    if (inserts.length) {
      await insertChunks(ctx.db, 'vet_equine_exams', inserts);
      stats.exams.created += inserts.length;
      stats.exams.linked += inserts.length;
    }
    changes.push({
      field: 'Exames',
      from: `${ficha.exams.length} na ficha (${[...new Set(ficha.exams.map(e => e.typeLabel))].join(', ')})`,
      to: `${ficha.exams.length} ligados ao animal`,
      written: touched + inserts.length > 0,
    });
  }

  if (ficha.health.length) {
    const rows = ficha.health.map(h => ({
      vet_id: ctx.vetId, equine_id: equine.id, kind: h.kind, event_date: h.eventDate,
      title: h.title, data: h.data, source_key: sourceKey(h.data),
    }));
    const { data: inserted, error } = await ctx.db.from('vet_equine_health_records')
      .upsert(rows, { onConflict: 'equine_id,kind,source_key', ignoreDuplicates: true })
      .select('id');
    if (error) throw error;
    stats.health.records += inserted?.length ?? 0;

    const perKind = new Map<HealthKind, number>();
    for (const h of ficha.health) perKind.set(h.kind, (perKind.get(h.kind) ?? 0) + 1);
    for (const [kind, n] of perKind) {
      changes.push({ field: HEALTH_LABEL[kind], from: `${n} no portal`, to: `${n} no histórico`, written: (inserted?.length ?? 0) > 0 });
    }
  }

  if (ficha.resenhoSrc) {
    let written = false;
    if (blank(equine.resenha_url)) {
      const path = await storeEquineFile(ctx, equine.id, 'resenha-importada', ficha.resenhoSrc);
      if (path) {
        await must(ctx.db.from('vet_equines').update({ resenha_url: path }).eq('id', equine.id));
        stats.files.resenhos++;
        written = true;
      }
    }
    changes.push({ field: 'Resenho', from: 'imagem no portal', to: 'imagem importada', written });
  }

  if (ficha.photoSrc) {
    let written = false;
    if (blank(equine.portal_photo_url)) {
      const path = await storeEquineFile(ctx, equine.id, 'foto-portal', ficha.photoSrc);
      if (path) {
        await must(ctx.db.from('vet_equines').update({ portal_photo_url: path }).eq('id', equine.id));
        stats.files.photos++;
        written = true;
      }
    }
    changes.push({ field: 'Foto', from: 'foto no portal', to: 'foto importada', written });
  }

  return changes;
}

async function syncAnimalDetail(ctx: SyncContext, jobId: string, item: any, stats: SyncStats): Promise<ItemResult> {
  const ficha = parseAnimalFicha(await fetchPage(ctx, `animal_ficha.php?cod_animal=${item.sgq_code}`));
  if (!ficha) throw new Error('ficha do animal em formato inesperado');
  mark(ctx, 'gravando a ficha do animal no banco');

  const skipped = (note: string): ItemResult =>
    ({ status: 'skipped', note, event: { scope: 'animal', title: ficha.name, outcome: 'skipped', note, changes: [] } });

  let equine: any;                          // linha local depois de gravar o cadastro
  let written: Set<string> | null;          // null = registro novo (tudo gravado)
  let outcome: SyncEvent['outcome'];
  let note: string | undefined;
  let localId: string | undefined;

  if (item.local_id) {
    const local = await must<any>(
      ctx.db.from('vet_equines').select(EQUINE_COLUMNS).eq('id', item.local_id).maybeSingle(),
    );
    if (!local) return skipped('registro removido no EquiCore');
    const filled = fillBlanks(local, fichaToColumns(ficha));
    if (Object.keys(filled).length) {
      await must(ctx.db.from('vet_equines').update(filled).eq('id', local.id));
    }
    equine = { ...local, ...filled };
    written = new Set(Object.keys(filled));
    outcome = written.size ? 'updated' : 'unchanged';
  } else {
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
      return skipped('proprietário sem CPF/CNPJ no portal');
    }

    const sameOwner = await must<any[]>(
      ctx.db.from('vet_equines').select(EQUINE_COLUMNS)
        .eq('vet_id', ctx.vetId).eq('owner_id', ownerId).is('sgq_code', null),
    );
    const manual = sameOwner.find(e => normalizeKey(e.name) === normalizeKey(ficha.name));

    if (manual) {
      const filled = fillBlanks(manual, fichaToColumns(ficha));
      await must(
        ctx.db.from('vet_equines')
          .update({ ...filled, sgq_code: item.sgq_code }).eq('id', manual.id),
      );
      stats.animals.matched++;
      equine = { ...manual, ...filled };
      written = new Set(Object.keys(filled));
      outcome = 'updated';
      note = 'vinculado a um animal que já estava cadastrado';
    } else {
      const id = randomUUID();
      await must(ctx.db.from('vet_equines').insert({
        id, vet_id: ctx.vetId, owner_id: ownerId, name: ficha.name,
        ...fichaToColumns(ficha), sgq_code: item.sgq_code,
      }));
      stats.animals.created++;
      equine = { id, resenha_url: null, portal_photo_url: null };
      written = null;
      outcome = 'created';
    }
    localId = equine.id;
  }

  mark(ctx, 'gravando exames, histórico e imagens da ficha');
  const extras = await syncFichaExtras(ctx, equine, ficha, stats);
  if (outcome === 'unchanged' && extras.some(c => c.written)) outcome = 'updated';

  // Só marca a ficha como importada depois de tudo gravado: se algo falhar no
  // meio, a próxima sincronização tenta este animal de novo.
  await must(ctx.db.from('vet_equines').update({ sgq_synced_at: new Date().toISOString() }).eq('id', equine.id));

  return {
    status: 'done', localId,
    event: { scope: 'animal', title: ficha.name, outcome, note, changes: [...fichaChanges(ficha, written), ...extras] },
  };
}

async function syncOwnerDetail(ctx: SyncContext, item: any): Promise<ItemResult> {
  const detail = parseOwnerDetail(await fetchPage(ctx, `proprietario_editar.php?cod_pro=${item.sgq_code}`));
  if (!detail) throw new Error('cadastro do proprietário em formato inesperado');

  const local = await must<any>(
    ctx.db.from('vet_owners')
      .select('id, name, address, district, cep, producer_number')
      .eq('id', item.local_id).maybeSingle(),
  );
  if (!local) {
    const note = 'registro removido no EquiCore';
    return { status: 'skipped', note, event: { scope: 'owner', title: item.label ?? 'Proprietário', outcome: 'skipped', note, changes: [] } };
  }

  const patch = fillBlanks(local, {
    address: detail.address, district: detail.district, cep: detail.cep, producer_number: detail.producerNumber,
  });
  if (Object.keys(patch).length) {
    await must(ctx.db.from('vet_owners').update(patch).eq('id', local.id));
  }
  const w = (column: string) => column in patch;
  const changes = compact([
    change('Endereço',       detail.address,        detail.address,        w('address')),
    change('Bairro',         detail.district,       detail.district,       w('district')),
    change('CEP',            detail.cep,            detail.cep,            w('cep')),
    change('Nº do Produtor', detail.producerNumber, detail.producerNumber, w('producer_number')),
  ]);
  return {
    status: 'done',
    event: {
      scope: 'owner', title: local.name,
      outcome: Object.keys(patch).length ? 'updated' : 'unchanged',
      note: changes.length ? undefined : 'sem endereço cadastrado no portal',
      changes,
    },
  };
}

async function syncPropertyDetail(ctx: SyncContext, item: any): Promise<ItemResult> {
  const detail = parsePropertyDetail(await fetchPage(ctx, `propriedade_editar.php?cod_propriedade=${item.sgq_code}`));
  if (!detail) throw new Error('cadastro da propriedade em formato inesperado');

  const local = await must<any>(
    ctx.db.from('vet_properties')
      .select('id, name, address, oesa_code, animal_count')
      .eq('id', item.local_id).maybeSingle(),
  );
  if (!local) {
    const note = 'registro removido no EquiCore';
    return { status: 'skipped', note, event: { scope: 'property', title: item.label ?? 'Propriedade', outcome: 'skipped', note, changes: [] } };
  }

  const patch = fillBlanks(local, {
    address: detail.address, oesa_code: detail.oesaCode, animal_count: detail.animalCount,
  });
  if (Object.keys(patch).length) {
    await must(ctx.db.from('vet_properties').update(patch).eq('id', local.id));
  }
  const w = (column: string) => column in patch;
  const count = detail.animalCount !== null ? String(detail.animalCount) : null;
  const changes = compact([
    change('Endereço',            detail.address,  detail.address,  w('address')),
    change('Nº Cadastro OESA',    detail.oesaCode, detail.oesaCode, w('oesa_code')),
    change('Quantidade de animais', count,         count,           w('animal_count')),
  ]);
  return {
    status: 'done',
    event: {
      scope: 'property', title: local.name,
      outcome: Object.keys(patch).length ? 'updated' : 'unchanged',
      note: changes.length ? undefined : 'sem endereço cadastrado no portal',
      changes,
    },
  };
}

/**
 * O portal não guarda a propriedade na ficha do animal; ela aparece na
 * requisição de exame. Usa a requisição mais recente de cada animal.
 */
async function syncRequisitionLink(ctx: SyncContext, item: any, stats: SyncStats): Promise<ItemResult> {
  const [type, code] = String(item.sgq_code).split(':');
  if (!(EXAM_TYPES as readonly string[]).includes(type) || !/^\d+$/.test(code)) {
    throw new Error('requisição inválida');
  }
  const prop = parseRequisitionProperty(await fetchPage(ctx, `requisicao_${type}_editar.php?cod_requisicoes=${code}`));
  if (!prop) throw new Error('requisição em formato inesperado');

  const equine = await must<any>(
    ctx.db.from('vet_equines').select('id, name, property_id').eq('id', item.local_id).maybeSingle(),
  );
  const title = equine?.name ?? 'Animal';
  const skipped = (note: string): ItemResult =>
    ({ status: 'skipped', note, event: { scope: 'link', title, outcome: 'skipped', note, changes: [] } });

  if (!equine) return skipped('registro removido no EquiCore');
  if (equine.property_id) return skipped('animal já tem propriedade no EquiCore');
  if (!prop.name) return skipped('requisição sem propriedade informada');

  const properties = await fetchAll(() =>
    ctx.db.from('vet_properties').select('id, name, city').eq('vet_id', ctx.vetId).order('id'),
  );
  let matches = properties.filter(p => normalizeKey(p.name) === normalizeKey(prop.name));
  if (matches.length > 1 && prop.city) {
    matches = matches.filter(p => normalizeKey(p.city) === normalizeKey(prop.city));
  }
  if (matches.length !== 1) {
    return skipped(matches.length ? `mais de uma propriedade chamada "${prop.name}"` : `propriedade "${prop.name}" não está no EquiCore`);
  }

  await must(ctx.db.from('vet_equines').update({ property_id: matches[0].id }).eq('id', equine.id));
  stats.links.linked++;
  return {
    status: 'done',
    event: {
      scope: 'link', title, outcome: 'updated',
      changes: [{ field: 'Propriedade', from: `${prop.name} (última requisição)`, to: matches[0].name, written: true }],
    },
  };
}

/** Enfileira, uma única vez por job, a requisição mais recente de cada animal sem propriedade. */
async function queueRequisitionLinks(ctx: SyncContext, jobId: string, stats: SyncStats): Promise<SyncEvent | null> {
  stats.links.queued = true;

  const [equines, exams] = await Promise.all([
    fetchAll(() =>
      ctx.db.from('vet_equines').select('id')
        .eq('vet_id', ctx.vetId).is('property_id', null).not('sgq_code', 'is', null).order('id'),
    ),
    fetchAll(() =>
      ctx.db.from('vet_equine_exams').select('equine_id, exam_type, sgq_code, collection_date')
        .eq('vet_id', ctx.vetId).not('equine_id', 'is', null).not('sgq_code', 'is', null)
        .order('collection_date', { ascending: false, nullsFirst: false }).order('id'),
    ),
  ]);

  const pending = new Set<string>(equines.map(e => e.id));
  const items: any[] = [];
  for (const exam of exams) {
    if (!pending.has(exam.equine_id)) continue;
    pending.delete(exam.equine_id);                       // primeira = mais recente
    items.push({
      job_id: jobId, kind: 'requisition', sgq_code: `${exam.exam_type}:${exam.sgq_code}`,
      local_id: exam.equine_id, status: 'pending',
    });
  }
  if (!items.length) return null;

  await insertChunks(ctx.admin, 'sgq_sync_items', items, 500);
  stats.links.total = items.length;
  stats.details.total += items.length;
  return {
    scope: 'link',
    title: 'Propriedade de cada animal',
    outcome: 'unchanged',
    note: `${items.length} animais sem propriedade: lendo a requisição mais recente de cada um`,
    changes: [],
  };
}

/** Processa o próximo item pendente. Devolve null quando a fila acabou. */
async function syncNextDetail(ctx: SyncContext, jobId: string, stats: SyncStats): Promise<SyncEvent | null> {
  // Ordem alfabética do tipo: animal → owner → property → requisition
  const item = await must<any>(
    ctx.admin.from('sgq_sync_items').select('*')
      .eq('job_id', jobId).eq('status', 'pending')
      .order('kind').order('id').limit(1).maybeSingle(),
  );
  if (!item) {
    // Fila vazia: falta só descobrir a propriedade dos animais (depende dos exames já ligados)
    return stats.links.queued ? null : queueRequisitionLinks(ctx, jobId, stats);
  }

  let update: Record<string, unknown>;
  let event: SyncEvent;
  try {
    const result =
      item.kind === 'animal'      ? await syncAnimalDetail(ctx, jobId, item, stats)
      : item.kind === 'owner'     ? await syncOwnerDetail(ctx, item)
      : item.kind === 'property'  ? await syncPropertyDetail(ctx, item)
      :                             await syncRequisitionLink(ctx, item, stats);
    update = { status: result.status, note: result.note ?? null, ...(result.localId ? { local_id: result.localId } : {}) };
    event = result.event;
    stats.consecutiveErrors = 0;
  } catch (err) {
    // Login recusado ou portal bloqueando: interrompe o job inteiro
    if (err instanceof SgqAuthError || err instanceof SgqBlockedError) throw err;
    console.error('[sgq/sync] item', item.kind, item.sgq_code, err);
    const note = err instanceof Error ? err.message.slice(0, 200) : 'erro';
    update = { status: 'error', note };
    const scope: SyncEvent['scope'] = item.kind === 'requisition' ? 'link' : item.kind;
    // label é o nome normalizado (minúsculo, sem acento); em caixa alta fica igual aos demais
    event = { scope, title: String(item.label ?? item.sgq_code).toUpperCase(), outcome: 'error', note, changes: [] };
    stats.details.errors++;
    stats.consecutiveErrors++;
  }

  await must(ctx.admin.from('sgq_sync_items').update(update).eq('id', item.id));
  stats.details.done++;

  if (stats.consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
    throw new Error('Muitas falhas seguidas ao ler o portal.');
  }
  return event;
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
  if (err instanceof TickTimeout) return err.message;
  if (err instanceof Error && /portal/i.test(err.message)) return err.message;
  // Erros do banco chegam como objeto { code, message } — o detalhe poupa uma ida aos logs
  const e = err as { code?: unknown; message?: unknown } | null;
  const detail = [e?.code, e?.message].filter(v => typeof v === 'string' && v).join(': ').slice(0, 160);
  return `Falha inesperada na sincronização.${detail ? ` Detalhe: ${detail}` : ''}`;
}

/** Executa um passo de um job já reservado por claimTick(). */
export async function runTick(ctx: SyncContext, job: any): Promise<{ job: JobView; event: SyncEvent | null; ms: number }> {
  const startedAt = Date.now();
  const stats = withDefaults(job.stats);
  let update: Record<string, unknown>;
  let event: SyncEvent | null = null;

  try {
    const { phase, event: stepEvent } = await withBudget(ctx, () => runPhase(ctx, job, stats));
    event = stepEvent;

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
      console.error('[sgq/sync] job', job.id, job.phase, ctx.trace, err);
    }
    update = { stats, status: 'error', error: errorMessage(err), finished_at: new Date().toISOString() };
  }

  // Só grava se o job continua em andamento (pode ter sido cancelado durante o passo)
  const saved = await must<any>(
    ctx.admin.from('sgq_sync_jobs').update(update)
      .eq('id', job.id).eq('status', 'running').select().maybeSingle(),
  );
  const ms = Date.now() - startedAt;
  if (saved) return { job: jobView(saved), event, ms };
  const current = await must<any>(ctx.admin.from('sgq_sync_jobs').select().eq('id', job.id).single());
  return { job: jobView(current), event, ms };
}

/**
 * Interrompe a espera por um passo que passou do tempo. O trabalho em curso não
 * pode ser cancelado, mas tudo o que ele grava é idempotente, então repetir o
 * passo depois não duplica nada.
 */
async function withBudget<T>(ctx: SyncContext, work: () => Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new TickTimeout(
        `Um passo levou mais de ${TICK_BUDGET_MS / 1000} s e foi interrompido — estava ${ctx.trace ?? 'iniciando'}. ` +
        'Nada foi perdido: sincronize de novo para continuar do mesmo ponto.',
      ));
    }, TICK_BUDGET_MS);
  });
  try {
    return await Promise.race([work(), timeout]);
  } finally {
    clearTimeout(timer);
  }
}

/** Uma etapa da sincronização; devolve a fase em que o job fica depois dela. */
async function runPhase(ctx: SyncContext, job: any, stats: SyncStats): Promise<{ phase: JobView['phase']; event: SyncEvent | null }> {
  let event: SyncEvent | null = null;
  let phase: JobView['phase'] = job.phase;

  if (phase === 'owners') {
    // Recomeço limpo caso um passo anterior tenha caído no meio
    await must(ctx.admin.from('sgq_sync_items').delete().eq('job_id', job.id));
    event = await syncOwners(ctx, job.id, stats);
    phase = 'properties';
  } else if (phase === 'properties') {
    await must(ctx.admin.from('sgq_sync_items').delete().eq('job_id', job.id).eq('kind', 'property'));
    event = await syncProperties(ctx, job.id, stats);
    phase = 'animals';
  } else if (phase === 'animals') {
    await must(ctx.admin.from('sgq_sync_items').delete().eq('job_id', job.id).eq('kind', 'animal'));
    event = await syncAnimals(ctx, job.id, stats);
    phase = 'exams';
  } else if (phase === 'exams') {
    event = await syncExams(ctx, stats);
    if (stats.exams.cursor >= EXAM_TYPES.length) phase = 'details';
  } else if (phase === 'details') {
    event = await syncNextDetail(ctx, job.id, stats);
    if (!event) phase = 'done';
  }

  return { phase, event };
}
