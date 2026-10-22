'use server';
import { enviarCodigoRecuperacao } from '../../acesso/email.js';
import { db } from '../../dados/cliente.js';
import { redefinirSenha, solicitarRecuperacao } from '../../dados/usuarios.js';

/** Pede o código: sempre responde igual (não revela se o e-mail existe). */
export async function pedirCodigoAcao(nome: string, email: string): Promise<{ ok: true }> {
  const r = await solicitarRecuperacao(db(), nome, email);
  if (r !== null) await enviarCodigoRecuperacao(r.usuario.email, r.usuario.nome, r.codigo);
  return { ok: true };
}

export async function redefinirAcao(
  email: string,
  codigo: string,
  senha: string,
): Promise<{ erro?: string; ok?: boolean }> {
  try {
    const ok = await redefinirSenha(db(), email, codigo, senha);
    if (!ok) return { erro: 'Código inválido ou expirado. Peça um novo.' };
    return { ok: true };
  } catch (e) {
    return { erro: (e as Error).message };
  }
}
