// Monta o balancete como um balancete de verdade: cada conta SINTÉTICA aparece com o total das
// analíticas abaixo dela, em todos os níveis, do grupo até a conta. É o formato que o Domínio
// imprime e é o que permite conferir a realocação sem somar linha a linha. Função pura.
//
// O parentesco sai da própria CLASSIFICAÇÃO, por prefixo — é assim que um plano de contas se
// organiza. No plano do Domínio:
//
//   1          ATIVO
//   11         Ativo Circulante
//   111        Disponível
//   11102      Bancos Conta Movimento
//   11102001     Bradesco            ← analítica, é quem tem saldo
//
// Só entram as sintéticas que têm alguma analítica com saldo: o balancete mostra o que foi
// movimentado, não o plano inteiro.

export type ContaDoPlano = {
  codigoReduzido: string;
  classificacao: string;
  descricao: string;
};

/** Saldo de uma conta analítica do Domínio, já agregado por conta. */
export type SaldoDaConta = {
  codigo: string;
  debito: number;
  credito: number;
};

export type LinhaDoBalancete = {
  codigo: string;
  classificacao: string;
  descricao: string;
  /** Profundidade na hierarquia, contada no plano. 0 é o grupo de topo. */
  nivel: number;
  /** true para as contas de totalização (as que não têm saldo próprio). */
  sintetica: boolean;
  debito: number;
  credito: number;
};

const limpa = (c: string): string => c.trim();

/**
 * Ordem do balancete: comparação de texto pura, NÃO numérica. É ela que faz a hierarquia aninhar —
 * "11102001" tem de vir antes de "2", e não depois, como a comparação numérica faria.
 */
export const ordemDaClassificacao = (a: string, b: string): number =>
  a < b ? -1 : a > b ? 1 : 0;

export function montarBalancete(
  saldos: SaldoDaConta[],
  plano: ContaDoPlano[],
): LinhaDoBalancete[] {
  const porCodigo = new Map(plano.map((c) => [c.codigoReduzido, c]));
  const porClassificacao = new Map<string, ContaDoPlano>();
  for (const conta of plano) {
    const k = limpa(conta.classificacao);
    if (k !== '') porClassificacao.set(k, conta);
  }

  const folhas: LinhaDoBalancete[] = [];
  const sinteticas = new Map<string, LinhaDoBalancete>();

  /** Os ancestrais de uma classificação: todo prefixo dela que exista como conta do plano. */
  const ancestraisDe = (classificacao: string): ContaDoPlano[] => {
    const encontrados: ContaDoPlano[] = [];
    for (let tamanho = 1; tamanho < classificacao.length; tamanho++) {
      const conta = porClassificacao.get(classificacao.slice(0, tamanho));
      if (conta !== undefined) encontrados.push(conta);
    }
    return encontrados;
  };

  for (const saldo of saldos) {
    const conta = porCodigo.get(saldo.codigo);
    const classificacao = conta === undefined ? '' : limpa(conta.classificacao);
    const ancestrais = classificacao === '' ? [] : ancestraisDe(classificacao);

    folhas.push({
      codigo: saldo.codigo,
      classificacao,
      descricao: conta?.descricao ?? '',
      nivel: ancestrais.length,
      sintetica: false,
      debito: saldo.debito,
      credito: saldo.credito,
    });

    // O saldo sobe por toda a cadeia: cada sintética soma tudo o que está abaixo dela.
    for (let i = 0; i < ancestrais.length; i++) {
      const ancestral = ancestrais[i];
      const chave = limpa(ancestral.classificacao);
      const linha =
        sinteticas.get(chave) ??
        {
          codigo: ancestral.codigoReduzido,
          classificacao: chave,
          descricao: ancestral.descricao,
          nivel: i,
          sintetica: true,
          debito: 0,
          credito: 0,
        };
      linha.debito += saldo.debito;
      linha.credito += saldo.credito;
      sinteticas.set(chave, linha);
    }
  }

  // Conta fora do plano não tem classificação e não pendura em lugar nenhum; vai para o fim, onde
  // não se confunde com um grupo de verdade nem desaparece da conferência.
  const comClassificacao = [...sinteticas.values(), ...folhas.filter((f) => f.classificacao !== '')];
  const semClassificacao = folhas.filter((f) => f.classificacao === '');

  comClassificacao.sort((a, b) => {
    const porClasse = ordemDaClassificacao(a.classificacao, b.classificacao);
    if (porClasse !== 0) return porClasse;
    // Mesma classificação: a sintética vem antes da analítica que ela totaliza.
    if (a.sintetica !== b.sintetica) return a.sintetica ? -1 : 1;
    return ordemDaClassificacao(a.codigo, b.codigo);
  });

  return [...comClassificacao, ...semClassificacao];
}
