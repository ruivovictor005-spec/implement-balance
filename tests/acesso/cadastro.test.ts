import type { PgliteDatabase } from 'drizzle-orm/pglite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  autenticar,
  cadastrarUsuario,
  redefinirSenha,
  solicitarRecuperacao,
} from '../../src/dados/usuarios.js';
import { conferirSenha, criarHashSenha } from '../../src/acesso/senha.js';
import * as schema from '../../src/dados/schema.js';
import { criarBancoTeste } from '../apoio/banco.js';

describe('cadastro, login e recuperação de senha', () => {
  let banco: PgliteDatabase<typeof schema>;
  let fechar: () => Promise<void>;

  beforeEach(async () => {
    ({ banco, fechar } = await criarBancoTeste());
  });
  afterEach(async () => {
    await fechar();
  });

  const dados = { nome: 'Ana Cláudia Vieira', email: 'ANA@corp.com', senha: 'segredo123' };

  it('a senha é guardada só como hash (nunca em texto puro)', () => {
    const h = criarHashSenha('segredo123');
    expect(h).not.toContain('segredo123');
    expect(conferirSenha('segredo123', h)).toBe(true);
    expect(conferirSenha('errada', h)).toBe(false);
  });

  it('cadastra guardando e-mail em minúsculas e a 1ª conta vira admin', async () => {
    const u = await cadastrarUsuario(banco, dados);
    expect(u.email).toBe('ana@corp.com');
    expect(u.nome).toBe('Ana Cláudia Vieira');
    expect(u.papel).toBe('admin');
    expect(u.senhaHash).not.toBeNull();
  });

  it('não deixa cadastrar o mesmo e-mail duas vezes (ignora maiúsculas)', async () => {
    await cadastrarUsuario(banco, dados);
    await expect(cadastrarUsuario(banco, { ...dados, email: 'ana@CORP.com' })).rejects.toThrow(/já existe/i);
  });

  it('exige nome completo, e-mail válido e senha de 8+ caracteres', async () => {
    await expect(cadastrarUsuario(banco, { ...dados, nome: 'Ana' })).rejects.toThrow(/nome completo/i);
    await expect(cadastrarUsuario(banco, { ...dados, email: 'semarroba' })).rejects.toThrow(/e-mail/i);
    await expect(cadastrarUsuario(banco, { ...dados, senha: 'curta' })).rejects.toThrow(/8/);
  });

  it('autentica com a senha certa e recusa a errada', async () => {
    await cadastrarUsuario(banco, dados);
    expect(await autenticar(banco, 'ana@corp.com', 'segredo123')).not.toBeNull();
    expect(await autenticar(banco, 'ana@corp.com', 'errada')).toBeNull();
    expect(await autenticar(banco, 'naoexiste@corp.com', 'segredo123')).toBeNull();
  });

  it('recuperação: nome+e-mail geram um código que redefine a senha', async () => {
    await cadastrarUsuario(banco, dados);
    const pedido = await solicitarRecuperacao(banco, 'Ana Cláudia Vieira', 'ana@corp.com');
    expect(pedido).not.toBeNull();
    const ok = await redefinirSenha(banco, 'ana@corp.com', pedido!.codigo, 'novaSenha123');
    expect(ok).toBe(true);
    expect(await autenticar(banco, 'ana@corp.com', 'novaSenha123')).not.toBeNull();
    expect(await autenticar(banco, 'ana@corp.com', 'segredo123')).toBeNull();
  });

  it('recuperação não vaza contas: nome errado não gera código', async () => {
    await cadastrarUsuario(banco, dados);
    expect(await solicitarRecuperacao(banco, 'Outro Nome', 'ana@corp.com')).toBeNull();
  });

  it('código errado não redefine a senha', async () => {
    await cadastrarUsuario(banco, dados);
    await solicitarRecuperacao(banco, 'Ana Cláudia Vieira', 'ana@corp.com');
    expect(await redefinirSenha(banco, 'ana@corp.com', '000000', 'novaSenha123')).toBe(false);
  });
});
