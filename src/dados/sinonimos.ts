// Sinônimos da base compartilhada: leitura (para o motor) e as ações de propor, decidir, pedir
// alteração e desfazer. Todo efeito grava um `sinonimo_evento` (a tabela só cresce). A chave é sempre
// calculada com as regras vigentes, nunca com o texto cru digitado.
//
// A base é compartilhada: um sinônimo vale para as implantações de TODO MUNDO. Por isso nada entra
// direto — quem não é administrador PROPÕE, a proposta fica 'pendente' (o motor só lê 'ativo') e só
// passa a valer quando o administrador aprova. Decidir alterações e desfazer também é só dele.
import { and, desc, eq, ilike, inArray, or } from 'drizzle-orm';
import type { PgDatabase } from 'drizzle-orm/pg-core';
import { podeAdministrar } from '../acesso/papeis.js';
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

/** Só os ATIVOS da versão vigente: propostas pendentes ou rejeitadas não chegam ao motor. */
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

/** O usuário é administrador? É ele quem aprova e desfaz na base compartilhada. */
export async function ehAdmin(banco: Banco, usuarioId: number): Promise<boolean> {
  const [u] = await banco
    .select({ papel: usuario.papel })
    .from(usuario)
    .where(eq(usuario.id, usuarioId))
    .limit(1);
  return u !== undefined && podeAdministrar(u);
}

const SO_ADMIN = { ok: false as const, erro: 'Apenas o administrador pode fazer isso.' };

type CodigoConferido =
  | { ok: true; foraDoPadrao: boolean; aviso?: string }
  | { ok: false; erro: string };

/**
 * O código de destino existe? No plano vigente, em outro (entra como "fora do padrão"), ou em
 * nenhum (recusa). Vale tanto para ensinar um sinônimo quanto para alterar um que já existe — os
 * dois caminhos gravam o mesmo tipo de regra e não podem aceitar códigos diferentes.
 */
async function conferirCodigo(banco: Banco, codigo: string): Promise<CodigoConferido> {
  const vid = await idVigente(banco);
  const [noVigente] = await banco
    .select({ id: planoConta.id })
    .from(planoConta)
    .where(and(eq(planoConta.planoVersaoId, vid), eq(planoConta.codigoReduzido, codigo)))
    .limit(1);
  if (noVigente !== undefined) return { ok: true, foraDoPadrao: false };

  const [emAlgum] = await banco
    .select({ id: planoConta.id })
    .from(planoConta)
    .where(eq(planoConta.codigoReduzido, codigo))
    .limit(1);
  if (emAlgum === undefined) {
    return { ok: false, erro: `Código ${codigo} não existe em nenhum plano.` };
  }
  return {
    ok: true,
    foraDoPadrao: true,
    aviso: `Código ${codigo} não está no plano vigente; marcado como fora do padrão.`,
  };
}

/**
 * Ensina um sinônimo novo. Para quem NÃO é administrador, vira uma PROPOSTA pendente — não vale para
 * ninguém até o administrador aprovar (enquanto isso, a pessoa resolve a própria linha com "usar só
 * aqui"). Proposta do próprio administrador já entra valendo. Código fora do plano vigente entra
 * como "fora do padrão".
 */
