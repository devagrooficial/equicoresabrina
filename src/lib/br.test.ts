import { describe, it, expect } from 'vitest';
import {
  onlyDigits,
  isValidCPF,
  isValidCNPJ,
  isValidCpfCnpj,
  maskCpfCnpj,
  maskPhone,
  maskCEP,
  ageFromBirthDate,
  UF_LIST,
} from './br';

describe('onlyDigits', () => {
  it('remove tudo que não é dígito', () => {
    expect(onlyDigits('123.456.789-09')).toBe('12345678909');
    expect(onlyDigits('(65) 99999-9999')).toBe('65999999999');
    expect(onlyDigits('abc')).toBe('');
  });
});

describe('isValidCPF', () => {
  it('aceita CPFs válidos', () => {
    expect(isValidCPF('123.456.789-09')).toBe(true);
    expect(isValidCPF('11144477735')).toBe(true);
    expect(isValidCPF('529.982.247-25')).toBe(true);
  });

  it('rejeita CPFs com dígito verificador errado', () => {
    expect(isValidCPF('123.456.789-00')).toBe(false);
    expect(isValidCPF('11144477734')).toBe(false);
  });

  it('rejeita sequências repetidas', () => {
    expect(isValidCPF('111.111.111-11')).toBe(false);
    expect(isValidCPF('00000000000')).toBe(false);
  });

  it('rejeita tamanho errado', () => {
    expect(isValidCPF('1234567890')).toBe(false);
    expect(isValidCPF('')).toBe(false);
  });
});

describe('isValidCNPJ', () => {
  it('aceita CNPJs válidos', () => {
    expect(isValidCNPJ('11.222.333/0001-81')).toBe(true);
    expect(isValidCNPJ('11444777000161')).toBe(true);
  });

  it('rejeita CNPJs inválidos', () => {
    expect(isValidCNPJ('11.222.333/0001-80')).toBe(false);
    expect(isValidCNPJ('11111111111111')).toBe(false);
    expect(isValidCNPJ('123')).toBe(false);
  });
});

describe('isValidCpfCnpj', () => {
  it('roteia por tamanho', () => {
    expect(isValidCpfCnpj('529.982.247-25')).toBe(true);   // CPF
    expect(isValidCpfCnpj('11.222.333/0001-81')).toBe(true); // CNPJ
    expect(isValidCpfCnpj('123456789091')).toBe(false);    // 12 dígitos
  });
});

describe('maskCpfCnpj', () => {
  it('formata CPF progressivamente', () => {
    expect(maskCpfCnpj('529')).toBe('529');
    expect(maskCpfCnpj('5299822')).toBe('529.982.2');
    expect(maskCpfCnpj('52998224725')).toBe('529.982.247-25');
  });

  it('formata CNPJ com 12+ dígitos', () => {
    expect(maskCpfCnpj('11222333000181')).toBe('11.222.333/0001-81');
  });

  it('trunca além de 14 dígitos', () => {
    expect(maskCpfCnpj('112223330001819999')).toBe('11.222.333/0001-81');
  });
});

describe('maskPhone', () => {
  it('formata celular com 11 dígitos', () => {
    expect(maskPhone('65999999999')).toBe('(65) 99999-9999');
  });
  it('formata fixo com 10 dígitos', () => {
    expect(maskPhone('6533334444')).toBe('(65) 3333-4444');
  });
  it('formata parcial', () => {
    expect(maskPhone('65')).toBe('65');
    expect(maskPhone('65999')).toBe('(65) 999');
  });
});

describe('maskCEP', () => {
  it('formata CEP', () => {
    expect(maskCEP('78000000')).toBe('78000-000');
    expect(maskCEP('780')).toBe('780');
  });
});

describe('ageFromBirthDate', () => {
  const today = new Date(2026, 5, 12); // 12/06/2026

  it('calcula idade já feita no ano', () => {
    expect(ageFromBirthDate('2020-01-15', today)).toBe(6);
  });

  it('calcula idade antes do aniversário', () => {
    expect(ageFromBirthDate('2020-12-25', today)).toBe(5);
  });

  it('aniversário hoje conta', () => {
    expect(ageFromBirthDate('2020-06-12', today)).toBe(6);
  });

  it('retorna null para data futura ou inválida', () => {
    expect(ageFromBirthDate('2030-01-01', today)).toBe(null);
    expect(ageFromBirthDate('', today)).toBe(null);
    expect(ageFromBirthDate('abc', today)).toBe(null);
  });
});

describe('UF_LIST', () => {
  it('contém as 27 unidades federativas', () => {
    expect(UF_LIST).toHaveLength(27);
    expect(UF_LIST).toContain('MT');
    expect(UF_LIST).toContain('SP');
  });
});
