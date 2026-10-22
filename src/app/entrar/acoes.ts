'use server';
import { AuthError } from 'next-auth';
import { signIn } from '../../acesso/auth.js';

export async function entrarAcao(email: string, senha: string): Promise<{ erro?: string }> {
  try {
    await signIn('credentials', { email, senha, redirectTo: '/' });
  } catch (e) {
    if (e instanceof AuthError) return { erro: 'E-mail ou senha inválidos.' };
    throw e; // o redirecionamento de sucesso é lançado como erro e precisa subir
  }
  return {};
}
