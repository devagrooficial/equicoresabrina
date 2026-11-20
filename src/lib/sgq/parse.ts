// Leitura (somente leitura) das páginas do Portal Central de Requisições da SGQ.
// Funções puras: recebem o HTML e devolvem dados já normalizados para o EquiCore.

import { parse, type HTMLElement } from 'node-html-parser';
import { ESPECIES, RACAS, PELAGENS } from '../vetCatalogs';
import { ageFromBirthDate, maskCEP, maskPhone, onlyDigits, UF_LIST } from '../br';

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

// ─── Listas ──────────────────────────────────────────────────────────────────

function listRows(html: string): HTMLElement[] | null {
  const table = parse(html).querySelector('table#example');
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
      // O portal usa siglas próprias (CR, FC, JC…) sem equivalência no EquiCore
      classification: normalizeKey(td[3].text) === 'outro' ? 'Outro' : null,
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
}

/** animal_ficha.php?cod_animal=N — null quando o formulário de cadastro não está na página. */
export function parseAnimalFicha(html: string, today: Date = new Date()): SgqAnimalFicha | null {
  const root = parse(html);
  if (!root.querySelector('[name="nome_animal"]')) return null;

  const ownerCode = inputValue(root, 'cod_prop');
  const birthDate = brDateToIso(inputValue(root, 'data_nascimento'));
  const ageText   = inputValue(root, 'idade').match(/^(\d{1,2})\s*ano/i)?.[1];
  const ageYears  = birthDate
    ? ageFromBirthDate(birthDate, today)
    : ageText ? parseInt(ageText, 10) : null;

  return {
    name:          inputValue(root, 'nome_animal'),
    ownerCode:     /^\d+$/.test(ownerCode) ? ownerCode : null,
    registryBrand: meaningful(inputValue(root, 'registro')),
    chip:          meaningful(inputValue(root, 'chip')),
    species:       mapSpecies(inputValue(root, 'cod_especie')),
    breed:         mapBreed(inputValue(root, 'cod_raca')),
    coat:          mapCoat(inputValue(root, 'cod_pelagem')),
    sex:           mapSex(inputValue(root, 'sexo')),
    birthDate,
    ageYears,
    signsDesc:     meaningful(inputValue(root, 'descricao_sinais')),
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
  const root = parse(html);
  if (!root.querySelector('[name="cpf"]')) return null;
  const cep = onlyDigits(inputValue(root, 'cep'));
  return {
    address:        meaningful(inputValue(root, 'endereco')),
    district:       meaningful(inputValue(root, 'bairro')),
    cep:            cep.length === 8 ? maskCEP(cep) : null,
    producerNumber: meaningful(inputValue(root, 'numero_produtor')),
  };
}
