// Sobe o banco embutido (pglite) quando o site roda em desenvolvimento sem Postgres: aplica as
// migrações e, se estiver vazio, faz a carga inicial. Em produção (DATABASE_URL definido) não faz
// nada — o banco é o Postgres. O Next chama `register()` uma vez, antes de atender requisições.
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  if (process.env.DATABASE_URL) return;

  const { PGlite } = await import('@electric-sql/pglite');
  const { drizzle } = await import('drizzle-orm/pglite');
  const { migrate } = await import('drizzle-orm/pglite/migrator');
  const { sql } = await import('drizzle-orm');
  const schema = await import('./dados/schema.js');
  const { definirBanco } = await import('./dados/cliente.js');

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
}
