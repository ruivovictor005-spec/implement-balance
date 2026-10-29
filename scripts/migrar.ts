// Aplica as migrações do diretório drizzle/ no Postgres de produção (DATABASE_URL).
// Use a conexão DIRETA do Neon (não a "-pooler") para rodar DDL. Ex.: npm run db:migrate
import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';

const { Pool } = pg;

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (url === undefined || url === '') {
    console.error('Defina DATABASE_URL (a conexão do Postgres).');
    process.exit(1);
  }
  const pool = new Pool({ connectionString: url });
  try {
    await migrate(drizzle(pool), { migrationsFolder: 'drizzle' });
    console.log('migrações aplicadas com sucesso.');
  } finally {
    await pool.end();
  }
}

void main();
