// Tipos compartilhados do motor. Este arquivo contém apenas tipos: o motor é puro,
// sem I/O, rede, banco ou ambiente.

export type Tipo = 'A' | 'S';

export type ContaPlano = {
  codigoReduzido: string;
  classificacao: string;
  descricao: string;
  tipo: Tipo;
  descricaoNormalizada: string;
};

export type RegraNormalizacao = {
  etapa: 1 | 2;
  ordem: number;
  de: string;
  para: string;
};

export type RegraNatureza = {
  ordem: number;
  prefixo: string;
  grupoCosif: string;
  natureza: string;
  gruposDominio: string[];
  naoMigrar: boolean;
};

export type SinonimoFixture = {
  nomeOriginal: string;
  chaveNormalizada: string;
  codigoReduzido: string;
};

export type LinhaBalancete = {
  codiCta: string;
  nomeCta: string;
  clasCta: string;
  tipoCta: string;
  saldoAnterior: number;
  totalDebito: number;
  totalCredito: number;
  saldoAtual: number;
};

// Linha do balancete acompanhada do que a planilha calculou para ela (colunas K, Q, R, M e P).
// É o gabarito de equivalência com a planilha, copiado como está. A planilha calcula natureza e
// grupos (Q, R) para todas as linhas, mas nome normalizado, código e status (K, M, P) só para as
// analíticas: nas sintéticas esses três ficam vazios. Na coluna R, "NÃO MIGRAR" aparece como o
// item literal ["NÃO MIGRAR"].
// `ajusteManual` (coluna L) é ENTRADA, não resultado: o código de Domínio que a pessoa digitou à mão
// para a linha, vazio quando não houve. Sem ele o gabarito é irreprodutível nas linhas em que a
// planilha responde "Manual (coluna L)".
export type LinhaBalanceteGabarito = LinhaBalancete & {
  ajusteManual: string;
  nomeNormalizadoEsperado: string;
  naturezaEsperada: string;
  gruposEsperados: string[];
  codigoEsperado: string;
  statusEsperado: string;
};
