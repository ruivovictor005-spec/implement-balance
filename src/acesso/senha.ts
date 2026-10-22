// Hash de senha com scrypt (node:crypto) — sem dependência externa. Formato: scrypt$<salt>$<hash>.
import { randomBytes, randomInt, scryptSync, timingSafeEqual } from 'node:crypto';

export function criarHashSenha(senha: string): string {
  const salt = randomBytes(16);
  const dk = scryptSync(senha, salt, 64);
  return `scrypt$${salt.toString('hex')}$${dk.toString('hex')}`;
}

export function conferirSenha(senha: string, hash: string | null | undefined): boolean {
  if (hash == null) return false;
  const partes = hash.split('$');
  if (partes.length !== 3 || partes[0] !== 'scrypt') return false;
  const salt = Buffer.from(partes[1], 'hex');
  const esperado = Buffer.from(partes[2], 'hex');
  const obtido = scryptSync(senha, salt, esperado.length);
  return esperado.length === obtido.length && timingSafeEqual(esperado, obtido);
}

/** Código numérico de 6 dígitos para a recuperação de senha. */
export function gerarCodigoRecuperacao(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}
