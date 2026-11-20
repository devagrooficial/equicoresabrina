import { describe, expect, it } from 'vitest';
import { animalHealth, cityUf, countBy, fetchAllRows, fetchByIds, healthSummary, sortByUrgency } from './vetRecords';

const today = new Date(2026, 10, 20); // 20/11/2026
const exam = (collection_date: string | null, exam_type: 'aieelisa' | 'mormoelisa' = 'aieelisa') => ({ exam_type, collection_date });

describe('situação sanitária de um conjunto de animais', () => {
  const animals = [
    { name: 'Zoe',     exams: [exam('2026-11-01'), exam('2026-11-01', 'mormoelisa')] },  // em dia
    { name: 'Ursa',    exams: [exam('2026-09-25')] },                                      // vence em 4 dias
    { name: 'Valmira', exams: [exam('2026-11-01'), exam('2026-08-01', 'mormoelisa')] },   // mormo vencido
    { name: 'Abel',    exams: [] },                                                        // sem exames
    { name: 'Bela',    exams: [exam('2026-07-01')] },                                      // vencido
  ];

  it('o pior exame define a situação do animal', () => {
    expect(animals.map(a => animalHealth(a, today))).toEqual(['valid', 'expiring', 'expired', 'none', 'expired']);
  });

  it('conta quantos animais em cada situação', () => {
    expect(healthSummary(animals, today)).toEqual({ valid: 1, expiring: 1, expired: 2, none: 1 });
  });

  it('ordena por urgência e, no empate, por nome', () => {
    expect(sortByUrgency(animals, today).map(a => a.name)).toEqual(['Bela', 'Valmira', 'Ursa', 'Abel', 'Zoe']);
  });
});

describe('vínculos derivados dos animais', () => {
  const animals = [
    { owner_id: 'o1', property_id: 'p1' },
    { owner_id: 'o1', property_id: null },
    { owner_id: 'o2', property_id: 'p1' },
    { owner_id: 'o1', property_id: 'p2' },
  ];

  it('conta animais por proprietário e por propriedade, inclusive os sem propriedade', () => {
    expect([...countBy(animals, 'owner_id')]).toEqual([['o1', 3], ['o2', 1]]);
    expect([...countBy(animals, 'property_id')]).toEqual([['p1', 2], [null, 1], ['p2', 1]]);
  });

  it('monta cidade/UF só com o que existe', () => {
    expect(cityUf('Jaciara', 'MT')).toBe('Jaciara/MT');
    expect(cityUf(null, 'MT')).toBe('MT');
    expect(cityUf(null, null)).toBeNull();
  });
});

describe('leitura paginada', () => {
  it('continua lendo enquanto a página vier cheia', async () => {
    const all = Array.from({ length: 25 }, (_, i) => i);
    const calls: [number, number][] = [];
    const result = await fetchAllRows<number>((from, to) => {
      calls.push([from, to]);
      return Promise.resolve({ data: all.slice(from, to + 1), error: null });
    }, 10);
    expect(result.data).toEqual(all);
    expect(calls).toEqual([[0, 9], [10, 19], [20, 29]]);
  });

  it('para no erro e devolve o que já leu', async () => {
    const result = await fetchAllRows<number>(from =>
      Promise.resolve(from === 0 ? { data: [1, 2], error: null } : { data: null, error: { message: 'falhou' } }), 2);
    expect(result.data).toEqual([1, 2]);
    expect(result.error).toEqual({ message: 'falhou' });
  });

  it('busca por id em lotes, sem repetir nem mandar nulos', async () => {
    const batches: string[][] = [];
    const supabase = {
      from: () => ({ select: () => ({ in: (_column: string, ids: string[]) => { batches.push(ids); return Promise.resolve({ data: ids.map(id => ({ id })) }); } }) }),
    };
    const ids = [...Array.from({ length: 150 }, (_, i) => `id-${i}`), 'id-0', null];
    const rows = await fetchByIds<{ id: string }>(supabase, 'vet_owners', 'id', ids);
    expect(batches.map(b => b.length)).toEqual([100, 50]);
    expect(rows).toHaveLength(150);
  });
});
