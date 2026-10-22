// A implantação como unidade de trabalho no servidor: cria, guarda os dados da empresa, anexa o
// balancete, aceita ajustes manuais e contas criadas, e recalcula (roda o motor) gravando as linhas
// e o painel. Cada ação confirma que a implantação é de quem chama e está em andamento, e audita.
import { and, desc, eq } from 'drizzle-orm';
import type { PgDatabase } from 'drizzle-orm/pg-core';
import { lerArquivoComFormato } from '../leitores/ler-arquivo.js';
import { detectarPerfil, extrairLinhas } from '../leitores/detectar.js';
import type { Lancamento } from '../motor/agregar.js';
import { converter, type LinhaResolvida, type Painel } from '../motor/converter.js';
import { normalizarNome } from '../motor/normalizar.js';
import type { ContaPlano, LinhaBalancete } from '../motor/tipos.js';
import { auditar } from '../observabilidade/auditar.js';
import { db } from './cliente.js';
import { carregarPlanoVigente } from './plano.js';
import { carregarRegras } from './regras.js';
import { carregarSinonimos } from './sinonimos.js';
import { contaCriada, implantacao, implantacaoLinha } from './schema.js';

type Banco = PgDatabase<any, any, any>;

export type DadosEmpresa = {
  empresaCnpj?: string;
  empresaCodigoDominio?: string;
  empresaNome?: string;
  dataSaldo?: string; // 'YYYY-MM-DD'
  tipoLote?: string;
  codigoHistorico?: string;
  incluirCabecalho?: boolean;
};

export type ContaCriadaEntrada = { codigoReduzido: string; descricao: string; classificacao: string };

export type Reconhecimento = {
  perfilId: string;
  perfilNome: string;
  linhas: number;
  analiticas: number;
  sinteticas: number;
};

const dinheiro = (n: number): string => n.toFixed(2);
const numero = (v: string | null): number => (v === null ? 0 : Number(v));

/** 'YYYY-MM-DD' → Date pelos componentes locais, para a data do TXT sair como digitada. */
function dataLocal(iso: string): Date {
  const [ano, mes, dia] = iso.split('-').map(Number);
  return new Date(ano ?? 1970, (mes ?? 1) - 1, dia ?? 1);
}

/** Garante que a implantação existe, é de quem chama e está em andamento. */
async function exigirMinhaEmAndamento(banco: Banco, id: number, usuarioId: number) {
  const [imp] = await banco.select().from(implantacao).where(eq(implantacao.id, id)).limit(1);
  if (imp === undefined) throw new Error('Implantação não encontrada.');
  if (imp.usuarioId !== usuarioId) throw new Error('Esta implantação é de outra pessoa.');
  if (imp.status !== 'em_andamento') throw new Error('Esta implantação não está em andamento.');
  return imp;
}

/**
 * Nova implantação. As anteriores em andamento FICAM em andamento — a pessoa pode ter várias
 * (uma por empresa), pausar e voltar. A escolha de qual continuar é feita na "mesa".
 */
export async function iniciarImplantacao(banco: Banco, usuarioId: number): Promise<number> {
  const [nova] = await banco
    .insert(implantacao)
    .values({ usuarioId })
    .returning({ id: implantacao.id });
  await auditar(banco, {
    usuarioId,
    acao: 'iniciar_implantacao',
    entidade: 'implantacao',
    entidadeId: String(nova.id),
  });
  return nova.id;
}

export type ImplantacaoAberta = {
  id: number;
  empresaNome: string | null;
  empresaCnpj: string | null;
  iniciadaEm: Date;
};

/** As implantações em andamento da pessoa (pode ter várias), mais recentes primeiro. */
export async function minhasImplantacoesAbertas(
  banco: Banco,
  usuarioId: number,
): Promise<ImplantacaoAberta[]> {
  const linhas = await banco
    .select({
      id: implantacao.id,
      empresaNome: implantacao.empresaNome,
      empresaCnpj: implantacao.empresaCnpj,
      iniciadaEm: implantacao.iniciadaEm,
    })
    .from(implantacao)
    .where(and(eq(implantacao.usuarioId, usuarioId), eq(implantacao.status, 'em_andamento')))
    .orderBy(desc(implantacao.iniciadaEm));
  return linhas;
}

