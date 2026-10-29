'use server';
import { AuthError, CredentialsSignin } from 'next-auth';
import { signIn } from '../../acesso/auth.js';
import { ERRO_INDISPONIVEL } from '../../acesso/mensagens.js';

export async function entrarAcao(email: string, senha: string): Promise<{ erro?: string }> {
  try {
    await signIn('credentials', { email, senha, redirectTo: '/' });
  } catch (e) {
    // `authorize` devolvendo null vira CredentialsSignin — aí sim a credencial está errada.
    if (e instanceof CredentialsSignin) return { erro: 'E-mail ou senha inválidos.' };
    // Qualquer outra falha dentro de `authorize` (ex.: banco inacessível) chega aqui embrulhada em
    // CallbackRouteError. Tratar isso como senha inválida esconde a causa real e manda a pessoa
    // trocar uma senha que está certa.
    if (e instanceof AuthError) return { erro: ERRO_INDISPONIVEL };
    throw e; // o redirecionamento de sucesso é lançado como erro e precisa subir
  }
  return {};
}
