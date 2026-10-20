// Sinônimos da base compartilhada: leitura (para o motor) e as ações de ensinar, pedir alteração,
// decidir e desfazer. Todo efeito grava um `sinonimo_evento` (a tabela só cresce). A chave é sempre
// calculada com as regras vigentes, nunca com o texto cru digitado.
import { and, desc, eq } from 'drizzle-orm';
import type { PgDatabase } from 'drizzle-orm/pg-core';
import { podeRevisar } from '../acesso/papeis.js';
import { normalizarNome } from '../motor/normalizar.js';
import { db } from './cliente.js';
import { carregarRegras } from './regras.js';
import {
  alteracaoSinonimo,
  planoConta,
  planoVersao,
  sinonimo,
  sinonimoEvento,
  usuario,
} from './schema.js';

type Banco = PgDatabase<any, any, any>;
type Resultado<T = unknown> = ({ ok: true } & T) | { ok: false; erro: string };

export async function carregarSinonimos(
  banco: PgDatabase<any, any, any> = db(),
): Promise<Map<string, string>> {
  const linhas = await banco
    .select({ chave: sinonimo.chaveNormalizada, codigo: sinonimo.codigoReduzido })
    .from(sinonimo)
    .innerJoin(planoVersao, eq(sinonimo.planoVersaoId, planoVersao.id))
    .where(and(eq(planoVersao.vigente, true), eq(sinonimo.status, 'ativo')));
  return new Map(linhas.map((l) => [l.chave, l.codigo]));
}

async function idVigente(banco: Banco): Promise<number> {
  const [v] = await banco
    .select({ id: planoVersao.id })
    .from(planoVersao)
    .where(eq(planoVersao.vigente, true))
    .limit(1);
  if (v === undefined) throw new Error('Nenhuma versão de plano vigente.');
  return v.id;
}

/** Ensina um sinônimo novo na base vigente. Código fora do plano vigente entra como "fora do padrão". */
export async function ensinarSinonimo(
  banco: Banco,
  entrada: { nomeOriginal: string; codigo: string; motivo: string; usuarioId: number },
): Promise<Resultado<{ sinonimoId: number; aviso?: string }>> {
  if (entrada.motivo.trim() === '') return { ok: false, erro: 'Informe um motivo para ensinar.' };

  const vid = await idVigente(banco);
  const regras = await carregarRegras(banco);
  const chave = normalizarNome(entrada.nomeOriginal, regras.normalizacao);

  const [noVigente] = await banco
    .select({ id: planoConta.id })
    .from(planoConta)
    .where(and(eq(planoConta.planoVersaoId, vid), eq(planoConta.codigoReduzido, entrada.codigo)))
    .limit(1);
  let foraDoPadrao = false;
  let aviso: string | undefined;
  if (noVigente === undefined) {
    const [emAlgum] = await banco
      .select({ id: planoConta.id })
      .from(planoConta)
      .where(eq(planoConta.codigoReduzido, entrada.codigo))
      .limit(1);
    if (emAlgum === undefined) {
      return { ok: false, erro: `Código ${entrada.codigo} não existe em nenhum plano.` };
    }
    foraDoPadrao = true;
    aviso = `Código ${entrada.codigo} não está no plano vigente; marcado como fora do padrão.`;
  }

  try {
    const [s] = await banco
      .insert(sinonimo)
      .values({
        planoVersaoId: vid,
        nomeOriginal: entrada.nomeOriginal,
        chaveNormalizada: chave,
        codigoReduzido: entrada.codigo,
        foraDoPadrao,
        motivo: entrada.motivo,
      })
      .returning({ id: sinonimo.id });
    await banco.insert(sinonimoEvento).values({
      sinonimoId: s.id,
      tipo: 'criado',
      codigoPara: entrada.codigo,
      motivo: entrada.motivo,
      autorId: entrada.usuarioId,
    });
    return aviso === undefined ? { ok: true, sinonimoId: s.id } : { ok: true, sinonimoId: s.id, aviso };
  } catch {
    // Colisão do índice único (mesma chave ativa na mesma versão): traduz em mensagem.
    const [existe] = await banco
      .select({ cod: sinonimo.codigoReduzido })
      .from(sinonimo)
      .where(
        and(
          eq(sinonimo.chaveNormalizada, chave),
          eq(sinonimo.planoVersaoId, vid),
          eq(sinonimo.status, 'ativo'),
        ),
      )
      .limit(1);
    return { ok: false, erro: `Já existe sinônimo para este nome: ${existe?.cod ?? ''}` };
  }
}

