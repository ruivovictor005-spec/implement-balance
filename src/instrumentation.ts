// O Next compila este arquivo para os dois runtimes (nodejs e edge). O banco embutido (pglite) usa
// módulos que só existem no Node e só faz sentido em desenvolvimento (sem DATABASE_URL), então fica
// num módulo à parte, importado dinamicamente. Em produção (com DATABASE_URL) nada é inicializado.
// Qualquer falha aqui é registrada, mas NUNCA derruba o app — senão todas as rotas dariam 500.
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  if (process.env.DATABASE_URL) return; // produção: usa Postgres; nada a inicializar aqui
  try {
    await import('./instrumentation.node.js');
  } catch (e) {
    console.error(
      '[instrumentation] não consegui iniciar o banco embutido (pglite). ' +
        'Em produção, defina DATABASE_URL. Detalhe:',
      e,
    );
  }
}
