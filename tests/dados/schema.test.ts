// Os testes de banco rodam contra um Postgres EMBUTIDO (pglite): Postgres de verdade dentro do
// Node, sem Docker. A aplicação usa o node-postgres (cliente.ts); as migrações, o schema e a carga
// são os mesmos nos dois. Quando houver um Postgres real, `npx drizzle-kit migrate && tsx
// scripts/semear.ts` exercita exatamente este schema.
import { PGlite } from '@electric-sql/pglite';
import { sql } from 'drizzle-orm';
import { drizzle, type PgliteDatabase } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { colapsarSinonimos, semear } from '../../scripts/semear.js';
import * as schema from '../../src/dados/schema.js';
import type { SinonimoFixture } from '../../src/motor/tipos.js';

// Regra pura, sem banco.
describe('carga: de-duplicação de sinônimos', () => {
  it('colapsa chave repetida com o mesmo código, com aviso', () => {
    const lista: SinonimoFixture[] = [
      { nomeOriginal: 'ISS A PAGAR', chaveNormalizada: 'ISS PAGAR', codigoReduzido: '237' },
      { nomeOriginal: 'ISS PAGAR', chaveNormalizada: 'ISS PAGAR', codigoReduzido: '237' },
      { nomeOriginal: 'OUTRA', chaveNormalizada: 'OUTRA', codigoReduzido: '10' },
    ];
    const r = colapsarSinonimos(lista);
    expect(r.inseridos).toHaveLength(2);
    expect(r.colapsados).toBe(1);
  });

  it('aborta chave repetida com código diferente', () => {
    const lista: SinonimoFixture[] = [
      { nomeOriginal: 'A', chaveNormalizada: 'X', codigoReduzido: '1' },
      { nomeOriginal: 'B', chaveNormalizada: 'X', codigoReduzido: '2' },
    ];
    expect(() => colapsarSinonimos(lista)).toThrow(/códigos diferentes/);
  });
});

describe('schema e carga (Postgres embutido)', () => {
  let cliente: PGlite;
  let banco: PgliteDatabase<typeof schema>;

  beforeAll(async () => {
    cliente = new PGlite();
    banco = drizzle(cliente, { schema });
    await migrate(banco, { migrationsFolder: 'drizzle' });
  });

  afterAll(async () => {
    await cliente.close();
  });

  beforeEach(async () => {
    await banco.execute(sql`TRUNCATE TABLE
      auditoria, conta_criada, implantacao_linha, implantacao,
      alteracao_sinonimo, sinonimo_evento, sinonimo,
      regra_natureza, regra_normalizacao, plano_conta, plano_versao, usuario
      RESTART IDENTITY CASCADE`);
  });

  it('migrações aplicam em banco vazio', async () => {
    expect(await banco.select().from(schema.usuario)).toEqual([]);
  });

  it('só uma versão de plano pode estar vigente', async () => {
    await banco.insert(schema.planoVersao).values({ nome: 'v1', vigente: true });
    await expect(
      banco.insert(schema.planoVersao).values({ nome: 'v2', vigente: true }),
    ).rejects.toThrow();
  });

  it('sinônimo ativo é único por chave normalizada e versão de plano', async () => {
    const [v] = await banco
      .insert(schema.planoVersao)
      .values({ nome: 'v', vigente: true })
      .returning({ id: schema.planoVersao.id });
    await banco
      .insert(schema.sinonimo)
      .values({ planoVersaoId: v.id, nomeOriginal: 'A', chaveNormalizada: 'K', codigoReduzido: '1' });
    await expect(
      banco
        .insert(schema.sinonimo)
        .values({ planoVersaoId: v.id, nomeOriginal: 'B', chaveNormalizada: 'K', codigoReduzido: '2' }),
    ).rejects.toThrow();
  });

  it('sinônimo arquivado não conflita com o ativo de mesma chave', async () => {
    const [v] = await banco
      .insert(schema.planoVersao)
      .values({ nome: 'v', vigente: true })
      .returning({ id: schema.planoVersao.id });
    await banco.insert(schema.sinonimo).values({
      planoVersaoId: v.id,
      nomeOriginal: 'A',
      chaveNormalizada: 'K',
      codigoReduzido: '1',
      status: 'arquivado',
    });
    await expect(
      banco.insert(schema.sinonimo).values({
        planoVersaoId: v.id,
        nomeOriginal: 'B',
        chaveNormalizada: 'K',
        codigoReduzido: '1',
        status: 'ativo',
      }),
    ).resolves.toBeDefined();
  });

  it('a pessoa pode ter várias implantações em andamento (uma por empresa)', async () => {
    const [u] = await banco
      .insert(schema.usuario)
      .values({ oidEntra: 'oid-1', email: 'a@b.c', nome: 'A' })
      .returning({ id: schema.usuario.id });
    await banco.insert(schema.implantacao).values({ usuarioId: u.id, status: 'em_andamento' });
    await banco.insert(schema.implantacao).values({ usuarioId: u.id, status: 'em_andamento' });
    const abertas = await banco
      .select()
      .from(schema.implantacao)
      .where(sql`${schema.implantacao.status} = 'em_andamento'`);
    expect(abertas).toHaveLength(2);
  });

  it('sinonimo_evento é imutável: UPDATE e DELETE são barrados', async () => {
    const [v] = await banco
      .insert(schema.planoVersao)
      .values({ nome: 'v', vigente: true })
      .returning({ id: schema.planoVersao.id });
    const [s] = await banco
      .insert(schema.sinonimo)
      .values({ planoVersaoId: v.id, nomeOriginal: 'A', chaveNormalizada: 'K', codigoReduzido: '1' })
      .returning({ id: schema.sinonimo.id });
    await banco.insert(schema.sinonimoEvento).values({ sinonimoId: s.id, tipo: 'criado', codigoPara: '1' });
    await expect(banco.update(schema.sinonimoEvento).set({ motivo: 'x' })).rejects.toThrow();
    await expect(banco.delete(schema.sinonimoEvento)).rejects.toThrow();
  });

  it('carga inicial grava 711 contas, 1386 sinônimos, 182 regras de normalização e 25 de natureza', async () => {
    const r = await semear(banco);
    expect(r).toMatchObject({ contas: 711, sinonimos: 1386, normalizacao: 182, natureza: 25, colapsados: 1 });
    expect(await banco.select().from(schema.planoConta)).toHaveLength(711);
    expect(await banco.select().from(schema.sinonimo)).toHaveLength(1386);
  });
});
