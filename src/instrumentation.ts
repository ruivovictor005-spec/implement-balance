// O Next compila este arquivo para os dois runtimes (nodejs e edge). O banco embutido usa módulos
// que só existem no Node (node:crypto, fs), então a inicialização fica num módulo à parte, importado
// dinamicamente apenas no runtime nodejs e só em desenvolvimento (sem DATABASE_URL).
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === 'nodejs' && !process.env.DATABASE_URL) {
    await import('./instrumentation.node.js');
  }
}
