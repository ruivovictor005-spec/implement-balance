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

const soDigitos = (s: string): string => s.replace(/\D/g, '');

const paraResultado = (r: RegraNatureza): ResultadoNatureza => ({
  natureza: r.natureza,
  gruposDominio: r.gruposDominio,
  naoMigrar: r.naoMigrar,
});

/**
 * Candidatas na ordem do campo `ordem`. Prefixo vazio ou começando por `#` sai fora: o primeiro
 * casaria com qualquer classificação, e o segundo é comentário na tabela, não regra.
 */
const candidatas = (regras: RegraNatureza[]): RegraNatureza[] =>
  ordenadas(regras.filter((r) => r.prefixo !== '' && !r.prefixo.startsWith('#')));

/**
 * Primeira regra cujo prefixo case comparando SÓ OS DÍGITOS, dos dois lados.
 *
 * Comparar com a máscara, como era antes, dá resposta errada nos dois sentidos: a tabela do Domínio
 * tem prefixos sem máscara (`11`, `21`, `42`) e uma classificação `1.1.10.200.001` casaria com `1`
 * (ATIVO) antes de `11` (ATIVO CIRCULANTE); e a tabela COSIF tem prefixos com máscara (`1.1`) e uma
 * classificação exportada sem ela (`1110200001`) escorregava para a regra genérica `1` em silêncio.
 * Normalizando os dois lados, `1.1`, `11`, `1.1.10.200.001` e `1110200001` falam a mesma língua.
 *
 * A ordem do campo `ordem` continua mandando — é ela que põe o específico antes do genérico.
 */
function casarPorDigitos(classificacao: string, regras: RegraNatureza[]): ResultadoNatureza | null {
  const digitos = soDigitos(classificacao);
  if (digitos === '') return null;
  const regra = candidatas(regras).find((c) => {
    const p = soDigitos(c.prefixo);
    return p !== '' && digitos.startsWith(p);
  });
  return regra === undefined ? null : paraResultado(regra);
}

/**
 * Natureza da conta de ORIGEM pela tabela COSIF. A tabela vem do mais específico para o mais
 * genérico (`5.9.9.99` antes de `1.1`, que vem antes de `1`). Devolve `null` quando nenhuma regra
 * casa — a classificação não foi reconhecida e a linha vira pendência. Regras do conjunto `dominio`
 * são ignoradas aqui: elas descrevem o plano de destino, não o de origem.
 *
 * ATENÇÃO: isto só vale para uma origem que esteja MESMO no plano COSIF. Num balancete que já vem no
 * plano do Domínio, o grupo 4 é custo/despesa e não passivo, e esta tabela responde errado em quase
 * tudo — ver `resolverNaturezaDominioOrigem` e `motor/origem.ts`.
 */
export function resolverNatureza(
  classificacao: string,
  regras: RegraNatureza[],
): ResultadoNatureza | null {
  return casarPorDigitos(
    classificacao,
    regras.filter((r) => r.conjunto !== 'dominio'),
  );
}

/**
 * Natureza da conta de ORIGEM quando o balancete recebido JÁ ESTÁ no plano do Domínio — o caso de
 * uma empresa que vem de outro escritório que também usa Domínio, com o plano de contas antigo.
 * Usa a mesma tabela do plano de destino, que é o plano em que essa origem está.
 */
export function resolverNaturezaDominioOrigem(
  classificacao: string,
  regras: RegraNatureza[],
): ResultadoNatureza | null {
  return casarPorDigitos(
    classificacao,
    regras.filter((r) => r.conjunto === 'dominio'),
  );
}

/**
 * Natureza de uma conta do PLANO DOMÍNIO (o destino), para a busca de contas mostrar. Devolve ''
 * quando nenhuma regra casa.
 */
export function naturezaContaDominio(classificacao: string, regras: RegraNatureza[]): string {
  return resolverNaturezaDominioOrigem(classificacao, regras)?.natureza ?? '';
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