export async function salvarDadosEmpresa(
  banco: Banco,
  id: number,
  usuarioId: number,
  dados: DadosEmpresa,
): Promise<void> {
  await exigirMinhaEmAndamento(banco, id, usuarioId);
  await banco
    .update(implantacao)
    .set({
      empresaCnpj: dados.empresaCnpj,
      empresaCodigoDominio: dados.empresaCodigoDominio,
      empresaNome: dados.empresaNome,
      dataSaldo: dados.dataSaldo,
      tipoLote: dados.tipoLote,
      codigoHistorico: dados.codigoHistorico,
      incluirCabecalho: dados.incluirCabecalho,
    })
    .where(eq(implantacao.id, id));
  await auditar(banco, {
    usuarioId,
    acao: 'salvar_dados_empresa',
    entidade: 'implantacao',
    entidadeId: String(id),
  });
}

/**
 * Lê o arquivo, reconhece o layout e grava as linhas analíticas de origem; depois recalcula.
 * Layout desconhecido devolve erro pedindo o mapeamento manual.
 */
export async function anexarBalancete(
  banco: Banco,
  id: number,
  usuarioId: number,
  arquivo: { bytes: Uint8Array; nomeArquivo: string },
  manual?: { linhaCabecalho: number; colunas: Record<string, number> },
): Promise<{
  reconhecimento: Reconhecimento;
  painel: Painel;
  linhas: LinhaResolvida[];
  lancamentos: Lancamento[];
}> {
  await exigirMinhaEmAndamento(banco, id, usuarioId);

  const { matriz, negrito } = await lerArquivoComFormato(arquivo.bytes, arquivo.nomeArquivo);
  const deteccao = manual
    ? { perfil: { id: 'manual', nome: 'Mapeamento manual' }, linhaCabecalho: manual.linhaCabecalho, colunas: manual.colunas }
    : detectarPerfil(matriz);
  if (deteccao === null) {
    throw new Error(
      'Layout não reconhecido: aponte as colunas manualmente ou confira se é um balancete Domínio ou Infobank.',
    );
  }

  const balancete = extrairLinhas(matriz, deteccao.linhaCabecalho, deteccao.colunas, negrito);

  // Rede de segurança: às vezes o cabeçalho casa colunas suficientes para "reconhecer" o layout, mas
  // a coluna do NOME da conta não casou (ou casou uma coluna vazia). Sem nome, nada resolve e tudo
  // vira pendência. Nesse caso não fingimos reconhecer: pedimos o mapeamento manual, onde a pessoa
  // aponta a coluna do nome. Só vale para a detecção automática — no mapeamento manual a pessoa já
  // escolheu as colunas.
  if (manual === undefined) {
    const comNome = balancete.filter((l) => l.nomeCta.trim() !== '').length;
    const fracaoComNome = balancete.length === 0 ? 1 : comNome / balancete.length;
    if (deteccao.colunas.nomeCta === undefined || fracaoComNome < 0.5) {
      throw new Error(
        'Layout não reconhecido: achei as colunas de código e saldo, mas não a do NOME da conta. ' +
          'Aponte as colunas manualmente (escolha a coluna do nome).',
      );
    }
  }

  const analiticas = balancete.filter((l) => !l.tipoCta.startsWith('S'));

  await banco.delete(implantacaoLinha).where(eq(implantacaoLinha.implantacaoId, id));
  if (analiticas.length > 0) {
    await banco.insert(implantacaoLinha).values(
      analiticas.map((l, i) => ({
        implantacaoId: id,
        ordem: i,
        codiCta: l.codiCta,
        nomeCta: l.nomeCta,
        clasCta: l.clasCta,
        tipoCta: l.tipoCta,
        saldoAnterior: dinheiro(l.saldoAnterior),
        totalDebito: dinheiro(l.totalDebito),
        totalCredito: dinheiro(l.totalCredito),
        saldoAtual: dinheiro(l.saldoAtual),
      })),
    );
  }

  await banco
    .update(implantacao)
    .set({ layoutDetectado: deteccao.perfil.id, arquivoOrigem: arquivo.nomeArquivo })
    .where(eq(implantacao.id, id));
  await auditar(banco, {
    usuarioId,
    acao: 'anexar_balancete',
    entidade: 'implantacao',
    entidadeId: String(id),
    detalhes: { perfil: deteccao.perfil.id, linhas: analiticas.length },
  });

  const { painel, linhas, lancamentos } = await recalcular(banco, id, usuarioId);
  return {
    reconhecimento: {
      perfilId: deteccao.perfil.id,
      perfilNome: deteccao.perfil.nome,
      linhas: balancete.length,
      analiticas: analiticas.length,
      sinteticas: balancete.length - analiticas.length,
    },
    painel,
    linhas,
    lancamentos,
  };
}

