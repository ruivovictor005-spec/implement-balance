// Agregação do painel de supervisão — função pura (sem banco, sem Next), para ser testável.
import type { ConcluidaResumo } from '../implantacao/concluir.js';

export type PessoaResumo = {
  pessoa: string;
  qtd: number;
  ultimaConclusao: Date | null;
};

export type Periodo = '7' | '30' | 'tudo';

/** Mantém só as concluídas dentro do período (em dias), medindo a partir de `agora`. */
export function filtrarPorPeriodo(
  lista: ConcluidaResumo[],
  periodo: Periodo,
  agora: Date = new Date(),
): ConcluidaResumo[] {
  if (periodo === 'tudo') return lista;
  const limite = agora.getTime() - Number(periodo) * 24 * 60 * 60 * 1000;
  return lista.filter((c) => c.concluidaEm !== null && c.concluidaEm.getTime() >= limite);
}

/** Agrupa por pessoa, contando as concluídas; ordena da que mais fez para a que menos fez. */
export function resumirPorPessoa(lista: ConcluidaResumo[]): PessoaResumo[] {
  const mapa = new Map<string, PessoaResumo>();
  for (const c of lista) {
    const a = mapa.get(c.pessoa) ?? { pessoa: c.pessoa, qtd: 0, ultimaConclusao: null };
    a.qtd += 1;
    if (c.concluidaEm !== null && (a.ultimaConclusao === null || c.concluidaEm > a.ultimaConclusao)) {
      a.ultimaConclusao = c.concluidaEm;
    }
    mapa.set(c.pessoa, a);
  }
  return [...mapa.values()].sort((x, y) => y.qtd - x.qtd || x.pessoa.localeCompare(y.pessoa, 'pt-BR'));
}
