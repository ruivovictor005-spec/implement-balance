// Lançamentos de implantação (§6.6): UM POR CONTA DE ORIGEM.
//
// Antes, as contas de origem que iam para a mesma conta do Domínio eram somadas num lançamento só
// (Fornecedor 1 + Fornecedor 2 + Fornecedor 3 → um crédito em Fornecedores a Pagar). Isso escondia
// a composição do saldo: depois não dava para saber de onde cada parte veio. Agora cada conta de
// origem gera a sua partida, e o histórico diz qual era — o saldo final de cada conta no Domínio é o
// mesmo, mas a origem fica rastreável no próprio razão.
import type { IndicePlano } from './resolver.js';

export type Lancamento = {
  contaDebito: string | null;
  contaCredito: string | null;
  valor: number;
  complemento: string;
  /** Conta de ORIGEM do saldo, como veio no balancete: é o que o histórico cita. */
  origemCodigo: string;
  origemNome: string;
};

/** Uma linha de origem já resolvida para uma conta do Domínio. */
export type SaldoResolvido = {
  codigo: string;
  saldoAtual: number;
  origemCodigo: string;
  origemNome: string;
};

/** ROUND do Excel: meio centavo arredonda para longe do zero, dos dois lados. */
function arredondarCentavos(valor: number): number {
  const sinal = valor < 0 ? -1 : 1;
  return (sinal * Math.round(Math.abs(valor) * 100)) / 100;
}

/**
 * Uma partida por linha de origem: arredonda o saldo em 2 casas, descarta o que ficou em zero e
 * ordena pela classificação da conta do Domínio — dentro da mesma conta, na ordem do balancete,
 * para as partidas de uma conta saírem juntas. O sinal define o lado: saldo negativo é débito,
 * positivo é crédito; o valor é o módulo.
 */
export function gerarLancamentos(resolvidas: SaldoResolvido[], indice: IndicePlano): Lancamento[] {
  return resolvidas
    .map((linha) => ({ ...linha, saldo: arredondarCentavos(linha.saldoAtual) }))
    .filter(({ saldo }) => saldo !== 0)
    .sort((a, b) => comparar(classificacaoDe(a.codigo, indice), classificacaoDe(b.codigo, indice)))
    .map(({ codigo, saldo, origemCodigo, origemNome }) => ({
      contaDebito: saldo < 0 ? codigo : null,
      contaCredito: saldo > 0 ? codigo : null,
      valor: Math.abs(saldo),
      complemento: historicoImplantacao(origemCodigo, origemNome),
      origemCodigo,
      origemNome,
    }));
}

/**
 * Histórico complementar da partida, padronizado e apontando a ORIGEM do saldo:
 * "IMPLANTAÇÃO DE SALDO REFERENTE À CONTA 1000 - FORNECEDOR 1". Em maiúsculas e com espaços
 * normalizados, para todas as partidas saírem no mesmo padrão.
 */
export function historicoImplantacao(codigo: string, nome: string): string {
  const conta = semQuebraDeLinha(nome).replace(/\s+/g, ' ').trim().toUpperCase();
  const base = `IMPLANTAÇÃO DE SALDO REFERENTE À CONTA ${codigo.trim()}`;
  return conta === '' ? base : `${base} - ${conta}`;
}

/** Código fora do plano não deveria chegar aqui; se chegar, ele vai para o começo da ordem. */
const classificacaoDe = (codigo: string, indice: IndicePlano): string =>
  indice.porCodigo.get(codigo)?.classificacao ?? '';

/** Comparação de texto crescente, como a ordenação da planilha. */
const comparar = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

const semQuebraDeLinha = (texto: string): string => texto.replace(/[\r\n]/g, ' ');
