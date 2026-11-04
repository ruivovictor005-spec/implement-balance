'use server';

// Ações de servidor da base de sinônimos: delegam para a camada de dados, resolvendo quem está
// logado. Quem não é administrador só PROPÕE; decidir e desfazer ficam no painel /admin (e a camada
// de dados recusa de qualquer forma, mesmo que alguém chame a ação direto).
import { desc, eq } from 'drizzle-orm';
import { auth } from '../../acesso/auth.js';
import { db } from '../../dados/cliente.js';
import {
  desfazer as desfazerNoBanco,
  ehAdmin,
  ensinarSinonimo as ensinarNoBanco,
  listarMinhasPropostas,
  solicitarAlteracao as solicitarNoBanco,
  type MinhaProposta,
} from '../../dados/sinonimos.js';
import { sinonimo, sinonimoEvento } from '../../dados/schema.js';

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

export async function desfazer(eventoId: number) {
  return desfazerNoBanco(db(), eventoId, await usuarioAtualId());
}

/** O papel vem do banco (não do token), para valer na hora em que o administrador muda. */
export async function souAdmin(): Promise<boolean> {
  return ehAdmin(db(), await usuarioAtualId());
}

export async function minhasPropostas(): Promise<MinhaProposta[]> {
  return listarMinhasPropostas(db(), await usuarioAtualId());
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
