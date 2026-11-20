// Leitura (somente leitura) das páginas do Portal Central de Requisições da SGQ.
// Funções puras: recebem o HTML e devolvem dados já normalizados para o EquiCore.

import { parse, type HTMLElement } from 'node-html-parser';
import { ESPECIES, RACAS, PELAGENS } from '../vetCatalogs';
import { ageFromBirthDate, maskCEP, maskPhone, onlyDigits, UF_LIST } from '../br';
import { EXAM_TYPES, type ExamType, type HealthKind } from './labels';

export { EXAM_LABEL, EXAM_TYPES, HEALTH_KINDS, HEALTH_LABEL, type ExamType, type HealthKind } from './labels';

// ─── HTML do portal ──────────────────────────────────────────────────────────

// Tags só de formatação. O portal as deixa abertas sem fechar (ex.: um <b> por
// linha nas listas de requisição). O navegador conserta sozinho; este parser
// não: ele aninha cada linha dentro da anterior, o que faz o tempo de leitura
// crescer de forma explosiva (704 linhas levavam minutos). Como não carregam
// dado nenhum, são removidas antes de montar a árvore.
const FORMATTING_TAGS = /<\/?(?:b|font|strong|em|u|center|small|big)(?:\s[^>]*)?>/gi;

function parseDoc(html: string): HTMLElement {
  return parse(html.replace(FORMATTING_TAGS, ''));
}

// ─── Texto ───────────────────────────────────────────────────────────────────

export function clean(value: string | null | undefined): string {
  return (value ?? '').replace(/\s+/g, ' ').trim();
}

/** Chave de comparação: sem acento, minúscula, espaços colapsados. */
export function normalizeKey(value: string | null | undefined): string {
  return clean(value).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

const PARTICLES = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'para', 'sobre']);

