// Natureza das contas (§6.3). São DUAS tabelas, porque são dois planos diferentes:
//  - ORIGEM: o balancete das empresas migradas vem no plano COSIF (1 ativo, 4 passivo, 6 PL,
//    7 receitas, 8 despesas). É a tabela padrão e decide os grupos do Domínio aceitos para a conta.
//  - DESTINO: as contas do plano padrão do Domínio (1 ativo, 2 passivo, 24 PL, 3 receitas,
//    41 custos, 42 despesas...), pela aba "Natureza Domínio" da planilha INTEGRAÇÃO DOMÍNIO.
// Aplicar a tabela COSIF numa conta do Domínio fazia despesa (4xxx) virar "passivo", passivo (2xxx)
// virar "ativo não circulante" e receita (3xxx) virar "compensação" — daí a separação.
import type { RegraNatureza } from './tipos.js';

/** O que a classificação de origem diz sobre a conta: natureza, grupos aceitos e o veto. */
export type ResultadoNatureza = {
  natureza: string;
  gruposDominio: string[];
  naoMigrar: boolean;
};

const ordenadas = (regras: RegraNatureza[]): RegraNatureza[] =>
  [...regras].sort((a, b) => a.ordem - b.ordem);

/**
 * Natureza da conta de ORIGEM pela tabela COSIF: a primeira regra, na ordem do campo `ordem`, cujo
 * prefixo case com o início da classificação. A tabela vem do mais específico para o mais genérico
 * (`5.9.9.99` antes de `1.1`, que vem antes de `1`). Devolve `null` quando nenhuma regra casa — a
 * classificação não foi reconhecida e a linha vira pendência. Regras do conjunto `dominio` são
 * ignoradas aqui: elas descrevem o plano de destino, não o de origem.
 */
export function resolverNatureza(
  classificacao: string,
  regras: RegraNatureza[],
): ResultadoNatureza | null {
  const comparavel = classificacao.trim();
  const regra = ordenadas(regras.filter((r) => r.conjunto !== 'dominio')).find((candidata) =>
    comparavel.startsWith(candidata.prefixo),
  );
  if (regra === undefined) return null;
  return {
    natureza: regra.natureza,
    gruposDominio: regra.gruposDominio,
    naoMigrar: regra.naoMigrar,
  };
}

/**
 * Natureza de uma conta do PLANO DOMÍNIO (o destino): primeira regra do conjunto `dominio` cujo
 * prefixo case com a classificação. Compara só os dígitos, porque a classificação do Domínio pode
 * vir com máscara (`4.1.3.04.012`) ou sem (`41304012`). Devolve '' quando nenhuma regra casa.
 */
export function naturezaContaDominio(classificacao: string, regras: RegraNatureza[]): string {
  const digitos = classificacao.replace(/\D/g, '');
  if (digitos === '') return '';
  const regra = ordenadas(
    regras.filter((r) => r.conjunto === 'dominio' && !r.prefixo.startsWith('#')),
  ).find((candidata) => digitos.startsWith(candidata.prefixo));
  return regra?.natureza ?? '';
}

const semAcento = (texto: string): string =>
  texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toUpperCase()
    .trim();

/**
 * A indicação de custo/despesa como veio na coluna do balancete: 'C' (custo), 'D' (despesa) ou ''
 * (sem indicação). Aceita também a palavra inteira, com ou sem acento.
 */
export function lerCustoDespesa(valor: string | undefined): 'C' | 'D' | '' {
  const v = semAcento(valor ?? '');
  if (v === 'C' || v.startsWith('CUSTO')) return 'C';
  if (v === 'D' || v.startsWith('DESPESA')) return 'D';
  return '';
}

/** Grupos do Domínio de despesa: operacionais, não operacionais e tributos sobre o lucro. */
const GRUPOS_DESPESA = ['42', '45', '46'];

/**
 * Aplica a indicação opcional de CUSTO (C) ou DESPESA (D) feita pela pessoa. Só vale para conta de
 * resultado devedora (despesa, custo, tributos sobre o lucro): um "Salários a pagar" no passivo
 * marcado como C continua passivo. Sem indicação, ou em conta de outra natureza, nada muda.
 *
 * - C: vira CUSTO e só aceita contas de custo do Domínio (grupo 41).
 * - D: vira DESPESA e deixa de aceitar contas de custo — sem isso, uma conta "Salários" de origem
 *   podia cair no "Salários" do grupo de custos, que vem antes no plano.
 */
export function aplicarCustoDespesa(
  base: ResultadoNatureza | null,
  indicacao: 'C' | 'D' | '',
): ResultadoNatureza | null {
  if (base === null || base.naoMigrar || indicacao === '') return base;
  const n = semAcento(base.natureza);
  const resultadoDevedor = n.includes('DESPESA') || n.includes('CUSTO') || n.includes('TRIBUTO');
  if (!resultadoDevedor) return base;
  if (indicacao === 'C') return { natureza: 'CUSTO', gruposDominio: ['41'], naoMigrar: false };
  const despesa = base.gruposDominio.filter((g) => GRUPOS_DESPESA.includes(g));
  return {
    natureza: n.includes('CUSTO') ? 'DESPESA' : base.natureza,
    gruposDominio: despesa.length > 0 ? despesa : GRUPOS_DESPESA,
    naoMigrar: false,
  };
}
