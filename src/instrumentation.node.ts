// Inicialização do banco embutido (pglite) em desenvolvimento. Só é carregado no runtime nodejs
// (ver instrumentation.ts): aplica as migrações e faz a carga inicial se o banco estiver vazio.
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { PGlite } from '@electric-sql/pglite';
import { definirBanco } from './dados/cliente.js';
import * as schema from './dados/schema.js';

const cliente = new PGlite('./.pglite-dev');
const banco = drizzle(cliente, { schema });
await migrate(banco, { migrationsFolder: 'drizzle' });

const [{ total }] = await banco
  .select({ total: sql<number>`count(*)::int` })
  .from(schema.planoVersao);
if (Number(total) === 0) {
  const { semear } = await import('../scripts/semear.js');
  const r = await semear(banco);
  console.log(`[dev] banco embutido semeado: ${r.contas} contas, ${r.sinonimos} sinônimos`);
}

definirBanco(banco);
console.log('[dev] banco embutido (pglite) pronto em ./.pglite-dev');
