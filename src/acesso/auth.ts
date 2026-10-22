// Auth.js (NextAuth v5) com login por e-mail + senha (cadastro próprio). O provedor toca o banco,
// então este arquivo roda no Node (nunca no edge). O middleware usa auth.config.ts (sem banco).
import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { authConfig } from './auth.config.js';
import { db } from '../dados/cliente.js';
import { autenticar } from '../dados/usuarios.js';

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: { email: {}, senha: {} },
      authorize: async (cred) => {
        const email = typeof cred?.email === 'string' ? cred.email : '';
        const senha = typeof cred?.senha === 'string' ? cred.senha : '';
        if (email === '' || senha === '') return null;
        const u = await autenticar(db(), email, senha);
        if (u === null) return null;
        return { id: String(u.id), name: u.nome, email: u.email, papel: u.papel };
      },
    }),
  ],
});
