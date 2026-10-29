// Resumo do balancete (§ conferência): os totais por grupo contábil, as contas devedoras e credoras
// e o resultado — como o relatório que o Domínio imprime. Função pura: entra a lista de linhas,
// saem os números. Nenhum I/O.
//
// A convenção de sinal é a mesma do resto do motor (ver `agregar.ts` e `lado.ts`): saldo NEGATIVO é
// devedor, POSITIVO é credor. Os saldos aqui saem ASSINADOS; quem mostra decide o D/C a partir do
// sinal, com `ladoDoSaldo`.

/** O que o resumo precisa de cada linha. `LinhaResolvida` atende, sem o módulo depender dela. */
export type LinhaDoResumo = {
  natureza: string;
  saldoAnterior: number;
  totalDebito: number;
  totalCredito: number;
  saldoAtual: number;
};

export type GrupoId = 'ativo' | 'passivo' | 'receitas' | 'custos' | 'patrimonioLiquido';

export type Valores = {
  /** Assinado: negativo é devedor. */
  saldoAnterior: number;
  totalDebito: number;
  totalCredito: number;
  /** Assinado: negativo é devedor. */
  saldoAtual: number;
};

export type LinhaResumo = Valores & { id: string; rotulo: string };

export type ResumoBalancete = {
  grupos: LinhaResumo[];
  devedoras: LinhaResumo;
  credoras: LinhaResumo;
  resultadoDoMes: LinhaResumo;
  resultadoDoExercicio: LinhaResumo;
  /** Linhas que nenhuma natureza classificou — não entram em nenhum total. */
  foraDoResumo: number;
};

const ROTULOS: Record<GrupoId, string> = {
  ativo: 'ATIVO',
  passivo: 'PASSIVO',
  receitas: 'RECEITAS',
  custos: 'CUSTOS E DESPESAS',
  patrimonioLiquido: 'Patrimônio Líquido',
};

/** A ordem em que o relatório lista os grupos. */
const ORDEM: GrupoId[] = ['ativo', 'passivo', 'receitas', 'custos', 'patrimonioLiquido'];

const DEVEDORAS: GrupoId[] = ['ativo', 'custos'];
const CREDORAS: GrupoId[] = ['passivo', 'receitas', 'patrimonioLiquido'];

const semAcento = (texto: string): string =>
  texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toUpperCase()
    .trim();

/**
 * Natureza → grupo do resumo. Ordem importa e vale a primeira que casar: "DEDUÇÃO DA RECEITA"
 * contém "RECEITA" mas é conta de resultado devedora, então vem antes.
 *
 * Como em `lado.ts`, natureza desconhecida devolve null em vez de chutar um grupo: é melhor a
 * pessoa ver que sobraram linhas fora do resumo do que ver um total errado parecendo certo.
 */
const REGRAS: { quando: (n: string) => boolean; grupo: GrupoId }[] = [
  { quando: (n) => n.includes('DEDUCAO'), grupo: 'custos' },
  { quando: (n) => n.startsWith('ATIVO'), grupo: 'ativo' },
  { quando: (n) => n.startsWith('PASSIVO'), grupo: 'passivo' },
  { quando: (n) => n.includes('PATRIMONIO LIQUIDO'), grupo: 'patrimonioLiquido' },
  { quando: (n) => n.startsWith('RECEITA'), grupo: 'receitas' },
  { quando: (n) => n.startsWith('DESPESA'), grupo: 'custos' },
  { quando: (n) => n.includes('CUSTO'), grupo: 'custos' },
  { quando: (n) => n.includes('TRIBUTO'), grupo: 'custos' },
];

export function grupoDaNatureza(natureza: string): GrupoId | null {
  const n = semAcento(natureza);
  if (n === '') return null;
  return REGRAS.find((r) => r.quando(n))?.grupo ?? null;
}

/** ROUND do Excel em 2 casas: meio centavo arredonda para longe do zero (igual ao resto do motor). */
function arredondar2(valor: number): number {
  const sinal = valor < 0 ? -1 : 1;
  return (sinal * Math.round(Math.abs(valor) * 100)) / 100;
}

const ZERO: Valores = { saldoAnterior: 0, totalDebito: 0, totalCredito: 0, saldoAtual: 0 };

const somar = (a: Valores, b: Valores): Valores => ({
  saldoAnterior: a.saldoAnterior + b.saldoAnterior,
  totalDebito: a.totalDebito + b.totalDebito,
  totalCredito: a.totalCredito + b.totalCredito,
  saldoAtual: a.saldoAtual + b.saldoAtual,
});

const arredondarValores = (v: Valores): Valores => ({
  saldoAnterior: arredondar2(v.saldoAnterior),
  totalDebito: arredondar2(v.totalDebito),
  totalCredito: arredondar2(v.totalCredito),
  saldoAtual: arredondar2(v.saldoAtual),
});

export function resumirBalancete(linhas: LinhaDoResumo[]): ResumoBalancete {
  const porGrupo = new Map<GrupoId, Valores>(ORDEM.map((g) => [g, { ...ZERO }]));
  let foraDoResumo = 0;

  for (const linha of linhas) {
    const grupo = grupoDaNatureza(linha.natureza);
    if (grupo === null) {
      foraDoResumo += 1;
      continue;
    }
    porGrupo.set(grupo, somar(porGrupo.get(grupo)!, linha));
  }

  const valoresDe = (g: GrupoId): Valores => porGrupo.get(g)!;
  const somaDe = (ids: GrupoId[]): Valores => ids.map(valoresDe).reduce(somar, { ...ZERO });

  const receitas = valoresDe('receitas');
  const custos = valoresDe('custos');

  // Resultado do EXERCÍCIO: o acumulado. As colunas de débito e crédito trazem os saldos
  // acumulados de despesa e de receita — é a demonstração do resultado em uma linha.
  const resultadoDoExercicio: Valores = {
    saldoAnterior: receitas.saldoAnterior + custos.saldoAnterior,
    totalDebito: Math.abs(custos.saldoAtual),
    totalCredito: Math.abs(receitas.saldoAtual),
    saldoAtual: receitas.saldoAtual + custos.saldoAtual,
  };

  // Resultado do MÊS: só a movimentação do período, líquida de cada lado. Não tem saldo anterior —
  // o mês começa do zero.
  const debitoDoMes = custos.totalDebito - custos.totalCredito;
  const creditoDoMes = receitas.totalCredito - receitas.totalDebito;
  const resultadoDoMes: Valores = {
    saldoAnterior: 0,
    totalDebito: debitoDoMes,
    totalCredito: creditoDoMes,
    // Assinado pela convenção do motor: sobra de débito é saldo devedor, logo negativo.
    saldoAtual: -(debitoDoMes - creditoDoMes),
  };

  const linha = (id: string, rotulo: string, v: Valores): LinhaResumo => ({
    id,
    rotulo,
    ...arredondarValores(v),
  });

  return {
    grupos: ORDEM.map((g) => linha(g, ROTULOS[g], valoresDe(g))),
    devedoras: linha('devedoras', 'CONTAS DEVEDORAS', somaDe(DEVEDORAS)),
    credoras: linha('credoras', 'CONTAS CREDORAS', somaDe(CREDORAS)),
    resultadoDoMes: linha('resultadoMes', 'RESULTADO DO MÊS', resultadoDoMes),
    resultadoDoExercicio: linha('resultadoExercicio', 'RESULTADO DO EXERCÍCIO', resultadoDoExercicio),
    foraDoResumo,
  };
}
