import { eq } from 'drizzle-orm';
import type { PgliteDatabase } from 'drizzle-orm/pglite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as schema from '../../src/dados/schema.js';
import { registrarEntrada } from '../../src/dados/usuarios.js';
import { criarBancoTeste } from '../apoio/banco.js';

describe('entrada pela conta Microsoft', () => {
  let banco: PgliteDatabase<typeof schema>;
  let fechar: () => Promise<void>;

  beforeEach(async () => {
    ({ banco, fechar } = await criarBancoTeste());
  });
  afterEach(async () => {
    await fechar();
  });

  it('primeira pessoa a entrar vira administradora', async () => {
    const u = await registrarEntrada(banco, { oid: 'oid-1', email: 'a@x.com', nome: 'Ana' });
    expect(u.papel).toBe('admin');
  });

  it('a segunda pessoa entra como usuária comum', async () => {
    await registrarEntrada(banco, { oid: 'oid-1', email: 'a@x.com', nome: 'Ana' });
    const u2 = await registrarEntrada(banco, { oid: 'oid-2', email: 'b@x.com', nome: 'Bia' });
    expect(u2.papel).toBe('usuario');
  });

  it('entrada cria o usuário na primeira vez e atualiza na segunda', async () => {
    const u1 = await registrarEntrada(banco, { oid: 'oid-1', email: 'a@x.com', nome: 'Ana' });
    const u2 = await registrarEntrada(banco, { oid: 'oid-1', email: 'nova@x.com', nome: 'Ana Maria' });
    expect(u2.id).toBe(u1.id);
    expect(u2.email).toBe('nova@x.com');
    expect(u2.nome).toBe('Ana Maria');
    expect(await banco.select().from(schema.usuario)).toHaveLength(1);
  });

  it('entrada grava registro de auditoria com data e origem', async () => {
    const u = await registrarEntrada(banco, { oid: 'oid-1', email: 'a@x.com', nome: 'Ana' });
    const [reg] = await banco
      .select()
      .from(schema.auditoria)
      .where(eq(schema.auditoria.acao, 'entrada'));
    expect(reg).toBeDefined();
    expect(reg.criadoEm).toBeInstanceOf(Date);
    expect(reg.detalhes).toMatchObject({ origem: 'microsoft-entra-id' });
    expect(reg.entidadeId).toBe(String(u.id));
  });

  it('conta sem oid é recusada', async () => {
    await expect(
      registrarEntrada(banco, { oid: '', email: 'x@x.com', nome: 'X' }),
    ).rejects.toThrow();
  });
});
