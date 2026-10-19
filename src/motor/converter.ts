// Orquestrador do motor (§5): encadeia normalização, natureza, resolução, agregação e leiaute,
// e monta o painel de conferência (§6.8). Função pura — entra balancete, plano e regras; sai
// linhas resolvidas, lançamentos, TXT e painel. Nenhum I/O.
import { agregarLancamentos, type Lancamento } from './agregar.js';
import { resolverNatureza } from './natureza.js';
import { normalizarNome } from './normalizar.js';
import { criarIndicePlano, resolverConta, type Origem } from './resolver.js';
import { gerarTxt, type ParametrosLote } from './leiaute-dominio.js';
import type { ContaPlano, LinhaBalancete, RegraNatureza, RegraNormalizacao } from './tipos.js';

export type { ParametrosLote } from './leiaute-dominio.js';

/** Linha do balancete com tudo que o motor calculou para ela. */
export type LinhaResolvida = LinhaBalancete & {
  nomeNormalizado: string;
  natureza: string;
  gruposDominio: string[];
  codigo: string | null;
  origem: Origem;
  status: string;
};

export type Painel = {
  analiticas: number;
  mapeadas: number;
  pendentes: number;
  saldoPendente: number;
  totalDebito: number;
  totalCredito: number;
  diferenca: number;
  pronto: boolean;
  status: string;
};

/** ROUND do Excel em 2 casas: meio centavo arredonda para longe do zero. */
function arredondar2(valor: number): number {
  const sinal = valor < 0 ? -1 : 1;
  return (sinal * Math.round(Math.abs(valor) * 100)) / 100;
}

export function converter(entrada: {
  balancete: LinhaBalancete[];
  plano: ContaPlano[];
  contasCriadas: ContaPlano[];
  sinonimos: Map<string, string>;
  regrasNormalizacao: RegraNormalizacao[];
  regrasNatureza: RegraNatureza[];
  ajustesManuais: Map<string, string>;
  parametros: ParametrosLote;
}): { linhas: LinhaResolvida[]; lancamentos: Lancamento[]; txt: string[]; painel: Painel } {
  const {
    balancete,
    plano,
    contasCriadas,
    sinonimos,
    regrasNormalizacao,
    regrasNatureza,
    ajustesManuais,
    parametros,
  } = entrada;

  // Conta criada durante a sessão entra no índice como analítica comum.
  const indice = criarIndicePlano([...plano, ...contasCriadas]);

  const linhas: LinhaResolvida[] = [];
  for (const linha of balancete) {
    if (linha.tipoCta.startsWith('S')) continue; // §6.1: sintética não vira saldo
    const nomeNormalizado = normalizarNome(linha.nomeCta, regrasNormalizacao);
    const natureza = resolverNatureza(linha.clasCta, regrasNatureza);
    const ajusteManual = ajustesManuais.get(linha.codiCta) ?? null;
    const resolvida = resolverConta({ nomeNormalizado, natureza, ajusteManual, indice, sinonimos });
    linhas.push({
      ...linha,
      nomeNormalizado,
      natureza: natureza?.natureza ?? '',
      gruposDominio: natureza?.gruposDominio ?? [],
      codigo: resolvida.codigo,
      origem: resolvida.origem,
      status: resolvida.status,
    });
  }

  const resolvidas = linhas
    .filter((l): l is LinhaResolvida & { codigo: string } => l.codigo !== null)
    .map((l) => ({ codigo: l.codigo, saldoAtual: l.saldoAtual }));
  const lancamentos = agregarLancamentos(resolvidas, indice);
  const txt = gerarTxt(lancamentos, parametros);

  // O painel reproduz os contadores da planilha (§6.8). "Pendente" é a linha que ficou sem código
  // (NÃO ENCONTRADO ou coluna L inexistente); "Não migrar" não conta como pendência nem reprova.
  const pendentes = linhas.filter((l) => l.origem === 'nao_encontrado');
  const totalDebito = arredondar2(
    lancamentos.reduce((s, l) => (l.contaDebito !== null ? s + l.valor : s), 0),
  );
  const totalCredito = arredondar2(
    lancamentos.reduce((s, l) => (l.contaCredito !== null ? s + l.valor : s), 0),
  );
  const diferenca = arredondar2(totalDebito - totalCredito);
  const pronto =
    parametros.cnpj.trim() !== '' &&
    parametros.codigoEmpresa.trim() !== '' &&
    pendentes.length === 0 &&
    diferenca === 0;

  const painel: Painel = {
    analiticas: linhas.length,
    mapeadas: linhas.length - pendentes.length,
    pendentes: pendentes.length,
    saldoPendente: arredondar2(pendentes.reduce((s, l) => s + l.saldoAtual, 0)),
    totalDebito,
    totalCredito,
    diferenca,
    pronto,
    status: pronto ? 'PRONTO PARA IMPORTAR' : 'ATENÇÃO: revisar pendências / diferença',
  };

  return { linhas, lancamentos, txt, painel };
}
