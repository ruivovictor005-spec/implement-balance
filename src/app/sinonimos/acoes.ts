'use server';

// Ações de servidor da base de sinônimos: delegam para a camada de dados, resolvendo quem está
// logado. Leituras para a tela (pendentes de revisão e histórico de eventos).
import { desc, eq } from 'drizzle-orm';
import { auth } from '../../acesso/auth.js';
import { db } from '../../dados/cliente.js';
import {
  decidirAlteracao as decidirNoBanco,
  desfazer as desfazerNoBanco,
  ensinarSinonimo as ensinarNoBanco,
  solicitarAlteracao as solicitarNoBanco,
} from '../../dados/sinonimos.js';
import { alteracaoSinonimo, sinonimo, sinonimoEvento } from '../../dados/schema.js';

async function usuarioAtualId(): Promise<number> {
  const sessao = await auth();
  const uid = (sessao as { uid?: number } | null)?.uid;
  if (uid === undefined || uid === null) throw new Error('Não autenticado.');
  return uid;
}

export async function ensinar(nomeOriginal: string, codigo: string, motivo: string) {
  return ensinarNoBanco(db(), { nomeOriginal, codigo, motivo, usuarioId: await usuarioAtualId() });
}

export async function solicitar(sinonimoId: number, codigoProposto: string, motivo: string) {
  return solicitarNoBanco(db(), {
    sinonimoId,
    codigoProposto,
    motivo,
    usuarioId: await usuarioAtualId(),
  });
}

export async function decidir(id: number, aprovada: boolean, observacao: string) {
  return decidirNoBanco(db(), id, aprovada, observacao, await usuarioAtualId());
}

export async function desfazer(eventoId: number) {
  return desfazerNoBanco(db(), eventoId, await usuarioAtualId());
}

export type PedidoPendente = {
  id: number;
  nomeOriginal: string;
  codigoAtual: string;
  codigoProposto: string;
  motivo: string | null;
};

export async function listarPendentes(): Promise<PedidoPendente[]> {
  await usuarioAtualId();
  const linhas = await db()
    .select({
      id: alteracaoSinonimo.id,
      nomeOriginal: sinonimo.nomeOriginal,
      codigoAtual: sinonimo.codigoReduzido,
      codigoProposto: alteracaoSinonimo.codigoProposto,
      motivo: alteracaoSinonimo.motivo,
    })
    .from(alteracaoSinonimo)
    .innerJoin(sinonimo, eq(alteracaoSinonimo.sinonimoId, sinonimo.id))
    .where(eq(alteracaoSinonimo.status, 'pendente'))
    .orderBy(desc(alteracaoSinonimo.id));
  return linhas;
}

export type EventoRecente = {
  id: number;
  tipo: string;
  nomeOriginal: string;
  codigoDe: string | null;
  codigoPara: string | null;
};

export async function listarEventos(limite = 30): Promise<EventoRecente[]> {
  await usuarioAtualId();
  const linhas = await db()
    .select({
      id: sinonimoEvento.id,
      tipo: sinonimoEvento.tipo,
      nomeOriginal: sinonimo.nomeOriginal,
      codigoDe: sinonimoEvento.codigoDe,
      codigoPara: sinonimoEvento.codigoPara,
    })
    .from(sinonimoEvento)
    .innerJoin(sinonimo, eq(sinonimoEvento.sinonimoId, sinonimo.id))
    .orderBy(desc(sinonimoEvento.id))
    .limit(limite);
  return linhas.map((l) => ({ ...l, id: Number(l.id) }));
}
