// Agregação dos saldos resolvidos em lançamentos de débito e crédito (§6.6).
import type { IndicePlano } from './resolver.js';

export type Lancamento = {
  contaDebito: string | null;
  contaCredito: string | null;
  valor: number;
  complemento: string;
};

/** ROUND do Excel: meio centavo arredonda para longe do zero, dos dois lados. */
function arredondarCentavos(valor: number): number {
  const sinal = valor < 0 ? -1 : 1;
  return (sinal * Math.round(Math.abs(valor) * 100)) / 100;
}

/**
 * Um lançamento por código resolvido: soma os saldos do código, arredonda em 2 casas, descarta o
 * que ficou em zero e ordena pela classificação da conta no plano. O sinal define o lado — saldo
 * negativo é débito, positivo é crédito — e o valor é o módulo.
 *
 * O arredondamento vem antes do descarte: um saldo de 0,004 não gera partida de zero, e saldos
 * que se anulam não geram partida nenhuma.
 */
export function agregarLancamentos(
  resolvidas: { codigo: string; saldoAtual: number }[],
  indice: IndicePlano,
): Lancamento[] {
  const somaPorCodigo = new Map<string, number>();
  for (const linha of resolvidas) {
    somaPorCodigo.set(linha.codigo, (somaPorCodigo.get(linha.codigo) ?? 0) + linha.saldoAtual);
  }

  return [...somaPorCodigo]
    .map(([codigo, soma]) => ({ codigo, saldo: arredondarCentavos(soma) }))
    .filter(({ saldo }) => saldo !== 0)
    .sort((a, b) => comparar(classificacaoDe(a.codigo, indice), classificacaoDe(b.codigo, indice)))
    .map(({ codigo, saldo }) => ({
      contaDebito: saldo < 0 ? codigo : null,
      contaCredito: saldo > 0 ? codigo : null,
      valor: Math.abs(saldo),
      complemento: ` | ${semQuebraDeLinha(indice.porCodigo.get(codigo)?.descricao ?? '')}`,
    }));
}

/** Código fora do plano não deveria chegar aqui; se chegar, ele vai para o começo da ordem. */
const classificacaoDe = (codigo: string, indice: IndicePlano): string =>
  indice.porCodigo.get(codigo)?.classificacao ?? '';

/** Comparação de texto crescente, como a ordenação da planilha. */
const comparar = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

const semQuebraDeLinha = (texto: string): string => texto.replace(/[\r\n]/g, ' ');
