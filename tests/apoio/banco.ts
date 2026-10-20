// Banco de teste embutido (pglite) já migrado, para os testes que precisam de Postgres de verdade
// sem Docker.
import { PGlite } from '@electric-sql/pglite';
import { drizzle, type PgliteDatabase } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import * as schema from '../../src/dados/schema.js';

export async function criarBancoTeste(): Promise<{
  banco: PgliteDatabase<typeof schema>;
  fechar: () => Promise<void>;
}> {
  const cliente = new PGlite();
  const banco = drizzle(cliente, { schema });
  await migrate(banco, { migrationsFolder: 'drizzle' });
  return { banco, fechar: () => cliente.close() };
}
