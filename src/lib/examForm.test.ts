import { describe, expect, it } from 'vitest';
import { laudoFileError, MAX_LAUDO_BYTES, todayIso, validateExamForm } from './examForm';

const today = '2026-11-20';

describe('formulário de exame manual', () => {
  it('aceita o mínimo: número e colheita', () => {
    expect(validateExamForm({ number: 'L-123', collectionDate: '2026-11-10', requestedDate: '' }, today)).toEqual({});
  });

  it('aceita colheita hoje e requisição no mesmo dia', () => {
    expect(validateExamForm({ number: '1', collectionDate: today, requestedDate: today }, today)).toEqual({});
  });

  it('exige número (só espaços não vale) e data de colheita', () => {
    expect(Object.keys(validateExamForm({ number: '   ', collectionDate: '', requestedDate: '' }, today))).toEqual(['number', 'collectionDate']);
  });

  it('recusa colheita no futuro', () => {
    expect(validateExamForm({ number: '1', collectionDate: '2026-11-21', requestedDate: '' }, today))
      .toEqual({ collectionDate: 'A colheita não pode ser em data futura.' });
  });

  it('recusa requisição depois da colheita', () => {
    expect(validateExamForm({ number: '1', collectionDate: '2026-11-10', requestedDate: '2026-11-11' }, today))
      .toEqual({ requestedDate: 'A requisição não pode ser depois da colheita.' });
  });

  it('data de hoje no fuso local, com zeros à esquerda', () => {
    expect(todayIso(new Date(2026, 0, 5, 23, 30))).toBe('2026-01-05');
  });
});

describe('arquivo do laudo', () => {
  it('aceita PDF, JPG e PNG até 15 MB', () => {
    for (const type of ['application/pdf', 'image/jpeg', 'image/png']) {
      expect(laudoFileError({ type, size: MAX_LAUDO_BYTES })).toBeNull();
    }
  });

  it('recusa outros formatos e arquivos grandes demais', () => {
    expect(laudoFileError({ type: 'application/msword', size: 10 })).toBe('Envie o laudo em PDF, JPG ou PNG.');
    expect(laudoFileError({ type: '', size: 10 })).toBe('Envie o laudo em PDF, JPG ou PNG.');
    expect(laudoFileError({ type: 'application/pdf', size: MAX_LAUDO_BYTES + 1 })).toBe('Arquivo muito grande (máximo de 15 MB).');
  });
});