/** "SÃO GABRIEL DO OESTE" → "São Gabriel do Oeste" */
export function titleCasePt(value: string): string {
  return clean(value)
    .toLowerCase()
    .split(' ')
    .map((w, i) => (i > 0 && PARTICLES.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ');
}

/** Campo vazio no portal aparece em branco ou só com símbolos ("*****", "-"). */
function meaningful(value: string | null | undefined): string | null {
  const v = clean(value);
  return /[\p{L}\p{N}]/u.test(v) ? v : null;
}

// ─── Catálogos (portal → EquiCore) ───────────────────────────────────────────

function catalogIndex(list: readonly string[]): Map<string, string> {
  return new Map(list.map(item => [normalizeKey(item), item]));
}

const ESPECIES_IDX = catalogIndex(ESPECIES);
const RACAS_IDX    = catalogIndex(RACAS);
const PELAGENS_IDX = catalogIndex(PELAGENS);

export function mapSpecies(raw: string): string | null {
  const key = normalizeKey(raw);
  if (!key) return null;
  if (key === 'asinino') return 'Asinina';
  return ESPECIES_IDX.get(key) ?? titleCasePt(raw);
}

export function mapSex(raw: string): string | null {
  const key = normalizeKey(raw);
  if (key === 'macho') return 'Macho';
  if (key === 'femea') return 'Fêmea';
  if (key.includes('castrad')) return 'Macho Castrado';
  return null;
}

const BREED_ALIASES: Record<string, string> = {
  'srd':                      'Sem Raça Definida (SRD)',
  'sem raca definida':        'Sem Raça Definida (SRD)',
  'quarto de milha p.o.':     'Quarto de Milha',
  'qm':                       'Quarto de Milha',
  'crioula':                  'Crioulo',
  'manga larga':              'Mangalarga',
  'manga larga marchador':    'Mangalarga Marchador',
  'pant horse':               'Paint Horse',
  'ponei':                    'Pônei',
  'ponei brasileiro':         'Pônei',
  'arabe':                    'Árabe',
  'apaloosa':                 'Appaloosa',
  'lusitana':                 'Lusitano',
  'bretao':                   'Bretão',
  'psi':                      'Puro Sangue Inglês',
};

/** Raça do catálogo do EquiCore quando há equivalência; senão mantém o nome do portal. */
export function mapBreed(raw: string): string | null {
  const key = normalizeKey(raw);
  if (!key) return null;
  return RACAS_IDX.get(key) ?? BREED_ALIASES[key] ?? titleCasePt(raw);
}

/** Pelagem: o portal mistura masculino/feminino e grafias sem acento. */
export function mapCoat(raw: string): string | null {
  const key = normalizeKey(raw);
  if (!key) return null;
  const direct = PELAGENS_IDX.get(key);
  if (direct) return direct;
  // castanho → castanha, baio → baia, alazao → alaza (= "Alazã" sem acento)
  const feminine = key
    .split(' ')
    .map(w => (w.endsWith('ao') ? w.slice(0, -1) : w.endsWith('o') ? `${w.slice(0, -1)}a` : w))
    .join(' ');
  return PELAGENS_IDX.get(feminine) ?? titleCasePt(raw);
}

// Siglas de classificação de propriedade do portal → EquiCore.
// As que não têm equivalente no catálogo ficam com o nome por extenso.
const CLASSIFICATION: Record<string, string> = {
  h:     'Haras',
  fc:    'Fazenda',
  outro: 'Outro',
  cr:    'Cancha Reta',
  jc:    'Jockey Club',
  sh:    'Sociedade Hípica',
  um:    'Unidade Militar',
};

export function mapClassification(raw: string): string | null {
  return CLASSIFICATION[normalizeKey(raw)] ?? null;
}

/** "AIE (IDGA)" → 'aieidga' */
export function mapExamType(raw: string): ExamType | null {
  const key = normalizeKey(raw).replace(/[^a-z]/g, '');
  return (EXAM_TYPES as readonly string[]).includes(key) ? (key as ExamType) : null;
}

// ─── Utilitários de formato ──────────────────────────────────────────────────

/** "SÃO GABRIEL - RS" → { city: "São Gabriel", uf: "RS" } */
export function splitCityUf(raw: string): { city: string | null; uf: string | null } {
  const value = clean(raw);
  const idx = value.lastIndexOf(' - ');
  if (idx === -1) return { city: value ? titleCasePt(value) : null, uf: null };
  const uf = value.slice(idx + 3).toUpperCase();
  const city = value.slice(0, idx);
  return {
    city: city ? titleCasePt(city) : null,
    uf: (UF_LIST as readonly string[]).includes(uf) ? uf : null,
  };
}

/** "31/12/2016" → "2016-12-31" (null se inválida) */
export function brDateToIso(raw: string): string | null {
  const m = clean(raw).match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
  if (d.getFullYear() !== Number(yyyy) || d.getMonth() !== Number(mm) - 1 || d.getDate() !== Number(dd)) return null;
  if (Number(yyyy) < 1950 || d > new Date()) return null;
  return `${yyyy}-${mm}-${dd}`;
}

/** Data que pode vir como "31/12/2026", "31/12/2026 14:30" ou "2026-12-31"; aceita datas futuras. */
export function anyDateToIso(raw: string): string | null {
  const value = clean(raw);
  const br = value.match(/^(\d{2})\/(\d{2})\/(\d{4})\b/);
  const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})\b/);
  const [yyyy, mm, dd] = br ? [br[3], br[2], br[1]] : iso ? [iso[1], iso[2], iso[3]] : [];
  if (!yyyy) return null;
  const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
  if (d.getFullYear() !== Number(yyyy) || d.getMonth() !== Number(mm) - 1 || d.getDate() !== Number(dd)) return null;
  if (Number(yyyy) < 1950 || Number(yyyy) > 2100) return null;
  return `${yyyy}-${mm}-${dd}`;
}

function formatPhone(raw: string): string | null {
  const digits = onlyDigits(raw);
  if (digits.length === 10 || digits.length === 11) return maskPhone(digits);
  return meaningful(raw);
}

