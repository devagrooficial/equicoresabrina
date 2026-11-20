// Cadastros do veterinário vistos em conjunto: animal ↔ proprietário ↔ propriedade.
// Não existe ligação direta entre proprietário e propriedade no banco: ela é
// derivada dos animais (cada animal tem um proprietário e, opcionalmente, uma
// propriedade). Funções puras + consultas usadas pelas fichas da área vet.

import { overallState, type ExamState } from './examStatus';
import type { ExamType } from './sgq/labels';

export type Health = ExamState | 'none';

export interface AnimalLite {
  id: string;
  name: string;
  species: string | null;
  breed: string | null;
  sex: string | null;
  shared_with_owner: boolean;
  owner_id: string | null;
  property_id: string | null;
  exams: { exam_type: ExamType; collection_date: string | null }[];
}

const ANIMAL_BASE = 'id, name, species, breed, sex, shared_with_owner, owner_id, property_id';
const ANIMAL_WITH_EXAMS = `${ANIMAL_BASE}, exams:vet_equine_exams(exam_type, collection_date)`;

/** Vencidos primeiro: é o que pede ação. */
export const URGENCY: Record<Health, number> = { expired: 0, expiring: 1, none: 2, valid: 3 };

export function animalHealth(animal: Pick<AnimalLite, 'exams'>, today: Date = new Date()): Health {
  return overallState(animal.exams ?? [], today);
}

export function healthSummary(animals: readonly Pick<AnimalLite, 'exams'>[], today: Date = new Date()): Record<Health, number> {
  const summary: Record<Health, number> = { expired: 0, expiring: 0, none: 0, valid: 0 };
  for (const animal of animals) summary[animalHealth(animal, today)]++;
  return summary;
}

/** Ordena por urgência dos exames e, no empate, por nome. */
export function sortByUrgency<T extends Pick<AnimalLite, 'exams' | 'name'>>(animals: readonly T[], today: Date = new Date()): T[] {
  return [...animals].sort((a, b) =>
    URGENCY[animalHealth(a, today)] - URGENCY[animalHealth(b, today)] || a.name.localeCompare(b.name, 'pt-BR'));
}

/** Quantos animais por proprietário ou por propriedade (chave nula = sem vínculo). */
export function countBy(animals: readonly Pick<AnimalLite, 'owner_id' | 'property_id'>[], key: 'owner_id' | 'property_id'): Map<string | null, number> {
  const counts = new Map<string | null, number>();
  for (const animal of animals) counts.set(animal[key], (counts.get(animal[key]) ?? 0) + 1);
  return counts;
}

export const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function cityUf(city: string | null | undefined, uf: string | null | undefined): string | null {
  return [city, uf].filter(Boolean).join('/') || null;
}

// ─── Consultas ───────────────────────────────────────────────────────────────

type Page<T> = PromiseLike<{ data: T[] | null; error: unknown }>;

/**
 * Lê todas as linhas de uma consulta. O Supabase devolve no máximo 1000 por
 * requisição; sem paginar, um veterinário com mais animais veria a lista cortada.
 */
export async function fetchAllRows<T>(page: (from: number, to: number) => Page<T>, size = 1000): Promise<{ data: T[]; error: unknown }> {
  const rows: T[] = [];
  for (let from = 0; ; from += size) {
    const { data, error } = await page(from, from + size - 1);
    if (error) return { data: rows, error };
    rows.push(...(data ?? []));
    if (!data || data.length < size) return { data: rows, error: null };
  }
}

/** Animais de um proprietário ou de uma propriedade, com os exames para a situação sanitária. */
export async function loadAnimals(supabase: any, column: 'owner_id' | 'property_id', id: string): Promise<{ data: AnimalLite[]; error: unknown }> {
  const query = (columns: string) => fetchAllRows<any>((from, to) =>
    supabase.from('vet_equines').select(columns).eq(column, id).order('name').order('id').range(from, to));

  let result = await query(ANIMAL_WITH_EXAMS);
  // Banco sem a tabela de exames: mostra os animais mesmo assim
  if (result.error) result = await query(ANIMAL_BASE);
  return { data: result.data.map(row => ({ ...row, exams: row.exams ?? [] })), error: result.error };
}

/** Busca linhas por id em lotes (a lista vai na URL; lotes evitam estourar o limite). */
export async function fetchByIds<T>(supabase: any, table: string, columns: string, ids: readonly (string | null)[]): Promise<T[]> {
  const unique = [...new Set(ids.filter((id): id is string => !!id))];
  const rows: T[] = [];
  for (let i = 0; i < unique.length; i += 100) {
    const { data } = await supabase.from(table).select(columns).in('id', unique.slice(i, i + 100));
    rows.push(...((data ?? []) as T[]));
  }
  return rows;
}
