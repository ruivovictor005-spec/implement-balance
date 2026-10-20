// Cronômetro da implantação. O tempo TOTAL é conclusão menos início. O tempo ATIVO é derivado da
// auditoria: soma dos intervalos entre ações consecutivas, ignorando os maiores que 10 minutos
// (quando a pessoa largou a tela). Sem pausas, o ativo é igual ao total.
import { and, asc, eq } from 'drizzle-orm';
import type { PgDatabase } from 'drizzle-orm/pg-core';
import { auditoria } from './schema.js';

const LIMITE_PAUSA_SEGUNDOS = 600;

export function tempoTotalSegundos(iniciadaEm: Date, concluidaEm: Date): number {
  return Math.round((concluidaEm.getTime() - iniciadaEm.getTime()) / 1000);
}

export async function tempoAtivoSegundos(
  banco: PgDatabase<any, any, any>,
  implantacaoId: number,
): Promise<number> {
  const eventos = await banco
    .select({ em: auditoria.criadoEm })
    .from(auditoria)
    .where(and(eq(auditoria.entidade, 'implantacao'), eq(auditoria.entidadeId, String(implantacaoId))))
    .orderBy(asc(auditoria.criadoEm));

  let total = 0;
  for (let i = 1; i < eventos.length; i++) {
    const gap = (eventos[i].em.getTime() - eventos[i - 1].em.getTime()) / 1000;
    if (gap <= LIMITE_PAUSA_SEGUNDOS) total += gap;
  }
  return Math.round(total);
}
