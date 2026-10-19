// Natureza COSIF e grupos permitidos no Domínio (§6.3).
import type { RegraNatureza } from './tipos.js';

/** O que a classificação de origem diz sobre a conta: natureza, grupos aceitos e o veto. */
export type ResultadoNatureza = {
  natureza: string;
  gruposDominio: string[];
  naoMigrar: boolean;
};

/**
 * Primeira regra, na ordem do campo `ordem`, cujo prefixo case com o início da classificação.
 * A tabela vem ordenada do mais específico para o mais genérico (`5.9.9.99` antes de `1.1`,
 * que vem antes de `1`), e é essa ordem que define a precedência. Devolve `null` quando
 * nenhuma regra casa — a classificação não foi reconhecida e a linha vira pendência.
 */
export function resolverNatureza(
  classificacao: string,
  regras: RegraNatureza[],
): ResultadoNatureza | null {
  const comparavel = classificacao.trim();
  const regra = [...regras]
    .sort((a, b) => a.ordem - b.ordem)
    .find((candidata) => comparavel.startsWith(candidata.prefixo));
  if (regra === undefined) return null;
  return {
    natureza: regra.natureza,
    gruposDominio: regra.gruposDominio,
    naoMigrar: regra.naoMigrar,
  };
}
