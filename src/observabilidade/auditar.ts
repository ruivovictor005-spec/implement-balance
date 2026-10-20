// Registro de auditoria: quem fez o quê, quando. Append-only (a tabela nunca é alterada).
import type { PgDatabase } from 'drizzle-orm/pg-core';
import { auditoria } from '../dados/schema.js';

export type Acao = {
  usuarioId?: number | null;
  acao: string;
  entidade?: string | null;
  entidadeId?: string | null;
  detalhes?: unknown;
  ip?: string | null;
};

export async function auditar(banco: PgDatabase<any, any, any>, acao: Acao): Promise<void> {
  await banco.insert(auditoria).values({
    usuarioId: acao.usuarioId ?? null,
    acao: acao.acao,
    entidade: acao.entidade ?? null,
    entidadeId: acao.entidadeId ?? null,
    detalhes: acao.detalhes ?? null,
    ip: acao.ip ?? null,
  });
}
