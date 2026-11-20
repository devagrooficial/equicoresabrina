import { describe, expect, it } from 'vitest';
import {
  brDateToIso, isLoggedInHtml, mapBreed, mapCoat, mapSex, mapSpecies, normalizeKey,
  parseAnimalFicha, parseAnimalList, parseOwnerDetail, parseOwnerList, parsePropertyList,
  splitCityUf, titleCasePt,
} from './parse';
import { decryptWithKey, encryptWithKey, parseKey, SgqConfigError } from './crypto';

// Fixtures com a mesma estrutura das páginas do portal (dados fictícios)

const page = (body: string) =>
  `<!doctype html><html><body><a href="../../logout.php">Sair</a>${body}</body></html>`;

const OWNER_LIST = page(`
<table id="example" class="table table-striped"><thead><tr>
  <th></th><th>Proprietário</th><th>CPF/CNPJ</th><th>Cidade - UF</th><th>Telefone</th><th>E-mail</th>
</tr></thead><tbody>
<tr> <td><div class="notify-thumb-lista"><a href="#" onclick="editar('698103')"><font style="font-size: 9pt"><span class="status-p bg-danger">Editar</span></font></a></div> </td><td><font style="font-size: 10pt">JOÃO DA SILVA &amp; FILHOS</font></td> <td><font style="font-size: 10pt">52998224725</font></td> <td><font style="font-size: 10pt">SÃO GABRIEL DO OESTE - MS</font></td> <td><font style="font-size: 10pt">67999998888</font></td> <td><font style="font-size: 10pt">Joao@Exemplo.com</font></td> </tr>
<tr> <td><div class="notify-thumb-lista"><a href="#" onclick="editar('698104')"><font><span>Editar</span></font></a></div> </td><td><font>HARAS BOA VISTA LTDA</font></td> <td><font>11222333000181</font></td> <td><font>CUIABÁ - MT</font></td> <td><font></font></td> <td><font></font></td> </tr>
<tr> <td><div class="notify-thumb-lista"><a href="#" onclick="editar('698105')"><font><span>Editar</span></font></a></div> </td><td><font>MARIA SEM DOCUMENTO</font></td> <td><font></font></td> <td><font></font></td> <td><font>123</font></td> <td><font>sem-email</font></td> </tr>
</tbody></table>`);

const PROPERTY_LIST = page(`
<table id="example"><thead><tr><th></th><th>Nome da Propriedade</th><th>Municipio - UF</th><th>Classificação</th></tr></thead><tbody>
<tr> <td><div class="notify-thumb-lista"><a href="#" onclick="editar('4501')"><font><span>Editar</span></font></a></div> </td><td><font>FAZENDA SANTA RITA</font></td> <td><font>CAMPO GRANDE - MS</font></td> <td><font>CR</font></td> </tr>
<tr> <td><div class="notify-thumb-lista"><a href="#" onclick="editar('4502')"><font><span>Editar</span></font></a></div> </td><td><font>SÍTIO DO VALE</font></td> <td><font>SIDROLÂNDIA - MS</font></td> <td><font>OUTRO</font></td> </tr>
</tbody></table>`);

const ANIMAL_LIST = page(`
<table id="example" class="table table-striped"><thead><tr>
  <th>Ações</th><th>Código Animal</th><th>Nome Animal</th><th>Nome Proprietário</th><th>Raça</th><th>Sexo</th>
</tr></thead><tbody>
<tr> <td class="acoes-animal"> <a href="animal_ficha.php?cod_animal=1234567" class="btn btn-ficha" title="Abrir ficha completa do animal"> <i class="ti-agenda"></i> Ver ficha </a> </td> <td> <span class="animal-code">#1234567</span> </td> <td class="animal-name"> 7 OURO </td> <td> JOÃO DA SILVA &amp; FILHOS </td> <td> SRD </td> <td> <span class="animal-sex">MACHO</span> </td> </tr>
<tr> <td class="acoes-animal"> <a href="animal_ficha.php?cod_animal=1234568" class="btn btn-ficha"> Ver ficha </a> </td> <td> <span class="animal-code">#1234568</span> </td> <td class="animal-name"> ESTRELA </td> <td> HARAS BOA VISTA LTDA </td> <td> Pantaneira </td> <td> <span class="animal-sex">FÊMEA</span> </td> </tr>
</tbody></table>`);

