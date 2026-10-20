// Leitura das regras de normalização e natureza da versão vigente, nos tipos do motor.
import { eq } from 'drizzle-orm';
import type { RegraNatureza, RegraNormalizacao } from '../motor/tipos.js';
import { db, type Banco } from './cliente.js';
import { planoVersao, regraNatureza, regraNormalizacao } from './schema.js';

async function idVigente(banco: Banco): Promise<number> {
  const [v] = await banco
    .select({ id: planoVersao.id })
    .from(planoVersao)
    .where(eq(planoVersao.vigente, true))
    .limit(1);
  if (v === undefined) throw new Error('Nenhuma versão de plano vigente.');
  return v.id;
}

export async function carregarRegras(
  banco: Banco = db(),
): Promise<{ normalizacao: RegraNormalizacao[]; natureza: RegraNatureza[] }> {
  const vid = await idVigente(banco);
  const norm = await banco
    .select()
    .from(regraNormalizacao)
    .where(eq(regraNormalizacao.planoVersaoId, vid));
  const nat = await banco.select().from(regraNatureza).where(eq(regraNatureza.planoVersaoId, vid));
  return {
    normalizacao: norm.map((r) => ({
      etapa: r.etapa as 1 | 2,
      ordem: r.ordem,
      de: r.de,
      para: r.para,
    })),
    natureza: nat.map((r) => ({
      ordem: r.ordem,
      prefixo: r.prefixoClassificacao,
      grupoCosif: r.grupoCosif,
      natureza: r.natureza,
      gruposDominio: r.gruposDominio,
      naoMigrar: r.naoMigrar,
    })),
  };
}
