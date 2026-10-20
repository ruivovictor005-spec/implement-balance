// Configuração do Auth.js (NextAuth v5) com o provedor Microsoft Entra ID. Sem segredos no código:
// `clientId`, `clientSecret` e `issuer` vêm das variáveis AUTH_MICROSOFT_ENTRA_ID_* (o Auth.js as lê
// por convenção). Este arquivo é seguro para o middleware (edge): não toca no banco.
import NextAuth from 'next-auth';
import MicrosoftEntraID from 'next-auth/providers/microsoft-entra-id';

// Enquanto a TI não devolve o registro do app, o provedor fica sem credencial. Nesse estado de
// desenvolvimento o middleware libera o acesso, para a tela continuar usável localmente.
const entraConfigurado = Boolean(process.env.AUTH_MICROSOFT_ENTRA_ID_ID);

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: entraConfigurado
    ? [MicrosoftEntraID({ authorization: { params: { scope: 'openid profile email User.Read' } } })]
    : [],
  pages: { signIn: '/entrar' },
  callbacks: {
    authorized({ auth: sessao }) {
      if (!entraConfigurado) return true; // dev sem provedor: não trava a tela
      return Boolean(sessao?.user);
    },
    // Carrega o `oid` do Entra para a sessão: é a identidade estável da pessoa (nunca o e-mail).
    jwt({ token, profile }) {
      const oid = (profile as { oid?: unknown } | undefined)?.oid;
      if (typeof oid === 'string') (token as Record<string, unknown>).oid = oid;
      return token;
    },
    session({ session, token }) {
      const oid = (token as Record<string, unknown>).oid;
      (session as unknown as Record<string, unknown>).oid = typeof oid === 'string' ? oid : undefined;
      return session;
    },
  },
});
