// Configuração do Auth.js SEGURA para o middleware (edge): sem provedores e sem banco. Guarda a
// identidade na sessão JWT (id, nome e papel do usuário), definida no login pelo provedor em auth.ts.
import type { NextAuthConfig } from 'next-auth';

export const authConfig = {
  pages: { signIn: '/entrar' },
  session: { strategy: 'jwt' },
  providers: [],
  callbacks: {
    authorized({ auth: sessao }) {
      return Boolean(sessao?.user);
    },
    jwt({ token, user }) {
      if (user) {
        const u = user as { id?: string; name?: string | null; papel?: string };
        token.uid = u.id !== undefined ? Number(u.id) : token.uid;
        token.nome = u.name ?? token.nome;
        token.papel = u.papel ?? token.papel;
      }
      return token;
    },
    session({ session, token }) {
      const s = session as unknown as Record<string, unknown>;
      s.uid = token.uid;
      s.papel = token.papel;
      if (session.user && typeof token.nome === 'string') session.user.name = token.nome;
      return session;
    },
  },
} satisfies NextAuthConfig;
