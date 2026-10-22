// Exige sessão em tudo, menos as telas de acesso (entrar/cadastro/recuperar/redefinir), as rotas do
// Auth.js, a saúde e os estáticos. Usa a config edge-safe (sem banco).
import NextAuth from 'next-auth';
import { authConfig } from './acesso/auth.config.js';

export const { auth: middleware } = NextAuth(authConfig);

export const config = {
  matcher: [
    '/((?!entrar|cadastro|recuperar|redefinir|api/auth|api/saude|_next/static|_next/image|favicon.ico).*)',
  ],
};