// ─── Sessão ──────────────────────────────────────────────────────────────────

/** Páginas da área logada sempre trazem o link de sair no menu. */
export function isLoggedInHtml(html: string): boolean {
  return html.includes('logout.php');
}

/** Tela de login do portal (é o que ele devolve quando a sessão caiu). */
export function isLoginHtml(html: string): boolean {
  return html.includes('validacao.php');
}

// ─── Listas ──────────────────────────────────────────────────────────────────

function listRows(html: string): HTMLElement[] | null {
  const table = parseDoc(html).querySelector('table#example');
  if (!table) return null;
  return table.querySelectorAll('tbody tr');
}

function cells(row: HTMLElement): HTMLElement[] {
  return row.querySelectorAll('td');
}

function codeFromOnclick(row: HTMLElement): string | null {
  const onclick = row.querySelector('[onclick]')?.getAttribute('onclick') ?? '';
  return onclick.match(/editar\('(\d+)'\)/)?.[1] ?? null;
}

export interface SgqOwnerRow {
  code: string;
  name: string;
  cpfCnpj: string;          // só dígitos; '' quando ausente
  city: string | null;
  uf: string | null;
  phone: string | null;
  email: string | null;
  /** Valores como aparecem no portal (para exibir o de-para) */
  raw: { cityUf: string; phone: string };
}

/** proprietario_lista.php — null quando a página não tem a tabela esperada. */
export function parseOwnerList(html: string): SgqOwnerRow[] | null {
  const rows = listRows(html);
  if (!rows) return null;
  const out: SgqOwnerRow[] = [];
  for (const row of rows) {
    const td = cells(row);
    const code = codeFromOnclick(row);
    if (!code || td.length < 6) continue;
    const name = clean(td[1].text);
    if (!name) continue;
    const email = clean(td[5].text).toLowerCase();
    out.push({
      code,
      name,
      cpfCnpj: onlyDigits(td[2].text),
      ...splitCityUf(td[3].text),
      phone: formatPhone(td[4].text),
      email: /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) ? email : null,
      raw: { cityUf: clean(td[3].text), phone: clean(td[4].text) },
    });
  }
  return out;
}

export interface SgqPropertyRow {
  code: string;
  name: string;
  city: string | null;
  uf: string | null;
  classification: string | null;
  raw: { cityUf: string; classification: string };
}

/** propriedade_lista.php */
export function parsePropertyList(html: string): SgqPropertyRow[] | null {
  const rows = listRows(html);
  if (!rows) return null;
  const out: SgqPropertyRow[] = [];
  for (const row of rows) {
    const td = cells(row);
    const code = codeFromOnclick(row);
    if (!code || td.length < 4) continue;
    const name = clean(td[1].text);
    if (!name) continue;
    out.push({
      code,
      name,
      ...splitCityUf(td[2].text),
      classification: mapClassification(td[3].text),
      raw: { cityUf: clean(td[2].text), classification: clean(td[3].text) },
    });
  }
  return out;
}

export interface SgqAnimalRow {
  code: string;
  name: string;
  ownerName: string;
  breed: string | null;
  sex: string | null;
  raw: { breed: string; sex: string };
}

/** animal_lista.php */
export function parseAnimalList(html: string): SgqAnimalRow[] | null {
  const rows = listRows(html);
  if (!rows) return null;
  const out: SgqAnimalRow[] = [];
  for (const row of rows) {
    const td = cells(row);
    const href = row.querySelector('a[href*="animal_ficha.php"]')?.getAttribute('href') ?? '';
    const code = href.match(/cod_animal=(\d+)/)?.[1];
    if (!code || td.length < 6) continue;
    const name = clean(td[2].text);
    if (!name) continue;
    out.push({
      code,
      name,
      ownerName: clean(td[3].text),
      breed: mapBreed(td[4].text),
      sex: mapSex(td[5].text),
      raw: { breed: clean(td[4].text), sex: clean(td[5].text) },
    });
  }
  return out;
}

