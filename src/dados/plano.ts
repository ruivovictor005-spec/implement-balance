// Leitura do plano de contas vigente, no tipo que o motor consome.
import { eq } from 'drizzle-orm';
import type { ContaPlano } from '../motor/tipos.js';
import { db, type Banco } from './cliente.js';
import { planoConta, planoVersao } from './schema.js';

export async function carregarPlanoVigente(banco: Banco = db()): Promise<ContaPlano[]> {
  const linhas = await banco
    .select({
      codigoReduzido: planoConta.codigoReduzido,
      classificacao: planoConta.classificacao,
      descricao: planoConta.descricao,
      tipo: planoConta.tipo,
      descricaoNormalizada: planoConta.descricaoNormalizada,
    })
    .from(planoConta)
    .innerJoin(planoVersao, eq(planoConta.planoVersaoId, planoVersao.id))
    .where(eq(planoVersao.vigente, true));
  return linhas.map((l) => ({ ...l }));
}
