// Leitura das regras de normalização e natureza da versão vigente, nos tipos do motor.
import { eq } from 'drizzle-orm';
import type { PgDatabase } from 'drizzle-orm/pg-core';
import type { RegraNatureza, RegraNormalizacao } from '../motor/tipos.js';
import { db } from './cliente.js';
import { planoVersao, regraNatureza, regraNormalizacao } from './schema.js';

type Banco = PgDatabase<any, any, any>;

async function idVigente(banco: Banco): Promise<number> {
  const [v] = await banco
    .select({ id: planoVersao.id })
    .from(planoVersao)
    .where(eq(planoVersao.vigente, true))
    .limit(1);
  if (v === undefined) throw new Error('Nenhuma versão de plano vigente.');
  return v.id;
}

/**
 * Regras da versão vigente. `natureza` é a tabela COSIF (conta de ORIGEM); `naturezaDominio` é a
 * tabela do plano Domínio (conta de DESTINO). Ver src/motor/natureza.ts.
 */
export async function carregarRegras(banco: Banco = db()): Promise<{
  normalizacao: RegraNormalizacao[];
  natureza: RegraNatureza[];
  naturezaDominio: RegraNatureza[];
}> {
  const vid = await idVigente(banco);
  const norm = await banco
    .select()
    .from(regraNormalizacao)
    .where(eq(regraNormalizacao.planoVersaoId, vid));
  const nat = await banco.select().from(regraNatureza).where(eq(regraNatureza.planoVersaoId, vid));
  const paraMotor = (r: (typeof nat)[number]): RegraNatureza => ({
    ordem: r.ordem,
    prefixo: r.prefixoClassificacao,
    grupoCosif: r.grupoCosif,
    natureza: r.natureza,
    gruposDominio: r.gruposDominio,
    naoMigrar: r.naoMigrar,
    conjunto: r.conjunto === 'dominio' ? 'dominio' : 'cosif',
  });
  return {
    normalizacao: norm.map((r) => ({
      etapa: r.etapa as 1 | 2,
      ordem: r.ordem,
      de: r.de,
      para: r.para,
    })),
    natureza: nat.filter((r) => r.conjunto !== 'dominio').map(paraMotor),
    naturezaDominio: nat.filter((r) => r.conjunto === 'dominio').map(paraMotor),
  };
}
