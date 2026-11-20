// Cliente HTTP do Portal Central de Requisições (SGQ).
// Regras: só o login envia dados; todo o resto é GET em páginas conhecidas.
// O cliente se identifica pelo User-Agent e não tenta contornar bloqueios —
// se o portal recusar o acesso, a sincronização para.

import { isLoggedInHtml } from './parse';

const BASE = 'https://portal.sgqsistemas.com.br';
const USER_AGENT = 'EquiCoreSync/1.0 (importacao solicitada pelo titular da conta)';
const TIMEOUT_MS = 25_000;

/** Usuário/senha recusados ou sessão que não se mantém. */
export class SgqAuthError extends Error {}
/** O portal recusou o acesso (403/429/5xx) — não insistir. */
export class SgqBlockedError extends Error {}

export const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

// Únicas páginas que a sincronização pode ler
const READABLE = [
  /^proprietario_lista\.php$/,
  /^propriedade_lista\.php$/,
  /^animal_lista\.php$/,
  /^animal_ficha\.php\?cod_animal=\d+$/,
  /^proprietario_editar\.php\?cod_pro=\d+$/,
  /^propriedade_editar\.php\?cod_propriedade=\d+$/,
  /^requisicao_(aieidga|aieelisa|mormoelisa)_lista\.php$/,
  /^requisicao_(aieidga|aieelisa|mormoelisa)_editar\.php\?cod_requisicoes=\d+$/,        // só leitura do formulário
  /^requisicao_(aieidga|aieelisa|mormoelisa)_resenha_laudo\.php\?cod_requisicoes=\d+$/,
  /^index\.php$/,
];

class CookieJar {
  private jar = new Map<string, string>();

  constructor(header = '') {
    for (const pair of header.split(';')) {
      const i = pair.indexOf('=');
      if (i > 0) this.jar.set(pair.slice(0, i).trim(), pair.slice(i + 1).trim());
    }
  }

  absorb(res: Response) {
    for (const cookie of res.headers.getSetCookie()) {
      const pair = cookie.split(';')[0];
      const i = pair.indexOf('=');
      if (i <= 0) continue;
      const name = pair.slice(0, i).trim();
      const value = pair.slice(i + 1).trim();
      if (!value || value === 'deleted') this.jar.delete(name);
      else this.jar.set(name, value);
    }
  }

  header(): string {
    return [...this.jar].map(([k, v]) => `${k}=${v}`).join('; ');
  }
}

async function request(url: string, jar: CookieJar, init: RequestInit = {}): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      redirect: 'manual',
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html',
        'Accept-Language': 'pt-BR',
        ...(jar.header() ? { Cookie: jar.header() } : {}),
        ...init.headers,
      },
    });
  } catch {
    throw new Error('Portal SGQ indisponível no momento.');
  }
  if (res.status === 403 || res.status === 429 || res.status >= 500) {
    throw new SgqBlockedError(`Portal respondeu ${res.status}.`);
  }
  jar.absorb(res);
  return res;
}

/**
 * Faz login e devolve o cookie de sessão. Lança SgqAuthError se o portal
 * não abrir a área logada com as credenciais informadas.
 */
export async function sgqLogin(username: string, password: string): Promise<string> {
  const jar = new CookieJar();

  await request(`${BASE}/`, jar);
  await sleep(600);

  await request(`${BASE}/validacao.php`, jar, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Referer: `${BASE}/` },
    body: new URLSearchParams({ usuario: username, senha: password }).toString(),
  });
  await sleep(600);

  const home = await request(`${BASE}/pages/forms/index.php`, jar);
  if (home.status !== 200 || !isLoggedInHtml(await home.text())) {
    throw new SgqAuthError('Login recusado pelo portal.');
  }
  return jar.header();
}

/**
 * Lê uma página da área logada. `loggedIn: false` indica sessão expirada
 * (o chamador decide se refaz o login).
 */
export async function sgqGet(cookie: string, page: string): Promise<{ html: string; loggedIn: boolean }> {
  if (!READABLE.some(re => re.test(page))) {
    throw new Error(`Página fora da lista de leitura: ${page}`);
  }
  const res = await request(`${BASE}/pages/forms/${page}`, new CookieJar(cookie));
  if (res.status !== 200) return { html: '', loggedIn: false };
  const html = await res.text();
  return { html, loggedIn: isLoggedInHtml(html) };
}

export interface SgqFile {
  bytes: Uint8Array;
  contentType: string;
  ext: string;
}

const FILE_TYPES: Record<string, string> = {
  'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'application/pdf': 'pdf',
};

async function download(url: string, maxBytes: number): Promise<SgqFile | null> {
  let res: Response;
  try {
    res = await fetch(url, {
      redirect: 'error',
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { 'User-Agent': USER_AGENT },
    });
  } catch {
    return null;
  }
  if (res.status === 403 || res.status === 429) throw new SgqBlockedError(`Portal respondeu ${res.status}.`);
  if (res.status !== 200) return null;

  const contentType = (res.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
  const ext = FILE_TYPES[contentType];
  if (!ext || Number(res.headers.get('content-length') ?? 0) > maxBytes) return null;

  const bytes = new Uint8Array(await res.arrayBuffer());
  if (bytes.byteLength === 0 || bytes.byteLength > maxBytes) return null;
  return { bytes, contentType, ext };
}

/**
 * Baixa uma imagem da pasta de uploads do portal (resenho ou foto do animal).
 * `src` vem do parser, que só aceita "uploads/<arquivo>.<png|jpg|webp>".
 */
export async function sgqGetUpload(src: string): Promise<SgqFile | null> {
  if (!/^uploads\/[A-Za-z0-9_.-]+\.(png|jpe?g|webp)$/i.test(src)) return null;
  const file = await download(`${BASE}/pages/forms/${src}`, 5 * 1024 * 1024);
  return file && file.ext !== 'pdf' ? file : null;
}

/** Baixa o PDF de um laudo. `url` vem de parseLaudoUrl(), que restringe o domínio. */
export async function sgqGetLaudo(url: string): Promise<SgqFile | null> {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' || !parsed.hostname.endsWith('.sgqsistemas.com.br')) return null;
  const file = await download(parsed.toString(), 15 * 1024 * 1024);
  return file && file.ext === 'pdf' ? file : null;
}
