// Criptografia das credenciais de integração (AES-256-GCM).
// A chave vive só em variável de ambiente do servidor (SGQ_CRED_KEY) —
// quem tiver apenas o banco não consegue ler a senha do portal.

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

export class SgqConfigError extends Error {}

export function parseKey(raw: string | undefined): Buffer {
  if (!raw) throw new SgqConfigError('SGQ_CRED_KEY não configurada.');
  const key = Buffer.from(raw, 'base64');
  if (key.length !== 32) throw new SgqConfigError('SGQ_CRED_KEY deve ter 32 bytes em base64.');
  return key;
}

export function encryptWithKey(key: Buffer, plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64'), cipher.getAuthTag().toString('base64'), data.toString('base64')].join('.');
}

export function decryptWithKey(key: Buffer, payload: string): string {
  const [version, iv, tag, data] = payload.split('.');
  if (version !== 'v1' || !iv || !tag || !data) throw new Error('Credencial em formato inválido.');
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(data, 'base64')), decipher.final()]).toString('utf8');
}

export function isSgqConfigured(): boolean {
  return Boolean(import.meta.env.SGQ_CRED_KEY);
}

export const encryptSecret = (plain: string): string =>
  encryptWithKey(parseKey(import.meta.env.SGQ_CRED_KEY), plain);

export const decryptSecret = (payload: string): string =>
  decryptWithKey(parseKey(import.meta.env.SGQ_CRED_KEY), payload);