export async function definirAjusteManual(
  banco: Banco,
  id: number,
  usuarioId: number,
  codiCta: string,
  codigo: string | null,
): Promise<void> {
  await exigirMinhaEmAndamento(banco, id, usuarioId);
  await banco
    .update(implantacaoLinha)
    .set({ ajusteManual: codigo })
    .where(and(eq(implantacaoLinha.implantacaoId, id), eq(implantacaoLinha.codiCta, codiCta)));
  await auditar(banco, {
    usuarioId,
    acao: 'ajuste_manual',
    entidade: 'implantacao',
    entidadeId: String(id),
    detalhes: { codiCta, codigo },
  });
}

export async function registrarContaCriada(
  banco: Banco,
  id: number,
  usuarioId: number,
  conta: ContaCriadaEntrada,
): Promise<void> {
  await exigirMinhaEmAndamento(banco, id, usuarioId);
  await banco.insert(contaCriada).values({
    implantacaoId: id,
    codigoReduzido: conta.codigoReduzido,
    descricao: conta.descricao,
    classificacao: conta.classificacao,
  });
  await auditar(banco, {
    usuarioId,
    acao: 'registrar_conta_criada',
    entidade: 'implantacao',
    entidadeId: String(id),
    detalhes: { codigoReduzido: conta.codigoReduzido },
  });
}

/**
 * Roda o motor com o plano vigente, as contas criadas desta implantação, os sinônimos de agora e os
 * ajustes manuais gravados; atualiza as linhas resolvidas e os totais do painel. As contas de origem
 * vêm das linhas já gravadas, então recalcular não precisa do arquivo de novo.
 */
export async function recalcular(
  banco: Banco,
  id: number,
  usuarioId: number,
): Promise<{ painel: Painel; linhas: LinhaResolvida[]; lancamentos: Lancamento[] }> {
  const imp = await exigirMinhaEmAndamento(banco, id, usuarioId);

  const linhasOrigem = await banco
    .select()
    .from(implantacaoLinha)
    .where(eq(implantacaoLinha.implantacaoId, id))
    .orderBy(implantacaoLinha.ordem);

  const balancete: LinhaBalancete[] = linhasOrigem.map((l) => ({
    codiCta: l.codiCta ?? '',
    nomeCta: l.nomeCta ?? '',
    clasCta: l.clasCta ?? '',
    tipoCta: l.tipoCta ?? '',
    saldoAnterior: numero(l.saldoAnterior),
    totalDebito: numero(l.totalDebito),
    totalCredito: numero(l.totalCredito),
    saldoAtual: numero(l.saldoAtual),
  }));

  const regras = await carregarRegras(banco);
  const criadas = await banco
    .select()
    .from(contaCriada)
    .where(eq(contaCriada.implantacaoId, id));
  const contasCriadas: ContaPlano[] = criadas.map((c) => ({
    codigoReduzido: c.codigoReduzido,
    classificacao: c.classificacao,
    descricao: c.descricao,
    tipo: 'A',
    descricaoNormalizada: normalizarNome(c.descricao, regras.normalizacao),
  }));

  const ajustesManuais = new Map<string, string>();
  for (const l of linhasOrigem) {
    if (l.codiCta !== null && l.ajusteManual !== null && l.ajusteManual !== '') {
      ajustesManuais.set(l.codiCta, l.ajusteManual);
    }
  }

  const resultado = converter({
    balancete,
    plano: await carregarPlanoVigente(banco),
    contasCriadas,
    sinonimos: await carregarSinonimos(banco),
    regrasNormalizacao: regras.normalizacao,
    regrasNatureza: regras.natureza,
    ajustesManuais,
    parametros: {
      dataSaldo: imp.dataSaldo === null ? new Date(1970, 0, 1) : dataLocal(imp.dataSaldo),
      cnpj: imp.empresaCnpj ?? '',
      codigoEmpresa: imp.empresaCodigoDominio ?? '',
      tipoLote: imp.tipoLote ?? 'V',
      codigoHistorico: imp.codigoHistorico ?? '700',
      incluirCabecalho: imp.incluirCabecalho,
    },
  });

  // Atualiza cada linha resolvida pela ordem (o motor devolve na mesma ordem das de origem).
  for (let i = 0; i < resultado.linhas.length; i++) {
    const r = resultado.linhas[i];
    const origem = linhasOrigem[i];
    if (origem === undefined) continue;
    await banco
      .update(implantacaoLinha)
      .set({
        nomeNormalizado: r.nomeNormalizado,
        natureza: r.natureza,
        gruposPermitidos: r.gruposDominio,
        codigoResolvido: r.codigo,
        origemResolucao: r.origem,
        statusTexto: r.status,
      })
      .where(eq(implantacaoLinha.id, origem.id));
  }

  const p = resultado.painel;
  const txt = resultado.txt.join('\r\n');
  await banco
    .update(implantacao)
    .set({
      qtdAnaliticas: p.analiticas,
      qtdMapeadas: p.mapeadas,
      qtdPendentes: p.pendentes,
      saldoPendente: dinheiro(p.saldoPendente),
      totalDebito: dinheiro(p.totalDebito),
      totalCredito: dinheiro(p.totalCredito),
      diferenca: dinheiro(p.diferenca),
      txtGerado: txt,
    })
    .where(eq(implantacao.id, id));
  await auditar(banco, {
    usuarioId,
    acao: 'recalcular',
    entidade: 'implantacao',
    entidadeId: String(id),
    detalhes: { pendentes: p.pendentes, pronto: p.pronto },
  });

  return { painel: p, linhas: resultado.linhas, lancamentos: resultado.lancamentos };
}

