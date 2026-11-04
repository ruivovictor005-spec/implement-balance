'use server';
import { auth } from '../../acesso/auth.js';
import { db } from '../../dados/cliente.js';
import { reabrirImplantacao, type ResultadoImplantacao } from '../../dados/implantacoes.js';
import {
  exportarConcluidas as exportarNoBanco,
  listarConcluidas as listarNoBanco,
  type ConcluidaResumo,
} from '../implantacao/concluir.js';

export type ConcluidaNaLista = ConcluidaResumo & { minha: boolean };

async function usuarioAtualId(): Promise<number> {
  const sessao = await auth();
  const uid = (sessao as { uid?: number } | null)?.uid;
  if (uid === undefined || uid === null) throw new Error('Não autenticado.');
  return uid;
}

/** Todas as concluídas, marcando as de quem está logado (só essas podem ser abertas/reabertas). */
export async function listarConcluidas(): Promise<ConcluidaNaLista[]> {
  const uid = await usuarioAtualId();
  return (await listarNoBanco(db())).map((c) => ({ ...c, minha: c.usuarioId === uid }));
}

export async function exportarConcluidas(): Promise<Uint8Array> {
  await usuarioAtualId();
  return exportarNoBanco(db());
}

/** Reabre uma implantação concluída da pessoa para correção. */
export async function reabrirConcluida(id: number): Promise<ResultadoImplantacao> {
  return reabrirImplantacao(db(), id, await usuarioAtualId());
}
