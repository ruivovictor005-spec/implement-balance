'use server';

// Ações de servidor da implantação: resolvem quem está logado (pela sessão do Entra) e delegam para
// a camada de dados, que faz o trabalho e a auditoria. A tela (Task 11) chama estas funções.
import { and, eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { auth } from '../../acesso/auth.js';
import { db } from '../../dados/cliente.js';
import {
  anexarBalancete as anexarNoBanco,
  definirAjusteManual as definirNoBanco,
  iniciarImplantacao as iniciarNoBanco,
  recalcular as recalcularNoBanco,
  registrarContaCriada as registrarContaNoBanco,
  salvarDadosEmpresa as salvarDadosNoBanco,
  type ContaCriadaEntrada,
  type Reconhecimento,
} from '../../dados/implantacoes.js';
import { carregarPlanoVigente } from '../../dados/plano.js';
import { carregarRegras } from '../../dados/regras.js';
import { registrarEntrada } from '../../dados/usuarios.js';
import { implantacao, usuario } from '../../dados/schema.js';
import type { LinhaResolvida, Painel } from '../../motor/converter.js';
import { resolverNatureza } from '../../motor/natureza.js';
import type { ContaPlano } from '../../motor/tipos.js';
import { PERFIS } from '../../leitores/perfis.js';

export type { ContaCriadaEntrada, Reconhecimento } from '../../dados/implantacoes.js';
export type ContaBusca = ContaPlano & { natureza: string };

export type DadosEmpresaForm = {
  dataSaldo: string;
  cnpj: string;
  codigoEmpresa: string;
  tipoLote: string;
  codigoHistorico: string;
  incluirCabecalho: boolean;
};

export type EstadoImplantacao = {
  dados: DadosEmpresaForm;
  reconhecimento: Reconhecimento | null;
  painel: Painel;
  linhas: LinhaResolvida[];
};

async function garantirUsuario(
  oid: string,
  email: string | undefined,
  nome: string | undefined,
): Promise<number> {
  const [existente] = await db()
    .select({ id: usuario.id })
    .from(usuario)
    .where(eq(usuario.oidEntra, oid))
    .limit(1);
  if (existente !== undefined) return existente.id;
  const novo = await registrarEntrada(db(), { oid, email, nome });
  return novo.id;
}

async function usuarioAtualId(): Promise<number> {
  const sessao = await auth();
  const oid = (sessao as { oid?: string } | null)?.oid;
  if (sessao?.user === undefined || oid === undefined || oid === '') {
    // Dev sem provedor Entra: usuário local, para a tela funcionar sem login.
    if (!process.env.AUTH_MICROSOFT_ENTRA_ID_ID) {
      return garantirUsuario('dev-local', 'dev@local', 'Desenvolvimento');
    }
    throw new Error('Não autenticado.');
  }
  return garantirUsuario(oid, sessao.user.email ?? undefined, sessao.user.name ?? undefined);
}

/** Id da implantação em andamento de quem está logado, ou null se não houver. */
export async function minhaImplantacaoAberta(): Promise<number | null> {
  const uid = await usuarioAtualId();
  const [aberta] = await db()
    .select({ id: implantacao.id })
    .from(implantacao)
    .where(and(eq(implantacao.usuarioId, uid), eq(implantacao.status, 'em_andamento')))
    .limit(1);
  return aberta?.id ?? null;
}

export async function iniciarImplantacao(): Promise<number> {
  return iniciarNoBanco(db(), await usuarioAtualId());
}

/** Inicia uma implantação e leva para a tela dela — usada pelo formulário da "minha mesa". */
export async function iniciarERedirecionar(): Promise<void> {
  const id = await iniciarNoBanco(db(), await usuarioAtualId());
  redirect(`/implantacao/${id}`);
}

/** O TXT gerado por último para esta implantação (o `recalcular` o mantém atualizado). */
export async function baixarTxt(id: number): Promise<string> {
  await usuarioAtualId();
  const [imp] = await db()
    .select({ txt: implantacao.txtGerado })
    .from(implantacao)
    .where(eq(implantacao.id, id))
    .limit(1);
  return imp?.txt ?? '';
}

export async function salvarDadosEmpresa(id: number, dados: DadosEmpresaForm): Promise<void> {
  return salvarDadosNoBanco(db(), id, await usuarioAtualId(), {
    empresaCnpj: dados.cnpj,
    empresaCodigoDominio: dados.codigoEmpresa,
    dataSaldo: dados.dataSaldo === '' ? undefined : dados.dataSaldo,
    tipoLote: dados.tipoLote,
    codigoHistorico: dados.codigoHistorico,
    incluirCabecalho: dados.incluirCabecalho,
  });
}

export async function anexarBalancete(id: number, arquivo: { bytes: Uint8Array; nomeArquivo: string }) {
  return anexarNoBanco(db(), id, await usuarioAtualId(), arquivo);
}

export async function definirAjusteManual(id: number, codiCta: string, codigo: string | null) {
  return definirNoBanco(db(), id, await usuarioAtualId(), codiCta, codigo);
}

export async function registrarContaCriada(id: number, conta: ContaCriadaEntrada) {
  return registrarContaNoBanco(db(), id, await usuarioAtualId(), conta);
}

export async function recalcular(id: number): Promise<{ painel: Painel; linhas: LinhaResolvida[] }> {
  return recalcularNoBanco(db(), id, await usuarioAtualId());
}

/** Contas do plano vigente com a natureza, para a busca mostrar e evitar escolher natureza errada. */
export async function carregarContas(): Promise<ContaBusca[]> {
  await usuarioAtualId();
  const regras = await carregarRegras(db());
  const plano = await carregarPlanoVigente(db());
  return plano.map((c) => ({
    ...c,
    natureza: resolverNatureza(c.classificacao, regras.natureza)?.natureza ?? '',
  }));
}

/** Estado atual da implantação para a tela montar: dados da empresa, reconhecimento, painel e linhas. */
export async function estadoImplantacao(id: number): Promise<EstadoImplantacao> {
  const uid = await usuarioAtualId();
  const [imp] = await db().select().from(implantacao).where(eq(implantacao.id, id)).limit(1);
  if (imp === undefined || imp.usuarioId !== uid) throw new Error('Implantação não encontrada.');

  const { painel, linhas } = await recalcularNoBanco(db(), id, uid);

  const perfil = PERFIS.find((p) => p.id === imp.layoutDetectado);
  const reconhecimento: Reconhecimento | null =
    perfil === undefined
      ? null
      : {
          perfilId: perfil.id,
          perfilNome: perfil.nome,
          linhas: imp.qtdAnaliticas ?? 0,
          analiticas: imp.qtdAnaliticas ?? 0,
          sinteticas: 0,
        };

  return {
    dados: {
      dataSaldo: imp.dataSaldo ?? '',
      cnpj: imp.empresaCnpj ?? '',
      codigoEmpresa: imp.empresaCodigoDominio ?? '',
      tipoLote: imp.tipoLote ?? 'V',
      codigoHistorico: imp.codigoHistorico ?? '700',
      incluirCabecalho: imp.incluirCabecalho,
    },
    reconhecimento,
    painel,
    linhas,
  };
}