const ANIMAL_FICHA = page(`
<form><input type="hidden" name="cod_animal" value="1234567"><input type="hidden" name="token" value="abc">
  <input type="text" name="nome_animal" value="7 OURO">
  <select name="cod_prop"><option value="">Selecione</option><option value="698103" selected>JOÃO DA SILVA</option><option value="698104">HARAS</option></select>
  <input type="text" name="registro" value="ABC 123">
  <input type="text" name="chip" value="">
  <select name="cod_especie"><option value="EQUINA" selected>EQUINA</option><option value="ASININO">ASININO</option><option value="MUAR">MUAR</option></select>
  <select name="cod_raca"><option value="SRD" selected>SRD</option><option value="CRIOULA">CRIOULA</option></select>
  <select name="cod_pelagem"><option value="CASTANHO" selected>CASTANHO</option><option value="ALAZA">ALAZA</option></select>
  <select name="sexo"><option value="FÊMEA">FÊMEA</option><option value="MACHO" selected>MACHO</option></select>
  <input type="text" name="data_nascimento" value="01/01/2016">
  <input type="text" name="idade" value="10 anos e 10 meses">
  <select name="status_animal"><option value="ATIVO" selected>ATIVO</option></select>
  <textarea name="descricao_sinais">Estrela  na testa,
  calçado</textarea>
</form>`);

const OWNER_EDIT = page(`
<form action="proprietario_editar_cod.php?cod_pro=698103" method="post">
  <input type="text" name="nome" value="JOÃO DA SILVA"><input type="text" name="cpf" value="52998224725">
  <input type="text" name="endereco" value="RUA DAS FLORES, 100"><input type="text" name="bairro" value="CENTRO">
  <input type="text" name="cep" value="79490000"><input type="text" name="numero_produtor" value="*****">
</form>`);

describe('texto e formatos', () => {
  it('normaliza chaves sem acento', () => {
    expect(normalizeKey('  JOÃO   da Silva ')).toBe('joao da silva');
  });

  it('capitaliza nomes de município', () => {
    expect(titleCasePt('SÃO GABRIEL DO OESTE')).toBe('São Gabriel do Oeste');
  });

  it('separa cidade e UF', () => {
    expect(splitCityUf('SANT ANA DO LIVRAMENTO - RS')).toEqual({ city: 'Sant Ana do Livramento', uf: 'RS' });
    expect(splitCityUf('LUGAR - XX')).toEqual({ city: 'Lugar', uf: null });
    expect(splitCityUf('')).toEqual({ city: null, uf: null });
  });

  it('converte datas brasileiras e rejeita inválidas', () => {
    expect(brDateToIso('31/12/2016')).toBe('2016-12-31');
    expect(brDateToIso('31/02/2016')).toBeNull();
    expect(brDateToIso('01/01/2999')).toBeNull();
    expect(brDateToIso('')).toBeNull();
  });
});

describe('catálogos', () => {
  it('mapeia espécie e sexo', () => {
    expect(mapSpecies('EQUINA')).toBe('Equina');
    expect(mapSpecies('ASININO')).toBe('Asinina');
    expect(mapSpecies('MUAR')).toBe('Muar');
    expect(mapSex('FÊMEA')).toBe('Fêmea');
    expect(mapSex('MACHO')).toBe('Macho');
    expect(mapSex('')).toBeNull();
  });

  it('mapeia raças conhecidas e preserva as demais', () => {
    expect(mapBreed('SRD')).toBe('Sem Raça Definida (SRD)');
    expect(mapBreed('QUARTO DE MILHA P.O.')).toBe('Quarto de Milha');
    expect(mapBreed('CRIOULA')).toBe('Crioulo');
    expect(mapBreed('MANGA LARGA')).toBe('Mangalarga');
    expect(mapBreed('PANTANEIRO')).toBe('Pantaneiro');
    expect(mapBreed('')).toBeNull();
  });

  it('mapeia pelagens com gênero e acento diferentes', () => {
    expect(mapCoat('CASTANHO')).toBe('Castanha');
    expect(mapCoat('ALAZA')).toBe('Alazã');
    expect(mapCoat('alazão')).toBe('Alazã');
    expect(mapCoat('BAIO')).toBe('Baia');
    expect(mapCoat('CASTANHA PINHAO')).toBe('Castanha Pinhão');
    expect(mapCoat('GATEADA RUIVA')).toBe('Gateada Ruiva');
  });
});

