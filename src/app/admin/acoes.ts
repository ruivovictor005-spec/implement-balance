'use server';

// Ações do painel do administrador: a fila de sinônimos propostos e os pedidos de alteração. Toda
// ação confere o papel no banco antes de ler ou decidir — a tela escondida não é a proteção.
import { and, desc, eq } from 'drizzle-orm';
import { auth } from '../../acesso/auth.js';
import { db } from '../../dados/cliente.js';
import {
  decidirAlteracao,
  decidirSinonimo,
  ehAdmin,
  listarPropostasPendentes,
  type PropostaPendente,
} from '../../dados/sinonimos.js';
import { alteracaoSinonimo, planoConta, planoVersao, sinonimo, usuario } from '../../dados/schema.js';

async function adminAtualId(): Promise<number> {
  const sessao = await auth();
  const uid = (sessao as { uid?: number } | null)?.uid;
  if (uid === undefined || uid === null) throw new Error('Não autenticado.');
  if (!(await ehAdmin(db(), uid))) throw new Error('Apenas o administrador pode fazer isso.');
  return uid;
}

export type PropostaNaFila = PropostaPendente & {
  /** Descrição e classificação da conta do Domínio proposta, para decidir sem abrir o plano. */
  contaDescricao: string | null;
  contaClassificacao: string | null;
};

export async function listarPropostas(): Promise<PropostaNaFila[]> {
  await adminAtualId();
  const banco = db();
  const propostas = await listarPropostasPendentes(banco);
  const contas = await banco
    .select({ codigo: planoConta.codigoReduzido, descricao: planoConta.descricao, classificacao: planoConta.classificacao })
    .from(planoConta)
    .innerJoin(planoVersao, and(eq(planoConta.planoVersaoId, planoVersao.id), eq(planoVersao.vigente, true)));
  const porCodigo = new Map(contas.map((c) => [c.codigo, c]));
  return propostas.map((p) => ({
    ...p,
    contaDescricao: porCodigo.get(p.codigo)?.descricao ?? null,
    contaClassificacao: porCodigo.get(p.codigo)?.classificacao ?? null,
  }));
}

export async function decidirProposta(id: number, aprovado: boolean, observacao: string) {
  return decidirSinonimo(db(), id, aprovado, observacao, await adminAtualId());
}

export type PedidoAlteracao = {
  id: number;
  nomeOriginal: string;
  codigoAtual: string;
  codigoProposto: string;
  motivo: string | null;
  solicitadoPor: string | null;
};

export async function listarAlteracoes(): Promise<PedidoAlteracao[]> {
  await adminAtualId();
  return db()
    .select({
      id: alteracaoSinonimo.id,
      nomeOriginal: sinonimo.nomeOriginal,
      codigoAtual: sinonimo.codigoReduzido,
      codigoProposto: alteracaoSinonimo.codigoProposto,
      motivo: alteracaoSinonimo.motivo,
      solicitadoPor: usuario.nome,
    })
    .from(alteracaoSinonimo)
    .innerJoin(sinonimo, eq(alteracaoSinonimo.sinonimoId, sinonimo.id))
    .leftJoin(usuario, eq(alteracaoSinonimo.solicitadoPor, usuario.id))
    .where(eq(alteracaoSinonimo.status, 'pendente'))
    .orderBy(desc(alteracaoSinonimo.id));
}

export async function decidirPedido(id: number, aprovada: boolean, observacao: string) {
  return decidirAlteracao(db(), id, aprovada, observacao, await adminAtualId());
}
