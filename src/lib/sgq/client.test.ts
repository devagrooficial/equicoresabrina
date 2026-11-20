import { afterEach, describe, expect, it, vi } from 'vitest';
import { sgqGet } from './client';

// O portal devolve a tela de login (via redirecionamento) quando a sessão caiu.
const LOGIN = '<html><body><form action="validacao.php"><input name="usuario"><input name="senha"></form></body></html>';
const MENU = '<html><body><a href="../../logout.php">Sair</a><table id="example"></table></body></html>';
// A página do laudo abre em janela própria: não tem o menu nem o link de sair.
const LAUDO = '<html><body><object data="https://servsa02.sgqsistemas.com.br/x/laudo.pdf" type="application/pdf"></object></body></html>';

function respond(body: string, status = 200) {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(status === 302 ? null : body, {
    status, headers: status === 302 ? { Location: '/login.php' } : {},
  })));
}

describe('sgqGet', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('reconhece a área logada pelo menu', async () => {
    respond(MENU);
    expect((await sgqGet('PHPSESSID=1', 'animal_lista.php')).loggedIn).toBe(true);
  });

  it('aceita a página do laudo, que não tem menu', async () => {
    respond(LAUDO);
    const res = await sgqGet('PHPSESSID=1', 'requisicao_aieidga_resenha_laudo.php?cod_requisicoes=12');
    expect(res.loggedIn).toBe(true);
    expect(res.html).toContain('laudo.pdf');
  });

  it('sessão caída: redirecionamento ou tela de login não contam como logado', async () => {
    respond('', 302);
    expect((await sgqGet('PHPSESSID=1', 'requisicao_aieidga_resenha_laudo.php?cod_requisicoes=12')).loggedIn).toBe(false);
    respond(LOGIN);
    expect((await sgqGet('PHPSESSID=1', 'requisicao_aieidga_resenha_laudo.php?cod_requisicoes=12')).loggedIn).toBe(false);
    // Uma página comum sem menu continua sendo tratada como sessão caída
    respond(LAUDO);
    expect((await sgqGet('PHPSESSID=1', 'animal_lista.php')).loggedIn).toBe(false);
  });

  it('recusa páginas fora da lista de leitura', async () => {
    respond(MENU);
    await expect(sgqGet('PHPSESSID=1', 'animal_excluir.php?cod_animal=1')).rejects.toThrow('fora da lista');
  });
});
