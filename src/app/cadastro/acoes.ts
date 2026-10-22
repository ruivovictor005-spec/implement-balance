'use server';
import { AuthError } from 'next-auth';
import { signIn } from '../../acesso/auth.js';
import { db } from '../../dados/cliente.js';
import { cadastrarUsuario } from '../../dados/usuarios.js';

export async function cadastrarAcao(
  nome: string,
  email: string,
  senha: string,
): Promise<{ erro?: string }> {
  try {
    await cadastrarUsuario(db(), { nome, email, senha });
  } catch (e) {
    return { erro: (e as Error).message };
  }
  try {
    await signIn('credentials', { email, senha, redirectTo: '/' });
  } catch (e) {
    if (e instanceof AuthError) return { erro: 'Conta criada. Agora faça login.' };
    throw e;
  }
  return {};
}
