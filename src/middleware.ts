// Exige sessão em tudo, menos a página de entrada, as rotas do Auth.js, a saúde e os estáticos.
export { auth as middleware } from './acesso/auth.js';

export const config = {
  matcher: ['/((?!entrar|api/auth|api/saude|_next/static|_next/image|favicon.ico).*)'],
};
