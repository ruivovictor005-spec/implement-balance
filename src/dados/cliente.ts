// Conexão com o Postgres. Só o servidor usa este módulo (não é puro: lê ambiente e abre socket).
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema.js';

export type Banco = NodePgDatabase<typeof schema>;

let banco: Banco | undefined;

/** Handle singleton da aplicação, a partir de `DATABASE_URL`. */
export function db(url = process.env.DATABASE_URL): Banco {
  if (banco) return banco;
  if (url === undefined || url === '') throw new Error('DATABASE_URL não definido.');
  banco = drizzle(new Pool({ connectionString: url }), { schema });
  return banco;
}

/** Handle isolado com `fechar()` — para scripts e testes que gerenciam o próprio ciclo de vida. */
export function criarBanco(url: string): { banco: Banco; fechar: () => Promise<void> } {
  const pool = new Pool({ connectionString: url });
  return { banco: drizzle(pool, { schema }), fechar: () => pool.end() };
}