// ─── Fichas ──────────────────────────────────────────────────────────────────

function inputValue(root: HTMLElement, name: string): string {
  const el = root.querySelector(`[name="${name}"]`);
  if (!el) return '';
  if (el.tagName === 'TEXTAREA') return clean(el.text);
  if (el.tagName === 'SELECT') {
    const selected = el.querySelectorAll('option').find(o => o.hasAttribute('selected'));
    return clean(selected?.getAttribute('value') ?? '');
  }
  return clean(el.getAttribute('value'));
}

export interface SgqAnimalFicha {
  name: string;
  ownerCode: string | null;
  registryBrand: string | null;
  chip: string | null;
  species: string | null;
  breed: string | null;
  coat: string | null;
  sex: string | null;
  birthDate: string | null;   // ISO
  ageYears: number | null;
  signsDesc: string | null;
  /** Valores como aparecem no portal (para exibir o de-para) */
  raw: { species: string; breed: string; coat: string; sex: string; birthDate: string; age: string };
  exams: SgqFichaExam[];
  health: SgqHealthRecord[];
  /** Caminhos relativos a /pages/forms/ (ex.: "uploads/abc.png") */
  resenhoSrc: string | null;
  photoSrc: string | null;
}

export interface SgqFichaExam {
  number: string;
  type: ExamType | null;
  typeLabel: string;
  requestedDate: string | null;    // ISO
  collectionDate: string | null;   // ISO
  laudoAvailable: boolean;
}

export interface SgqHealthRecord {
  kind: HealthKind;
  eventDate: string | null;        // ISO
  title: string | null;
  /** Colunas da tabela do portal, na ordem em que aparecem */
  data: Record<string, string>;
}

// Tabelas da ficha, reconhecidas pelo cabeçalho. `title` é a coluna que resume o registro.
const HEALTH_TABLES: { kind: HealthKind; headers: string[]; date: string; title: string }[] = [
  { kind: 'vacina',       headers: ['Aplicação', 'Vacina', 'Produto', 'Próxima', 'Situação'],  date: 'Aplicação', title: 'Vacina' },
  { kind: 'vermifugacao', headers: ['Aplicação', 'Produto', 'Dose', 'Próxima', 'Situação'],    date: 'Aplicação', title: 'Produto' },
  { kind: 'medicamento',  headers: ['Início', 'Medicamento', 'Dose', 'Fim', 'Situação'],        date: 'Início',    title: 'Medicamento' },
  { kind: 'pesagem',      headers: ['Data', 'Peso', 'Variação', 'ECC', 'Método', 'CRMV'],       date: 'Data',      title: 'Peso' },
  { kind: 'reproducao',   headers: ['Data', 'Evento', 'Reprodutor(a)', 'Método', 'Resultado', 'Data prevista', 'Filhotes', 'CRMV'], date: 'Data', title: 'Evento' },
  { kind: 'observacao',   headers: ['Data', 'Tipo', 'Título', 'Descrição', 'Retorno', 'CRMV'],  date: 'Data',      title: 'Título' },
];

function tableHeaders(table: HTMLElement): string[] {
  return table.querySelectorAll('thead th').map(th => clean(th.text));
}

/** Linhas de dados de uma tabela (ignora a linha "Nenhum registro", que usa colspan). */
function dataRows(table: HTMLElement): HTMLElement[][] {
  return table.querySelectorAll('tbody tr')
    .filter(tr => !tr.querySelector('td[colspan]'))
    .map(tr => tr.querySelectorAll('td'))
    .filter(td => td.length > 1);
}