export async function ensinarSinonimo(
  banco: Banco,
  entrada: { nomeOriginal: string; codigo: string; motivo: string; usuarioId: number },
): Promise<Resultado<{ sinonimoId: number; pendente: boolean; aviso?: string }>> {
  if (entrada.motivo.trim() === '') return { ok: false, erro: 'Informe um motivo para ensinar.' };

  const vid = await idVigente(banco);
  const regras = await carregarRegras(banco);
  const chave = normalizarNome(entrada.nomeOriginal, regras.normalizacao);
  const admin = await ehAdmin(banco, entrada.usuarioId);

  const conferido = await conferirCodigo(banco, entrada.codigo);
  if (!conferido.ok) return conferido;
  const { foraDoPadrao, aviso } = conferido;

  const [ativo] = await banco
    .select({ cod: sinonimo.codigoReduzido })
    .from(sinonimo)
    .where(and(eq(sinonimo.chaveNormalizada, chave), eq(sinonimo.planoVersaoId, vid), eq(sinonimo.status, 'ativo')))
    .limit(1);
  if (ativo !== undefined) {
    return {
      ok: false,
      erro: `Já existe sinônimo para este nome: ${ativo.cod}. Para trocar, peça uma alteração.`,
    };
  }
  if (!admin) {
    const [minhaPendente] = await banco
      .select({ id: sinonimo.id })
      .from(sinonimo)
      .where(
        and(
          eq(sinonimo.chaveNormalizada, chave),
          eq(sinonimo.planoVersaoId, vid),
          eq(sinonimo.status, 'pendente'),
          eq(sinonimo.propostoPor, entrada.usuarioId),
        ),
      )
      .limit(1);
    if (minhaPendente !== undefined) {
      return {
        ok: false,
        erro: 'Você já propôs um sinônimo para este nome; ele aguarda a aprovação do administrador.',
      };
    }
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
        status: admin ? 'ativo' : 'pendente',
        propostoPor: entrada.usuarioId,
      })
      .returning({ id: sinonimo.id });
    await banco.insert(sinonimoEvento).values({
      sinonimoId: s.id,
      tipo: admin ? 'criado' : 'proposto',
      codigoPara: entrada.codigo,
      motivo: entrada.motivo,
      autorId: entrada.usuarioId,
    });
    const r = { ok: true as const, sinonimoId: s.id, pendente: !admin };
    return aviso === undefined ? r : { ...r, aviso };
  } catch {
    // Colisão do índice único (mesma chave ativa na mesma versão, ensinada ao mesmo tempo).
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

/**
 * O administrador decide uma proposta. Aprovada, ela passa a valer para todos — se nesse meio-tempo
 * outro sinônimo para o mesmo nome ficou ativo, ele é arquivado (substituído). Rejeitada, nunca vale.
 */
export async function decidirSinonimo(
  banco: Banco,
  id: number,
  aprovado: boolean,
  observacao: string,
  usuarioId: number,
): Promise<Resultado> {
  if (!(await ehAdmin(banco, usuarioId))) return SO_ADMIN;
  const [s] = await banco.select().from(sinonimo).where(eq(sinonimo.id, id)).limit(1);
  if (s === undefined || s.status !== 'pendente') {
    return { ok: false, erro: 'Proposta não encontrada ou já decidida.' };
  }
  const obs = observacao.trim() === '' ? null : observacao.trim();

  if (!aprovado) {
    await banco.update(sinonimo).set({ status: 'rejeitado', observacaoDecisao: obs }).where(eq(sinonimo.id, id));
    await banco.insert(sinonimoEvento).values({
      sinonimoId: id,
      tipo: 'rejeitado',
      codigoPara: s.codigoReduzido,
      motivo: obs,
      autorId: usuarioId,
    });
    return { ok: true };
  }

  const [ativo] = await banco
    .select({ id: sinonimo.id, cod: sinonimo.codigoReduzido })
    .from(sinonimo)
    .where(
      and(
        eq(sinonimo.chaveNormalizada, s.chaveNormalizada),
        eq(sinonimo.planoVersaoId, s.planoVersaoId),
        eq(sinonimo.status, 'ativo'),
      ),
    )
    .limit(1);
  if (ativo !== undefined) {
    await banco.update(sinonimo).set({ status: 'arquivado' }).where(eq(sinonimo.id, ativo.id));
    await banco.insert(sinonimoEvento).values({
      sinonimoId: ativo.id,
      tipo: 'substituido',
      codigoDe: ativo.cod,
      codigoPara: s.codigoReduzido,
      motivo: obs,
      autorId: usuarioId,
    });
  }
  await banco.update(sinonimo).set({ status: 'ativo', observacaoDecisao: obs }).where(eq(sinonimo.id, id));
  // "criado" leva como autor quem PROPÔS: é o nome que a tela mostra ao resolver pendências.
  await banco.insert(sinonimoEvento).values([
    { sinonimoId: id, tipo: 'criado', codigoPara: s.codigoReduzido, motivo: s.motivo, autorId: s.propostoPor ?? usuarioId },
    { sinonimoId: id, tipo: 'aprovado', codigoPara: s.codigoReduzido, motivo: obs, autorId: usuarioId },
  ]);
  return { ok: true };
}

export type PropostaPendente = {
  id: number;
  nomeOriginal: string;
  chaveNormalizada: string;
  codigo: string;
  motivo: string | null;
  foraDoPadrao: boolean;
  propostoPor: string;
  criadoEm: Date;
  /** Código do sinônimo que já está valendo para o mesmo nome, se houver (será substituído). */
  codigoAtivo: string | null;
};

/** A fila do administrador: propostas pendentes da versão vigente, mais antigas primeiro. */
export async function listarPropostasPendentes(banco: Banco): Promise<PropostaPendente[]> {
  const vid = await idVigente(banco);
  const propostas = await banco
    .select({
      id: sinonimo.id,
      nomeOriginal: sinonimo.nomeOriginal,
      chaveNormalizada: sinonimo.chaveNormalizada,
      codigo: sinonimo.codigoReduzido,
      motivo: sinonimo.motivo,
      foraDoPadrao: sinonimo.foraDoPadrao,
      propostoPor: usuario.nome,
      criadoEm: sinonimo.criadoEm,
    })
    .from(sinonimo)
    .leftJoin(usuario, eq(sinonimo.propostoPor, usuario.id))
    .where(and(eq(sinonimo.planoVersaoId, vid), eq(sinonimo.status, 'pendente')))
    .orderBy(sinonimo.criadoEm);
  const ativos = await carregarSinonimos(banco);
  return propostas.map((p) => ({
    ...p,
    propostoPor: p.propostoPor ?? '—',
    codigoAtivo: ativos.get(p.chaveNormalizada) ?? null,
  }));
}

export type MinhaProposta = {
  id: number;
  nomeOriginal: string;
  codigo: string;
  status: 'pendente' | 'ativo' | 'rejeitado' | 'arquivado';
  observacaoDecisao: string | null;
  criadoEm: Date;
};

/** O que a pessoa propôs e em que pé está (pendente, aprovado, rejeitado), mais recentes primeiro. */
export async function listarMinhasPropostas(banco: Banco, usuarioId: number): Promise<MinhaProposta[]> {
  return banco
    .select({
      id: sinonimo.id,
      nomeOriginal: sinonimo.nomeOriginal,
      codigo: sinonimo.codigoReduzido,
      status: sinonimo.status,
      observacaoDecisao: sinonimo.observacaoDecisao,
      criadoEm: sinonimo.criadoEm,
    })
    .from(sinonimo)
    .where(eq(sinonimo.propostoPor, usuarioId))
    .orderBy(desc(sinonimo.criadoEm))
    .limit(50);
}

export type SinonimoAtivo = {
  id: number;
  nomeOriginal: string;
  chaveNormalizada: string;
  codigo: string;
  /** Para onde o sinônimo aponta HOJE, por extenso — é o que deixa ver que está errado. */
  descricaoConta: string | null;
  classificacaoConta: string | null;
  foraDoPadrao: boolean;
  /** Último evento deste sinônimo, para a tela detectar que alguém mexeu enquanto ela olhava. */
  ultimoEventoId: number | null;
};

const TETO_DA_BUSCA = 60;

/**
 * Procura entre os sinônimos ATIVOS da versão vigente, para a pessoa poder ver e corrigir uma regra
 * que já existe. Sem isto, as regras eram invisíveis: dava para ensinar uma nova, nunca para achar
 * a que estava mandando "provisão de INSS" para a conta de INSS a pagar.
 *
 * O termo é procurado no nome original, na chave normalizada, no código de destino e na descrição
 * da conta de destino — e também na forma NORMALIZADA do que foi digitado, porque é assim que a
 * chave está guardada: quem digita "provisão de INSS" precisa achar a chave "PROVISAO INSS".
 */
export async function buscarSinonimos(
  banco: Banco,
  termo: string,
  limite = TETO_DA_BUSCA,
): Promise<SinonimoAtivo[]> {
  const bruto = termo.trim();
  if (bruto === '') return [];
  const vid = await idVigente(banco);
  const regras = await carregarRegras(banco);
  const comoChave = normalizarNome(bruto, regras.normalizacao);
  const curinga = (t: string) => `%${t.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;

  const achados = await banco
    .select({
      id: sinonimo.id,
      nomeOriginal: sinonimo.nomeOriginal,
      chaveNormalizada: sinonimo.chaveNormalizada,
      codigo: sinonimo.codigoReduzido,
      descricaoConta: planoConta.descricao,
      classificacaoConta: planoConta.classificacao,
      foraDoPadrao: sinonimo.foraDoPadrao,
    })
    .from(sinonimo)
    .leftJoin(
      planoConta,
      and(
        eq(planoConta.planoVersaoId, vid),
        eq(planoConta.codigoReduzido, sinonimo.codigoReduzido),
      ),
    )
    .where(
      and(
        eq(sinonimo.planoVersaoId, vid),
        eq(sinonimo.status, 'ativo'),
        or(
          ilike(sinonimo.nomeOriginal, curinga(bruto)),
          ilike(sinonimo.chaveNormalizada, curinga(bruto)),
          ilike(sinonimo.chaveNormalizada, curinga(comoChave)),
          eq(sinonimo.codigoReduzido, bruto),
          ilike(planoConta.descricao, curinga(bruto)),
        ),
      ),
    )
    .orderBy(sinonimo.chaveNormalizada)
    .limit(Math.min(limite, TETO_DA_BUSCA));

  if (achados.length === 0) return [];
  const ultimos = await banco
    .select({ sinonimoId: sinonimoEvento.sinonimoId, id: sinonimoEvento.id })
    .from(sinonimoEvento)
    .where(
      inArray(
        sinonimoEvento.sinonimoId,
        achados.map((a) => a.id),
      ),
    );
  const ultimoPor = new Map<number, number>();
  for (const e of ultimos) {
    const atual = ultimoPor.get(e.sinonimoId);
    if (atual === undefined || Number(e.id) > atual) ultimoPor.set(e.sinonimoId, Number(e.id));
  }
  return achados.map((a) => ({ ...a, ultimoEventoId: ultimoPor.get(a.id) ?? null }));
}

/**
 * Alterar um sinônimo existente. Para quem NÃO é administrador, cria um pedido pendente de revisão;
 * do administrador, vale na hora — do mesmo jeito que em `ensinarSinonimo`, e para ele não ter de
 * aprovar o próprio pedido.
 *
 * O código proposto é conferido contra o plano antes de entrar: este caminho agora vem da tela, e
 * um código inventado viraria um sinônimo que não resolve nada.
 */
export async function solicitarAlteracao(
  banco: Banco,
  entrada: {
    sinonimoId: number;
    codigoProposto: string;
    motivo: string;
    usuarioId: number;
    eventoConhecido?: number;
  },
): Promise<Resultado<{ alteracaoId: number; aplicada: boolean; aviso?: string }>> {
  if (entrada.motivo.trim() === '') return { ok: false, erro: 'Informe um motivo para alterar.' };

  const [alvo] = await banco
    .select({ cod: sinonimo.codigoReduzido, status: sinonimo.status })
    .from(sinonimo)
    .where(eq(sinonimo.id, entrada.sinonimoId))
    .limit(1);
  if (alvo === undefined) return { ok: false, erro: 'Sinônimo não encontrado.' };

  // "Alguém mexeu enquanto você olhava" vem ANTES de reclamar do código: é o motivo mais forte para
  // não gravar, e o que a pessoa precisa saber primeiro — o código que ela digitou pode nem fazer
  // mais sentido para o estado novo.
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

  if (alvo.cod === entrada.codigoProposto) {
    return { ok: false, erro: `Este sinônimo já aponta para ${entrada.codigoProposto}.` };
  }

  const conferido = await conferirCodigo(banco, entrada.codigoProposto);
  if (!conferido.ok) return conferido;

  const admin = await ehAdmin(banco, entrada.usuarioId);
  const [a] = await banco
    .insert(alteracaoSinonimo)
    .values({
      sinonimoId: entrada.sinonimoId,
      codigoProposto: entrada.codigoProposto,
      motivo: entrada.motivo,
      solicitadoPor: entrada.usuarioId,
      status: admin ? 'aprovada' : 'pendente',
      revisadoPor: admin ? entrada.usuarioId : null,
    })
    .returning({ id: alteracaoSinonimo.id });

  if (!admin) return { ok: true, alteracaoId: a.id, aplicada: false };

  // Administrador altera na hora. O evento é o mesmo que `decidirAlteracao` grava, para o histórico
  // e o desfazer não saberem a diferença entre os dois caminhos.
  await banco
    .update(sinonimo)
    .set({ codigoReduzido: entrada.codigoProposto })
    .where(eq(sinonimo.id, entrada.sinonimoId));
  await banco.insert(sinonimoEvento).values({
    sinonimoId: entrada.sinonimoId,
    tipo: 'alterado',
    codigoDe: alvo.cod,
    codigoPara: entrada.codigoProposto,
    motivo: entrada.motivo,
    autorId: entrada.usuarioId,
  });
  return { ok: true, alteracaoId: a.id, aplicada: true, aviso: conferido.aviso };
}

/** Só o administrador decide uma alteração. Aprovar aplica o novo código e grava o evento. */
export async function decidirAlteracao(
  banco: Banco,
  id: number,
  aprovada: boolean,
  observacao: string,
  usuarioId: number,
): Promise<Resultado> {
  if (!(await ehAdmin(banco, usuarioId))) return SO_ADMIN;
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

/** Desfaz um evento: volta o sinônimo ao código anterior e registra o desfazer. Só o administrador. */
export async function desfazer(banco: Banco, eventoId: number, usuarioId: number): Promise<Resultado> {
  if (!(await ehAdmin(banco, usuarioId))) return SO_ADMIN;
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
