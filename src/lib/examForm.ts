// Regras do lançamento manual de exame (formulário da ficha do animal).
// Arquivo sem dependências, para poder ser testado sozinho.

export const MAX_LAUDO_BYTES = 15 * 1024 * 1024;

/** Tipos aceitos como laudo → extensão gravada no storage. */
export const LAUDO_FILE_TYPES: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
};

export function todayIso(now: Date = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/** Confere os campos do formulário; devolve as mensagens por campo (vazio = tudo certo). */
export function validateExamForm(
  form: { number: string; collectionDate: string; requestedDate: string },
  today: string = todayIso(),
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!form.number.trim()) errors.number = 'Informe o número da requisição ou do laudo.';
  if (!form.collectionDate) errors.collectionDate = 'Informe a data da colheita.';
  else if (form.collectionDate > today) errors.collectionDate = 'A colheita não pode ser em data futura.';
  if (form.requestedDate && form.collectionDate && form.requestedDate > form.collectionDate) {
    errors.requestedDate = 'A requisição não pode ser depois da colheita.';
  }
  return errors;
}

/** Arquivo aceito como laudo? Devolve a mensagem de erro, ou null se serve. */
export function laudoFileError(file: { type: string; size: number }): string | null {
  if (!LAUDO_FILE_TYPES[file.type]) return 'Envie o laudo em PDF, JPG ou PNG.';
  if (file.size > MAX_LAUDO_BYTES) return 'Arquivo muito grande (máximo de 15 MB).';
  return null;
}