function parseFichaExams(root: HTMLElement): SgqFichaExam[] {
  const table = root.querySelectorAll('table').find(t => {
    const h = tableHeaders(t);
    return h.includes('Requisição') && h.includes('Tipo') && h.includes('Data da colheita');
  });
  if (!table) return [];
  return dataRows(table).flatMap(td => {
    const number = clean(td[0].text);
    if (!number || td.length < 5) return [];
    const typeLabel = clean(td[1].text);
    return [{
      number,
      type: mapExamType(typeLabel),
      typeLabel,
      requestedDate: anyDateToIso(td[2].text),
      collectionDate: anyDateToIso(td[3].text),
      laudoAvailable: normalizeKey(td[4].text).startsWith('dispon'),
    }];
  });
}

function parseFichaHealth(root: HTMLElement): SgqHealthRecord[] {
  const out: SgqHealthRecord[] = [];
  for (const table of root.querySelectorAll('table')) {
    const headers = tableHeaders(table);
    const named = headers.filter(Boolean);
    const spec = HEALTH_TABLES.find(t => t.headers.length === named.length && t.headers.every((h, i) => h === named[i]));
    if (!spec) continue;
    for (const td of dataRows(table)) {
      const data: Record<string, string> = {};
      headers.forEach((h, i) => {
        const value = clean(td[i]?.text);
        if (h && value) data[h] = value;
      });
      if (!Object.keys(data).length) continue;
      out.push({
        kind: spec.kind,
        eventDate: anyDateToIso(data[spec.date] ?? ''),
        title: data[spec.title] ?? null,
        data,
      });
    }
  }
  return out;
}

/** Só aceita arquivos da pasta de uploads do portal, sem subir de diretório. */
function uploadSrc(el: HTMLElement | null): string | null {
  const src = el?.getAttribute('src') ?? '';
  return /^uploads\/[A-Za-z0-9_.-]+\.(png|jpe?g|webp)$/i.test(src) ? src : null;
}

/** animal_ficha.php?cod_animal=N — null quando o formulário de cadastro não está na página. */
export function parseAnimalFicha(html: string, today: Date = new Date()): SgqAnimalFicha | null {
  const root = parseDoc(html);
  if (!root.querySelector('[name="nome_animal"]')) return null;

  const raw = {
    species:   inputValue(root, 'cod_especie'),
    breed:     inputValue(root, 'cod_raca'),
    coat:      inputValue(root, 'cod_pelagem'),
    sex:       inputValue(root, 'sexo'),
    birthDate: inputValue(root, 'data_nascimento'),
    age:       inputValue(root, 'idade'),
  };
  const ownerCode = inputValue(root, 'cod_prop');
  const birthDate = brDateToIso(raw.birthDate);
  const ageText   = raw.age.match(/^(\d{1,2})\s*ano/i)?.[1];
  const ageYears  = birthDate
    ? ageFromBirthDate(birthDate, today)
    : ageText ? parseInt(ageText, 10) : null;

  return {
    name:          inputValue(root, 'nome_animal'),
    ownerCode:     /^\d+$/.test(ownerCode) ? ownerCode : null,
    registryBrand: meaningful(inputValue(root, 'registro')),
    chip:          meaningful(inputValue(root, 'chip')),
    species:       mapSpecies(raw.species),
    breed:         mapBreed(raw.breed),
    coat:          mapCoat(raw.coat),
    sex:           mapSex(raw.sex),
    birthDate,
    ageYears,
    signsDesc:     meaningful(inputValue(root, 'descricao_sinais')),
    raw,
    exams:         parseFichaExams(root),
    health:        parseFichaHealth(root),
    resenhoSrc:    uploadSrc(root.querySelector('img.resenho-imagem')),
    photoSrc:      uploadSrc(root.querySelector('.animal-avatar img')),
  };
}

export interface SgqOwnerDetail {
  address: string | null;
  district: string | null;
  cep: string | null;
  producerNumber: string | null;
}