/** Alterar um sinônimo existente não muda direto: cria um pedido pendente de revisão. */
export async function solicitarAlteracao(
  banco: Banco,
  entrada: {
    sinonimoId: number;
    codigoProposto: string;
    motivo: string;
    usuarioId: number;
    eventoConhecido?: number;
  },
): Promise<Resultado<{ alteracaoId: number }>> {
  if (entrada.eventoConhecido !== undefined) {
    const [ultimo] = await banco
      .select({ id: sinonimoEvento.id })
      .from(sinonimoEvento)
      .where(eq(sinonimoEvento.sinonimoId, entrada.sinonimoId))
      .orderBy(desc(sinonimoEvento.id))
      .limit(1);
    if (ultimo !== undefined && Number(ultimo.id) > entrada.eventoConhecido) {
      return { ok: false, erro: 'Este sinônimo foi alterado por outra pessoa; recarregue antes de salvar.' };
    }
  }
  const [a] = await banco
    .insert(alteracaoSinonimo)
    .values({
      sinonimoId: entrada.sinonimoId,
      codigoProposto: entrada.codigoProposto,
      motivo: entrada.motivo,
      solicitadoPor: entrada.usuarioId,
    })
    .returning({ id: alteracaoSinonimo.id });
  return { ok: true, alteracaoId: a.id };
}

/** Só revisor ou admin decide. Aprovar aplica o novo código e grava o evento. */
export async function decidirAlteracao(
  banco: Banco,
  id: number,
  aprovada: boolean,
  observacao: string,
  usuarioId: number,
): Promise<Resultado> {
  const [u] = await banco
    .select({ papel: usuario.papel })
    .from(usuario)
    .where(eq(usuario.id, usuarioId))
    .limit(1);
  if (u === undefined || !podeRevisar(u)) {
    return { ok: false, erro: 'Apenas revisor ou admin pode decidir.' };
  }
  const [alt] = await banco
    .select()
    .from(alteracaoSinonimo)
    .where(eq(alteracaoSinonimo.id, id))
    .limit(1);
  if (alt === undefined) return { ok: false, erro: 'Pedido não encontrado.' };

  if (aprovada) {
    const [s] = await banco
      .select({ cod: sinonimo.codigoReduzido })
      .from(sinonimo)
      .where(eq(sinonimo.id, alt.sinonimoId))
      .limit(1);
    await banco
      .update(sinonimo)
      .set({ codigoReduzido: alt.codigoProposto })
      .where(eq(sinonimo.id, alt.sinonimoId));
    await banco.insert(sinonimoEvento).values({
      sinonimoId: alt.sinonimoId,
      tipo: 'alterado',
      codigoDe: s?.cod,
      codigoPara: alt.codigoProposto,
      motivo: alt.motivo,
      autorId: usuarioId,
    });
  }
  await banco
    .update(alteracaoSinonimo)
    .set({ status: aprovada ? 'aprovada' : 'rejeitada', revisadoPor: usuarioId, observacaoRevisor: observacao })
    .where(eq(alteracaoSinonimo.id, id));
  return { ok: true };
}

/** Desfaz um evento: volta o sinônimo ao código anterior e registra o desfazer. */
export async function desfazer(banco: Banco, eventoId: number, usuarioId: number): Promise<Resultado> {
  const [ev] = await banco
    .select()
    .from(sinonimoEvento)
    .where(eq(sinonimoEvento.id, eventoId))
    .limit(1);
  if (ev === undefined) return { ok: false, erro: 'Evento não encontrado.' };
  if (ev.codigoDe === null || ev.codigoDe === '') {
    return { ok: false, erro: 'Não há código anterior para voltar.' };
  }
  const [s] = await banco
    .select({ cod: sinonimo.codigoReduzido })
    .from(sinonimo)
    .where(eq(sinonimo.id, ev.sinonimoId))
    .limit(1);
  await banco.update(sinonimo).set({ codigoReduzido: ev.codigoDe }).where(eq(sinonimo.id, ev.sinonimoId));
  await banco.insert(sinonimoEvento).values({
    sinonimoId: ev.sinonimoId,
    tipo: 'desfeito',
    codigoDe: s?.cod,
    codigoPara: ev.codigoDe,
    autorId: usuarioId,
  });
  return { ok: true };
}
