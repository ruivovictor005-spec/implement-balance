// Conexão com o banco. Só o servidor usa este módulo (não é puro: lê ambiente e abre socket).
// Em produção, `db()` usa Postgres (DATABASE_URL). Em desenvolvimento sem DATABASE_URL, o banco
// embutido (pglite) é montado pelo instrumentation e registrado aqui por `definirBanco`.
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { PgDatabase } from 'drizzle-orm/pg-core';
import { Pool } from 'pg';
import * as schema from './schema.js';

export type Banco = PgDatabase<any, typeof schema, any>;

let banco: Banco | undefined;

export function db(): Banco {
  if (banco !== undefined) return banco;
  const url = process.env.DATABASE_URL;
  if (url === undefined || url === '') {
    throw new Error(
      'Banco não inicializado. Em desenvolvimento ele sobe pelo instrumentation (pglite); em produção defina DATABASE_URL.',
    );
  }
  banco = drizzle(new Pool({ connectionString: url }), { schema });
  return banco;
}

/** Registra o banco já pronto (usado pela inicialização do banco embutido em desenvolvimento). */
export function definirBanco(b: Banco): void {
  banco = b;
}

/** Handle isolado com `fechar()` — para scripts (semear) que gerenciam o próprio ciclo de vida. */
export function criarBanco(url: string): {
  banco: NodePgDatabase<typeof schema>;
  fechar: () => Promise<void>;
} {
  const pool = new Pool({ connectionString: url });
  return { banco: drizzle(pool, { schema }), fechar: () => pool.end() };
}