/** proprietario_editar.php?cod_pro=N */
export function parseOwnerDetail(html: string): SgqOwnerDetail | null {
  const root = parseDoc(html);
  if (!root.querySelector('[name="cpf"]')) return null;
  const cep = onlyDigits(inputValue(root, 'cep'));
  return {
    address:        meaningful(inputValue(root, 'endereco')),
    district:       meaningful(inputValue(root, 'bairro')),
    cep:            cep.length === 8 ? maskCEP(cep) : null,
    producerNumber: meaningful(inputValue(root, 'numero_produtor')),
  };
}

// ─── Propriedade (detalhe) ───────────────────────────────────────────────────

export interface SgqPropertyDetail {
  address: string | null;
  oesaCode: string | null;
  animalCount: number | null;
}

/** propriedade_editar.php?cod_propriedade=N */
export function parsePropertyDetail(html: string): SgqPropertyDetail | null {
  const root = parseDoc(html);
  if (!root.querySelector('[name="nome_propriedade"]')) return null;
  const count = inputValue(root, 'animais_propriedade');
  return {
    address:     meaningful(inputValue(root, 'endereco_propriedade')),
    oesaCode:    meaningful(inputValue(root, 'cadastro_oesa')),
    animalCount: /^\d{1,6}$/.test(count) ? parseInt(count, 10) : null,
  };
}

// ─── Requisições de exame ────────────────────────────────────────────────────

export interface SgqExamRow {
  code: string;
  number: string;
  ownerName: string;
  animalName: string;
  collectionDate: string | null;   // ISO
  laboratory: string | null;
  laudoAvailable: boolean;
}

/** requisicao_{aieidga,aieelisa,mormoelisa}_lista.php */
export function parseExamList(html: string): SgqExamRow[] | null {
  const table = parseDoc(html).querySelectorAll('table').find(t => {
    const h = tableHeaders(t);
    return h.includes('Requisição') && h.includes('Laboratório');
  });
  if (!table) return null;
  const out: SgqExamRow[] = [];
  for (const td of dataRows(table)) {
    if (td.length < 7) continue;
    const code = (td[0].innerHTML.match(/(?:laudo|editar|relatorio)\('(\d+)'\)/) ?? [])[1];
    const number = clean(td[2].text);
    if (!code || !number) continue;
    out.push({
      code,
      number,
      ownerName: clean(td[3].text),
      animalName: clean(td[4].text),
      collectionDate: anyDateToIso(td[5].text),
      laboratory: meaningful(td[6].text),
      laudoAvailable: normalizeKey(td[1].text).startsWith('dispon'),
    });
  }
  return out;
}

export interface SgqRequisitionProperty {
  name: string | null;
  city: string | null;
  uf: string | null;
}

/** requisicao_*_editar.php?cod_requisicoes=N — propriedade onde o animal estava na coleta. */
export function parseRequisitionProperty(html: string): SgqRequisitionProperty | null {
  const root = parseDoc(html);
  if (!root.querySelector('[name="nome_do_animal"]')) return null;
  const uf = inputValue(root, 'uf_propriedade').toUpperCase();
  const city = meaningful(inputValue(root, 'municipio'));
  return {
    name: meaningful(inputValue(root, 'nome_da_propriedade')),
    city: city ? titleCasePt(city) : null,
    uf: (UF_LIST as readonly string[]).includes(uf) ? uf : null,
  };
}

/**
 * requisicao_*_resenha_laudo.php — a página embute o PDF hospedado nos
 * servidores da SGQ. Devolve a URL só se for https em *.sgqsistemas.com.br.
 */
export function parseLaudoUrl(html: string): string | null {
  const root = parseDoc(html);
  const raw = root.querySelector('object[data]')?.getAttribute('data')
    ?? root.querySelector('a[download]')?.getAttribute('href')
    ?? '';
  try {
    const url = new URL(raw.trim());
    const allowed = url.protocol === 'https:' && url.hostname.endsWith('.sgqsistemas.com.br');
    return allowed && /\.pdf$/i.test(url.pathname) ? url.toString() : null;
  } catch {
    return null;
  }
}
