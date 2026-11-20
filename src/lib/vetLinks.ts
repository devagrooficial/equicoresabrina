// Vínculos de um animal acompanhado pelo veterinário, para a visão do DONO:
// em nome de quem está o cadastro, em que propriedade o animal fica e quem é
// o veterinário. Só para uso no servidor (páginas .astro).
//
// O dono não tem (nem deve ter) leitura das tabelas do veterinário: o RLS só
// libera para ele os animais compartilhados. Por isso estas consultas usam
// service_role — e SÓ podem receber linhas de vet_equines que o usuário leu
// com a própria sessão. É essa leitura que prova o acesso; daqui saem apenas
// os cadastros apontados por aquelas linhas, e só os campos de identificação.

import { getSupabaseAdmin } from './supabaseAdmin';

export interface LinkedOwner    { id: string; name: string; cpf_cnpj: string }
export interface LinkedProperty { id: string; name: string; city: string | null; uf: string | null; classification: string | null; oesa_code: string | null }
export interface LinkedVet      { id: string; full_name: string | null; crmv: string | null; specialty: string | null }

export interface EquineLinks {
  owners: Map<string, LinkedOwner>;
  properties: Map<string, LinkedProperty>;
  vets: Map<string, LinkedVet>;
}

interface LinkKeys { owner_id?: string | null; property_id?: string | null; vet_id?: string | null }

const ids = (rows: readonly LinkKeys[], key: keyof LinkKeys) =>
  [...new Set(rows.map(row => row[key]).filter((id): id is string => !!id))];

export async function loadEquineLinks(visibleEquines: readonly LinkKeys[]): Promise<EquineLinks> {
  const links: EquineLinks = { owners: new Map(), properties: new Map(), vets: new Map() };
  if (visibleEquines.length === 0) return links;

  let admin;
  try {
    admin = getSupabaseAdmin();
  } catch {
    return links;   // servidor sem service_role: a página aparece sem os vínculos
  }

  const fetch = async (table: string, columns: string, list: string[]) =>
    list.length ? ((await admin.from(table).select(columns).in('id', list)).data ?? []) : [];

  const [owners, properties, vets] = await Promise.all([
    fetch('vet_owners', 'id, name, cpf_cnpj', ids(visibleEquines, 'owner_id')),
    fetch('vet_properties', 'id, name, city, uf, classification, oesa_code', ids(visibleEquines, 'property_id')),
    fetch('profiles', 'id, full_name, crmv, specialty', ids(visibleEquines, 'vet_id')),
  ]);
  for (const row of owners) links.owners.set(row.id, row);
  for (const row of properties) links.properties.set(row.id, row);
  for (const row of vets) links.vets.set(row.id, row);
  return links;
}