describe('listas do portal', () => {
  it('detecta sessão logada', () => {
    expect(isLoggedInHtml(OWNER_LIST)).toBe(true);
    expect(isLoggedInHtml('<form action="validacao.php"></form>')).toBe(false);
  });

  it('lê proprietários', () => {
    const rows = parseOwnerList(OWNER_LIST)!;
    expect(rows).toHaveLength(3);
    expect(rows[0]).toEqual({
      code: '698103', name: 'JOÃO DA SILVA & FILHOS', cpfCnpj: '52998224725',
      city: 'São Gabriel do Oeste', uf: 'MS', phone: '(67) 99999-8888', email: 'joao@exemplo.com',
      raw: { cityUf: 'SÃO GABRIEL DO OESTE - MS', phone: '67999998888' },
    });
    expect(rows[1].cpfCnpj).toBe('11222333000181');
    expect(rows[1].phone).toBeNull();
    expect(rows[2]).toMatchObject({ cpfCnpj: '', city: null, uf: null, email: null });
  });

  it('lê propriedades', () => {
    expect(parsePropertyList(PROPERTY_LIST)).toEqual([
      { code: '4501', name: 'FAZENDA SANTA RITA', city: 'Campo Grande', uf: 'MS', classification: null,
        raw: { cityUf: 'CAMPO GRANDE - MS', classification: 'CR' } },
      { code: '4502', name: 'SÍTIO DO VALE', city: 'Sidrolândia', uf: 'MS', classification: 'Outro',
        raw: { cityUf: 'SIDROLÂNDIA - MS', classification: 'OUTRO' } },
    ]);
  });

  it('lê animais', () => {
    expect(parseAnimalList(ANIMAL_LIST)).toEqual([
      { code: '1234567', name: '7 OURO', ownerName: 'JOÃO DA SILVA & FILHOS', breed: 'Sem Raça Definida (SRD)', sex: 'Macho',
        raw: { breed: 'SRD', sex: 'MACHO' } },
      { code: '1234568', name: 'ESTRELA', ownerName: 'HARAS BOA VISTA LTDA', breed: 'Pantaneira', sex: 'Fêmea',
        raw: { breed: 'Pantaneira', sex: 'FÊMEA' } },
    ]);
  });

  it('devolve null quando a tabela não existe (layout mudou ou sessão caiu)', () => {
    expect(parseOwnerList('<html><body>Login</body></html>')).toBeNull();
    expect(parseAnimalList('<html></html>')).toBeNull();
    expect(parsePropertyList('')).toBeNull();
  });
});

describe('fichas do portal', () => {
  it('lê a ficha do animal', () => {
    expect(parseAnimalFicha(ANIMAL_FICHA, new Date(2026, 10, 19))).toEqual({
      name: '7 OURO', ownerCode: '698103', registryBrand: 'ABC 123', chip: null,
      species: 'Equina', breed: 'Sem Raça Definida (SRD)', coat: 'Castanha', sex: 'Macho',
      birthDate: '2016-01-01', ageYears: 10, signsDesc: 'Estrela na testa, calçado',
      raw: { species: 'EQUINA', breed: 'SRD', coat: 'CASTANHO', sex: 'MACHO', birthDate: '01/01/2016', age: '10 anos e 10 meses' },
    });
  });

  it('usa a idade informada quando não há data de nascimento', () => {
    const html = ANIMAL_FICHA.replace('value="01/01/2016"', 'value=""');
    expect(parseAnimalFicha(html)).toMatchObject({ birthDate: null, ageYears: 10 });
  });

  it('devolve null se a página não é uma ficha', () => {
    expect(parseAnimalFicha(OWNER_LIST)).toBeNull();
  });

  it('lê o endereço do proprietário e ignora campos só com símbolos', () => {
    expect(parseOwnerDetail(OWNER_EDIT)).toEqual({
      address: 'RUA DAS FLORES, 100', district: 'CENTRO', cep: '79490-000', producerNumber: null,
    });
    expect(parseOwnerDetail(ANIMAL_LIST)).toBeNull();
  });
});

describe('criptografia das credenciais', () => {
  const key = parseKey(Buffer.alloc(32, 7).toString('base64'));

  it('cifra e decifra', () => {
    const payload = encryptWithKey(key, 's3nh@ çom acento');
    expect(payload).not.toContain('s3nh@');
    expect(decryptWithKey(key, payload)).toBe('s3nh@ çom acento');
  });

  it('gera um resultado diferente a cada vez (IV aleatório)', () => {
    expect(encryptWithKey(key, 'abc')).not.toBe(encryptWithKey(key, 'abc'));
  });

  it('rejeita conteúdo adulterado e chave errada', () => {
    const payload = encryptWithKey(key, 'abc');
    const tampered = payload.slice(0, -4) + 'AAAA';
    expect(() => decryptWithKey(key, tampered)).toThrow();
    expect(() => decryptWithKey(parseKey(Buffer.alloc(32, 8).toString('base64')), payload)).toThrow();
  });

  it('exige chave de 32 bytes', () => {
    expect(() => parseKey(undefined)).toThrow(SgqConfigError);
    expect(() => parseKey('Y3VydGE=')).toThrow(SgqConfigError);
  });
});
