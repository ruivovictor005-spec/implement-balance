'use server';
// Dados do painel de supervisão — restrito a revisor/admin. Usuário comum recebe { autorizado:false }.
import { auth } from '../../acesso/auth.js';
import { podeRevisar } from '../../acesso/papeis.js';
import { db } from '../../dados/cliente.js';
import { listarConcluidas, type ConcluidaResumo } from '../implantacao/concluir.js';

export async function dadosPainel(): Promise<{ autorizado: boolean; lista: ConcluidaResumo[] }> {
  const sessao = await auth();
  const papel = (sessao as { papel?: string } | null)?.papel ?? 'usuario';
  if (!podeRevisar({ papel })) return { autorizado: false, lista: [] };
  return { autorizado: true, lista: await listarConcluidas(db()) };
}
