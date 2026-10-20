// Leitura dos sinônimos ativos da versão vigente, no formato que o motor consome.
import { and, eq } from 'drizzle-orm';
import type { PgDatabase } from 'drizzle-orm/pg-core';
import { db } from './cliente.js';
import { planoVersao, sinonimo } from './schema.js';

export async function carregarSinonimos(
  banco: PgDatabase<any, any, any> = db(),
): Promise<Map<string, string>> {
  const linhas = await banco
    .select({ chave: sinonimo.chaveNormalizada, codigo: sinonimo.codigoReduzido })
    .from(sinonimo)
    .innerJoin(planoVersao, eq(sinonimo.planoVersaoId, planoVersao.id))
    .where(and(eq(planoVersao.vigente, true), eq(sinonimo.status, 'ativo')));
  return new Map(linhas.map((l) => [l.chave, l.codigo]));
}
