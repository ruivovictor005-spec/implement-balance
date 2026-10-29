// Conexão com o banco. Só o servidor usa este módulo (não é puro: lê ambiente e abre socket).
// Em produção, `db()` usa Postgres (DATABASE_URL). Em desenvolvimento sem DATABASE_URL, o banco
// embutido (pglite) é montado pelo instrumentation e registrado aqui por `definirBanco`.
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { PgDatabase } from 'drizzle-orm/pg-core';
import pg from 'pg';
import * as schema from './schema.js';

// `pg` é CommonJS: o import default + destructuring funciona tanto no bundler do Next quanto no Node
// puro (tsx/scripts), ao contrário do `import { Pool } from 'pg'`.
const { Pool } = pg;

export type Banco = PgDatabase<any, typeof schema, any>;

// Guardado em globalThis: no Next, o instrumentation e as rotas vivem em bundles diferentes; um
// singleton de módulo não é compartilhado entre eles, mas o globalThis do processo é.
const global = globalThis as unknown as { __bancoApp?: Banco };

export function db(): Banco {
  if (global.__bancoApp !== undefined) return global.__bancoApp;
  const url = process.env.DATABASE_URL;
  if (url === undefined || url === '') {
    throw new Error(
      'Banco não inicializado. Em desenvolvimento ele sobe pelo instrumentation (pglite); em produção defina DATABASE_URL.',
    );
  }
  global.__bancoApp = drizzle(new Pool({ connectionString: url }), { schema });
  return global.__bancoApp;
}

/** Registra o banco já pronto (usado pela inicialização do banco embutido em desenvolvimento). */
export function definirBanco(b: Banco): void {
  global.__bancoApp = b;
}

/** Handle isolado com `fechar()` — para scripts (semear) que gerenciam o próprio ciclo de vida. */
export function criarBanco(url: string): {
  banco: NodePgDatabase<typeof schema>;
  fechar: () => Promise<void>;
} {
  const pool = new Pool({ connectionString: url });
  return { banco: drizzle(pool, { schema }), fechar: () => pool.end() };
}
