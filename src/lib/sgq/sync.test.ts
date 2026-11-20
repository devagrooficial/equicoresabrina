import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Sincronização de ponta a ponta com o portal simulado (páginas fictícias com a
// mesma estrutura do portal) e um banco em memória no lugar do Supabase.

const pages = new Map<string, string>();
const requested: string[] = [];
/** Páginas que o portal simulado nunca responde */
const hanging = new Set<string>();

vi.mock('./client', () => {
  class SgqAuthError extends Error {}
  class SgqBlockedError extends Error {}
  return {
    SgqAuthError,
    SgqBlockedError,
    sleep: async () => {},
    sgqLogin: async () => 'PHPSESSID=teste',
    sgqGet: async (_cookie: string, page: string) => {
      requested.push(page);
      if (hanging.has(page)) return new Promise(() => {});
      const html = pages.get(page);
      if (html === undefined) throw new Error(`página não simulada: ${page}`);
      return { html, loggedIn: true };
    },
    sgqGetUpload: async (src: string) => {
      requested.push(src);
      return { bytes: new Uint8Array([1, 2, 3]), contentType: 'image/png', ext: 'png' };
    },
  };
});

vi.mock('./crypto', () => ({
  encryptSecret: (v: string) => `enc:${v}`,
  decryptSecret: (v: string) => v.replace(/^enc:/, ''),
}));

import { emptyStats, runTick, type JobView } from './sync';

// ─── Banco em memória (subconjunto do cliente Supabase usado pela sincronização) ──

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>;

class FakeDb {
  tables = new Map<string, Row[]>();
  files = new Map<string, Uint8Array>();
  private seq = 0;

  rows(table: string): Row[] {
    if (!this.tables.has(table)) this.tables.set(table, []);
    return this.tables.get(table)!;
  }

  from(table: string) {
    return new Query(this, table);
  }

  nextId() {
    return `00000000-0000-4000-8000-${String(++this.seq).padStart(12, '0')}`;
  }

  storage = {
    from: (_bucket: string) => ({
      upload: async (path: string, bytes: Uint8Array) => {
        this.files.set(path, bytes);
        return { data: { path }, error: null };
      },
    }),
  };
}

class Query {
  private op: 'select' | 'insert' | 'update' | 'upsert' | 'delete' = 'select';
  private payload: any;
  private filters: ((r: Row) => boolean)[] = [];
  private orders: { col: string; asc: boolean }[] = [];
  private window: [number, number] | null = null;
  private one = false;
  private head = false;
  private conflict: string[] = [];

  constructor(private db: FakeDb, private table: string) {}

  select(_cols?: string, opts?: { head?: boolean }) { if (opts?.head) this.head = true; return this; }
  insert(rows: Row | Row[]) { this.op = 'insert'; this.payload = Array.isArray(rows) ? rows : [rows]; return this; }
  update(patch: Row) { this.op = 'update'; this.payload = patch; return this; }
  upsert(rows: Row[], opts: { onConflict: string }) { this.op = 'upsert'; this.payload = rows; this.conflict = opts.onConflict.split(','); return this; }
  delete() { this.op = 'delete'; return this; }
  eq(col: string, value: any) { this.filters.push(r => r[col] === value); return this; }
  is(col: string, _value: null) { this.filters.push(r => r[col] == null); return this; }
  not(col: string, _op: string, _value: null) { this.filters.push(r => r[col] != null); return this; }
  in(col: string, values: any[]) { this.filters.push(r => values.includes(r[col])); return this; }
  order(col: string, opts?: { ascending?: boolean }) { this.orders.push({ col, asc: opts?.ascending !== false }); return this; }
  limit(n: number) { this.window = [0, n - 1]; return this; }
  range(from: number, to: number) { this.window = [from, to]; return this; }
  maybeSingle() { this.one = true; return this; }
  single() { this.one = true; return this; }

  private run(): { data: any; error: any; count?: number } {
    const all = this.db.rows(this.table);
    const match = (r: Row) => this.filters.every(f => f(r));
    let result: Row[];

    if (this.op === 'insert' || this.op === 'upsert') {
      result = [];
      for (const raw of this.payload as Row[]) {
        if (this.op === 'upsert' && all.some(r => this.conflict.every(c => r[c] === raw[c]))) continue;
        const row = { id: raw.id ?? this.db.nextId(), ...raw };
        all.push(row);
        result.push(row);
      }
    } else if (this.op === 'update') {
      result = all.filter(match);
      result.forEach(r => Object.assign(r, this.payload));
    } else if (this.op === 'delete') {
      result = all.filter(match);
      this.db.tables.set(this.table, all.filter(r => !match(r)));
    } else {
      result = all.filter(match);
      for (const { col, asc } of [...this.orders].reverse()) {
        result = [...result].sort((a, b) => {
          const [x, y] = [a[col], b[col]];
          if (x == null && y == null) return 0;
          if (x == null) return 1;
          if (y == null) return -1;
          return (x < y ? -1 : x > y ? 1 : 0) * (asc ? 1 : -1);
        });
      }
      if (this.head) return { data: null, error: null, count: result.length };
      if (this.window) result = result.slice(this.window[0], this.window[1] + 1);
    }

    if (this.one) return { data: result[0] ?? null, error: null };
    return { data: result, error: null };
  }

  // Thenable, como o construtor de consultas do Supabase: `await query` executa
  then(ok: (v: { data: any; error: any; count?: number }) => unknown, fail?: (e: unknown) => unknown) {
    return Promise.resolve().then(() => this.run()).then(ok, fail);
  }
}

// ─── Portal simulado ─────────────────────────────────────────────────────────

const page = (body: string) => `<html><body><a href="../../logout.php">Sair</a>${body}</body></html>`;
const cell = (v: string) => `<td><font>${v}</font></td>`;
const editLink = (code: string) => `<td><a href="#" onclick="editar('${code}')"><span>Editar</span></a></td>`;

function setupPortal() {
  pages.clear();
  hanging.clear();
  requested.length = 0;

  pages.set('proprietario_lista.php', page(`<table id="example"><thead><tr><th></th><th>Proprietário</th><th>CPF/CNPJ</th><th>Cidade - UF</th><th>Telefone</th><th>E-mail</th></tr></thead><tbody>
    <tr>${editLink('10')}${cell('ANA PAULA')}${cell('52998224725')}${cell('CAMPO GRANDE - MS')}${cell('67999990000')}${cell('ana@exemplo.com')}</tr>
    <tr>${editLink('11')}${cell('BRUNO LIMA')}${cell('11222333000181')}${cell('CUIABÁ - MT')}${cell('')}${cell('')}</tr>
    <tr>${editLink('12')}${cell('CARLOS SEM CPF')}${cell('')}${cell('')}${cell('')}${cell('')}</tr>
  </tbody></table>`));

  pages.set('propriedade_lista.php', page(`<table id="example"><thead><tr><th></th><th>Nome da Propriedade</th><th>Municipio - UF</th><th>Classificação</th></tr></thead><tbody>
    <tr>${editLink('20')}${cell('HARAS DO SOL')}${cell('CAMPO GRANDE - MS')}${cell('H')}</tr>
    <tr>${editLink('21')}${cell('RANCHO LUA')}${cell('CUIABÁ - MT')}${cell('JC')}</tr>
  </tbody></table>`));

  const animalRow = (code: string, name: string, owner: string) =>
    `<tr><td><a href="animal_ficha.php?cod_animal=${code}">Ver ficha</a></td><td><span>#${code}</span></td><td>${name}</td><td>${owner}</td><td>SRD</td><td><span>MACHO</span></td></tr>`;
  pages.set('animal_lista.php', page(`<table id="example"><thead><tr><th>Ações</th><th>Código Animal</th><th>Nome Animal</th><th>Nome Proprietário</th><th>Raça</th><th>Sexo</th></tr></thead><tbody>
    ${animalRow('100', 'TROVÃO', 'ANA PAULA')}
    ${animalRow('101', 'ESTRELA', 'BRUNO LIMA')}
    ${animalRow('102', 'ÓRFÃO', 'CARLOS SEM CPF')}
  </tbody></table>`));

  const examTable = (rows: string) =>
    page(`<table><thead><tr><th></th><th>Laudo</th><th>Requisição</th><th>Proprietário</th><th>Animal</th><th>Colheita</th><th>Laboratório</th></tr></thead><tbody>${rows}</tbody></table>`);
  const examRow = (code: string, number: string, owner: string, animal: string, date: string, laudo: string) =>
    `<tr><td><a href="#" onclick="laudo('${code}')">l</a></td>${cell(`<span>${laudo}</span>`)}${cell(number)}${cell(owner)}${cell(animal)}${cell(date)}${cell('LAB TESTE')}</tr>`;
  pages.set('requisicao_aieidga_lista.php', examTable(
    examRow('900', 'PCR900', 'ANA PAULA', 'TROVÃO', '2026-08-01', 'Disponivel')
    + examRow('901', 'PCR901', 'ANA PAULA', 'TROVÃO', '2026-10-01', '')
    + examRow('902', 'PCR902', 'BRUNO LIMA', 'ESTRELA', '2026-09-15', 'Disponivel'),
  ));
  pages.set('requisicao_aieelisa_lista.php', examTable(''));
  pages.set('requisicao_mormoelisa_lista.php', examTable(examRow('950', 'PCR950', 'ANA PAULA', 'TROVÃO', '2026-07-01', 'Disponivel')));

  const ficha = (opts: { name: string; owner: string; chip: string; exams: string; extra?: string }) => page(`<form>
    <input type="text" name="nome_animal" value="${opts.name}">
    <select name="cod_prop"><option value="${opts.owner}" selected>x</option></select>
    <input type="text" name="registro" value=""><input type="text" name="chip" value="${opts.chip}">
    <select name="cod_especie"><option value="EQUINA" selected>EQUINA</option></select>
    <select name="cod_raca"><option value="SRD" selected>SRD</option></select>
    <select name="cod_pelagem"><option value="CASTANHO" selected>CASTANHO</option></select>
    <select name="sexo"><option value="MACHO" selected>MACHO</option></select>
    <input type="text" name="data_nascimento" value="01/01/2018"><input type="text" name="idade" value="8 anos">
    <textarea name="descricao_sinais"></textarea></form>
    <table><thead><tr><th>Requisição</th><th>Tipo</th><th>Data da requisição</th><th>Data da colheita</th><th>Laudo</th></tr></thead><tbody>${opts.exams}</tbody></table>
    ${opts.extra ?? ''}`);
  const fichaExam = (number: string, type: string, date: string) =>
    `<tr><td>${number}</td><td>${type}</td><td>${date} 09:00</td><td>${date}</td><td><span>Disponível</span></td></tr>`;

  pages.set('animal_ficha.php?cod_animal=100', ficha({
    name: 'TROVÃO', owner: '10', chip: '982000123',
    exams: fichaExam('PCR900', 'AIE (IDGA)', '01/08/2026') + fichaExam('PCR901', 'AIE (IDGA)', '01/10/2026') + fichaExam('PCR950', 'MORMO (ELISA)', '01/07/2026'),
    extra: `<div class="resenho-visualizacao"><img class="resenho-imagem" src="uploads/res100.png"></div>
      <table><thead><tr><th>Aplicação</th><th>Vacina</th><th>Produto</th><th>Próxima</th><th>Situação</th><th></th></tr></thead><tbody>
      <tr><td>10/01/2026</td><td>Raiva</td><td>Rabmune</td><td>10/01/2027</td><td>Em dia</td><td></td></tr></tbody></table>`,
  }));
  pages.set('animal_ficha.php?cod_animal=101', ficha({
    name: 'ESTRELA', owner: '11', chip: '', exams: fichaExam('PCR902', 'AIE (IDGA)', '15/09/2026'),
  }));
  pages.set('animal_ficha.php?cod_animal=102', ficha({
    name: 'ÓRFÃO', owner: '12', chip: '', exams: '<tr><td colspan="5">Nenhum exame vinculado a este animal.</td></tr>',
  }));

  for (const code of ['10', '11']) {
    pages.set(`proprietario_editar.php?cod_pro=${code}`, page(`<form><input name="cpf" value="1"><input name="endereco" value="RUA ${code}"><input name="bairro" value="CENTRO"><input name="cep" value="79000000"><input name="numero_produtor" value=""></form>`));
  }
  for (const code of ['20', '21']) {
    pages.set(`propriedade_editar.php?cod_propriedade=${code}`, page(`<form><input name="nome_propriedade" value="X"><input name="endereco_propriedade" value="ESTRADA ${code}"><input name="cadastro_oesa" value="77${code}"><input name="animais_propriedade" value="12"></form>`));
  }

  const requisition = (property: string, city: string, uf: string) =>
    page(`<form><input name="nome_do_animal" value="x"><input name="nome_da_propriedade" value="${property}"><input name="municipio" value="${city}"><input name="uf_propriedade" value="${uf}"></form>`);
  // TROVÃO: a requisição mais recente é a PCR901 (aieidga:901); ESTRELA: aieidga:902
  pages.set('requisicao_aieidga_editar.php?cod_requisicoes=901', requisition('HARAS DO SOL', 'CAMPO GRANDE', 'MS'));
  pages.set('requisicao_aieidga_editar.php?cod_requisicoes=902', requisition('FAZENDA DESCONHECIDA', 'CUIABÁ', 'MT'));
}

// ─── Execução ────────────────────────────────────────────────────────────────

const VET = 'vet-1';

async function runJob(db: FakeDb, full = false): Promise<JobView> {
  db.rows('sgq_sync_jobs').push({
    id: db.nextId(), vet_id: VET, status: 'running', phase: 'owners', stats: emptyStats(full),
    started_at: new Date().toISOString(), finished_at: null, error: null,
  });
  const job = db.rows('sgq_sync_jobs').at(-1)!;
  const ctx = { admin: db, db, vetId: VET };
  let view!: JobView;
  for (let i = 0; i < 100 && job.status === 'running'; i++) {
    view = (await runTick(ctx, { ...job })).job;
  }
  return view;
}

describe('sincronização completa com o portal simulado', () => {
  let db: FakeDb;

  beforeEach(() => {
    setupPortal();
    db = new FakeDb();
    db.rows('vet_integrations').push({ vet_id: VET, provider: 'sgq', username: 'u', secret_enc: 'enc:s', session_enc: 'enc:c=1' });
  });

  it('importa cadastros, exames, histórico, resenho e propriedade', async () => {
    const job = await runJob(db);
    expect(job.error).toBeNull();
    expect(job.status).toBe('done');

    // Proprietários: o sem CPF fica de fora; endereço vem do detalhe
    const owners = db.rows('vet_owners');
    expect(owners.map(o => o.name).sort()).toEqual(['ANA PAULA', 'BRUNO LIMA']);
    expect(owners.find(o => o.name === 'ANA PAULA')).toMatchObject({
      cpf_cnpj: '52998224725', city: 'Campo Grande', uf: 'MS', phone: '(67) 99999-0000',
      address: 'RUA 10', district: 'CENTRO', cep: '79000-000',
    });

    // Propriedades: classificação mapeada e detalhe preenchido
    expect(db.rows('vet_properties').map(p => [p.name, p.classification, p.address, p.oesa_code, p.animal_count])).toEqual([
      ['HARAS DO SOL', 'Haras', 'ESTRADA 20', '7720', 12],
      ['RANCHO LUA', 'Jockey Club', 'ESTRADA 21', '7721', 12],
    ]);

    // Animais: o do proprietário sem CPF não entra
    const equines = db.rows('vet_equines');
    expect(equines.map(e => e.name).sort()).toEqual(['ESTRELA', 'TROVÃO']);
    const trovao = equines.find(e => e.name === 'TROVÃO')!;
    const estrela = equines.find(e => e.name === 'ESTRELA')!;
    const ana = owners.find(o => o.name === 'ANA PAULA')!;
    expect(trovao).toMatchObject({
      owner_id: ana.id, sgq_code: '100', chip: '982000123', species: 'Equina', coat: 'Castanha',
      breed: 'Sem Raça Definida (SRD)', sex: 'Macho', birth_date: '2018-01-01',
      resenha_url: `${VET}/equinos/${trovao.id}/resenha-importada.png`,
    });
    expect(trovao.sgq_synced_at).toBeTruthy();
    expect(db.files.has(trovao.resenha_url)).toBe(true);

    // Exames: 4 requisições, todas ligadas ao animal certo, com dados das duas fontes
    const exams = db.rows('vet_equine_exams');
    expect(exams).toHaveLength(4);
    expect(exams.filter(e => e.equine_id === trovao.id).map(e => e.number).sort()).toEqual(['PCR900', 'PCR901', 'PCR950']);
    expect(exams.find(e => e.number === 'PCR950')).toMatchObject({
      exam_type: 'mormoelisa', sgq_code: '950', collection_date: '2026-07-01', requested_date: '2026-07-01',
      laboratory: 'LAB TESTE', laudo_available: true, equine_id: trovao.id,
    });
    // PCR901 estava sem laudo na lista e aparece como disponível na ficha
    expect(exams.find(e => e.number === 'PCR901')!.laudo_available).toBe(true);

    // Histórico de saúde
    expect(db.rows('vet_equine_health_records')).toMatchObject([
      { equine_id: trovao.id, kind: 'vacina', event_date: '2026-01-10', title: 'Raiva', data: { Vacina: 'Raiva', Produto: 'Rabmune' } },
    ]);

    // Propriedade pelo exame mais recente; a desconhecida não é inventada
    const haras = db.rows('vet_properties').find(p => p.name === 'HARAS DO SOL')!;
    expect(trovao.property_id).toBe(haras.id);
    expect(estrela.property_id ?? null).toBeNull();
    expect(requested).toContain('requisicao_aieidga_editar.php?cod_requisicoes=901');
    expect(requested).not.toContain('requisicao_aieidga_editar.php?cod_requisicoes=900');

    expect(job.stats).toMatchObject({
      owners: { found: 3, created: 2, noCpf: 1 },
      properties: { found: 2, created: 2 },
      animals: { found: 3, created: 2, skipped: 1 },
      exams: { found: 4, created: 4, linked: 4 },
      health: { records: 1 },
      files: { resenhos: 1, photos: 0 },
      links: { total: 2, linked: 1 },
    });
    expect(job.stats.details.errors).toBe(0);
    expect(job.stats.details.done).toBe(job.stats.details.total);
  });

  it('sincronizar de novo não duplica nem relê fichas já importadas', async () => {
    await runJob(db);
    const counts = () => ['vet_owners', 'vet_properties', 'vet_equines', 'vet_equine_exams', 'vet_equine_health_records']
      .map(t => db.rows(t).length);
    const before = counts();
    requested.length = 0;

    const job = await runJob(db);
    expect(job.status).toBe('done');
    expect(counts()).toEqual(before);
    expect(job.stats).toMatchObject({ owners: { created: 0, matched: 2 }, properties: { created: 0 }, animals: { created: 0 }, exams: { created: 0 } });
    // Só o animal que ficou de fora (dono sem CPF) é tentado de novo; nenhuma imagem é baixada outra vez
    expect(requested.filter(p => p.startsWith('animal_ficha.php'))).toEqual(['animal_ficha.php?cod_animal=102']);
    expect(requested.filter(p => p.startsWith('uploads/'))).toEqual([]);
  });

  it('com "reler fichas", pega registros novos de animais já importados', async () => {
    await runJob(db);
    pages.set('animal_ficha.php?cod_animal=101', pages.get('animal_ficha.php?cod_animal=101')!.replace('</body>',
      `<table><thead><tr><th>Data</th><th>Peso</th><th>Variação</th><th>ECC</th><th>Método</th><th>CRMV</th><th></th></tr></thead><tbody>
       <tr><td>05/11/2026</td><td>430 kg</td><td>-</td><td>5</td><td>Fita</td><td>1</td><td></td></tr></tbody></table></body>`));
    requested.length = 0;

    const job = await runJob(db, true);
    expect(job.status).toBe('done');
    expect(requested).toContain('animal_ficha.php?cod_animal=101');
    expect(db.rows('vet_equine_health_records').map(r => r.kind).sort()).toEqual(['pesagem', 'vacina']);
    expect(db.rows('vet_equines')).toHaveLength(2);
  });

  it('preserva o que o veterinário já tinha digitado no EquiCore', async () => {
    db.rows('vet_owners').push({ id: 'own-a', vet_id: VET, name: 'Ana P.', cpf_cnpj: '52998224725', phone: '(67) 3333-0000', address: 'Av. Manual, 1' });
    db.rows('vet_equines').push({ id: 'eq-a', vet_id: VET, owner_id: 'own-a', name: 'Trovão', coat: 'Tordilha', chip: null });

    const job = await runJob(db);
    expect(job.status).toBe('done');
    expect(db.rows('vet_owners').find(o => o.id === 'own-a')).toMatchObject({ name: 'Ana P.', phone: '(67) 3333-0000', address: 'Av. Manual, 1', city: 'Campo Grande' });
    // Mesmo dono + mesmo nome: vincula em vez de duplicar, mantém a pelagem digitada e completa o chip
    expect(db.rows('vet_equines').filter(e => normalize(e.name) === 'trovao')).toHaveLength(1);
    expect(db.rows('vet_equines').find(e => e.id === 'eq-a')).toMatchObject({ coat: 'Tordilha', chip: '982000123', sgq_code: '100' });
  });
});

const normalize = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

describe('passo que não termina', () => {
  afterEach(() => vi.useRealTimers());

  it('é interrompido antes do limite da função e diz onde estava', async () => {
    setupPortal();
    const db = new FakeDb();
    db.rows('vet_integrations').push({ vet_id: VET, provider: 'sgq', username: 'u', secret_enc: 'enc:s', session_enc: 'enc:c=1' });
    db.rows('sgq_sync_jobs').push({
      id: 'job-1', vet_id: VET, status: 'running', phase: 'exams', stats: emptyStats(),
      started_at: new Date().toISOString(), finished_at: null, error: null,
    });
    hanging.add('requisicao_aieidga_lista.php');

    vi.useFakeTimers();
    const pending = runTick({ admin: db, db, vetId: VET }, { ...db.rows('sgq_sync_jobs')[0] });
    await vi.advanceTimersByTimeAsync(46_000);
    const { job } = await pending;

    expect(job.status).toBe('error');
    expect(job.error).toContain('mais de 45 s');
    expect(job.error).toContain('aguardando o portal SGQ responder requisicao_aieidga_lista.php');
    // Nada foi gravado pela metade
    expect(db.rows('vet_equine_exams')).toHaveLength(0);
  });
});