/**
 * Estado CALCULADO sem gravar — para VER uma implantação em qualquer status (em andamento, concluída
 * ou descartada), sem a trava de "em andamento" do recalcular.
 */
export async function lerImplantacao(
  banco: Banco,
  id: number,
  usuarioId: number,
): Promise<{ painel: Painel; linhas: LinhaResolvida[]; lancamentos: Lancamento[] }> {
  const [imp] = await banco.select().from(implantacao).where(eq(implantacao.id, id)).limit(1);
  if (imp === undefined) throw new Error('Implantação não encontrada.');
  if (imp.usuarioId !== usuarioId) throw new Error('Esta implantação é de outra pessoa.');

  const linhasOrigem = await banco
    .select()
    .from(implantacaoLinha)
    .where(eq(implantacaoLinha.implantacaoId, id))
    .orderBy(implantacaoLinha.ordem);
  const regras = await carregarRegras(banco);
  const criadas = await banco.select().from(contaCriada).where(eq(contaCriada.implantacaoId, id));
  const contasCriadas: ContaPlano[] = criadas.map((c) => ({
    codigoReduzido: c.codigoReduzido,
    classificacao: c.classificacao,
    descricao: c.descricao,
    tipo: 'A',
    descricaoNormalizada: normalizarNome(c.descricao, regras.normalizacao),
  }));
  const ajustesManuais = new Map<string, string>();
  for (const l of linhasOrigem) {
    if (l.codiCta !== null && l.ajusteManual !== null && l.ajusteManual !== '') {
      ajustesManuais.set(l.codiCta, l.ajusteManual);
    }
  }
  const balancete: LinhaBalancete[] = linhasOrigem.map((l) => ({
    codiCta: l.codiCta ?? '',
    nomeCta: l.nomeCta ?? '',
    clasCta: l.clasCta ?? '',
    tipoCta: l.tipoCta ?? '',
    saldoAnterior: numero(l.saldoAnterior),
    totalDebito: numero(l.totalDebito),
    totalCredito: numero(l.totalCredito),
    saldoAtual: numero(l.saldoAtual),
  }));

  const resultado = converter({
    balancete,
    plano: await carregarPlanoVigente(banco),
    contasCriadas,
    sinonimos: await carregarSinonimos(banco),
    regrasNormalizacao: regras.normalizacao,
    regrasNatureza: regras.natureza,
    ajustesManuais,
    parametros: {
      dataSaldo: imp.dataSaldo === null ? new Date(1970, 0, 1) : dataLocal(imp.dataSaldo),
      cnpj: imp.empresaCnpj ?? '',
      codigoEmpresa: imp.empresaCodigoDominio ?? '',
      tipoLote: imp.tipoLote ?? 'V',
      codigoHistorico: imp.codigoHistorico ?? '700',
      incluirCabecalho: imp.incluirCabecalho,
    },
  });
  return { painel: resultado.painel, linhas: resultado.linhas, lancamentos: resultado.lancamentos };
}
