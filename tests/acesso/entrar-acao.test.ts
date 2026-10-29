import { CallbackRouteError, CredentialsSignin } from '@auth/core/errors';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// A ação de entrar só orquestra o signIn do Auth.js; aqui o signIn é um esboço, para o teste não
// arrastar o grafo do servidor (banco, provedores).
const signIn = vi.fn();
vi.mock('../../src/acesso/auth.js', () => ({ signIn: (...a: unknown[]) => signIn(...a) }));

// O pacote `next-auth` carrega o runtime do Next só para ser importado; aqui ele é reduzido às
// classes de erro, que são as mesmas de `@auth/core/errors` que o teste lança — por isso o
// `instanceof` da ação continua valendo.
vi.mock('next-auth', async () => {
  const { AuthError, CredentialsSignin } = await import('@auth/core/errors');
  return { AuthError, CredentialsSignin };
});

import { ERRO_INDISPONIVEL } from '../../src/acesso/mensagens.js';
import * as acoes from '../../src/app/entrar/acoes.js';
import { entrarAcao } from '../../src/app/entrar/acoes.js';

it('o módulo de ações só exporta funções (regra do "use server")', () => {
  // O Next recusa em runtime um arquivo `'use server'` que exporte qualquer coisa que não seja
  // função async — e a recusa só aparece ao abrir a tela, não na suíte. Daí este teste.
  for (const [nome, valor] of Object.entries(acoes)) {
    expect(typeof valor, `export "${nome}"`).toBe('function');
  }
});

describe('ação de entrar: distinguir credencial errada de falha técnica', () => {
  beforeEach(() => {
    signIn.mockReset();
  });

  it('credencial errada (authorize devolveu null) avisa que e-mail ou senha estão inválidos', async () => {
    signIn.mockRejectedValue(new CredentialsSignin());
    expect(await entrarAcao('a@x.com', 'errada')).toEqual({ erro: 'E-mail ou senha inválidos.' });
  });

  it('banco inacessível NÃO é reportado como senha inválida', async () => {
    const dns = new Error('getaddrinfo ENOTFOUND base');
    signIn.mockRejectedValue(new CallbackRouteError(dns, { provider: 'credentials' }));

    const r = await entrarAcao('a@x.com', 'certa');

    expect(r.erro).toBe(ERRO_INDISPONIVEL);
    expect(r.erro).not.toContain('senha inválidos');
  });

  it('o redirecionamento de sucesso continua subindo', async () => {
    const redirecionamento = new Error('NEXT_REDIRECT');
    signIn.mockRejectedValue(redirecionamento);
    await expect(entrarAcao('a@x.com', 'certa')).rejects.toBe(redirecionamento);
  });

  it('sem erro nenhum, a ação não devolve mensagem', async () => {
    signIn.mockResolvedValue(undefined);
    expect(await entrarAcao('a@x.com', 'certa')).toEqual({});
  });
});
