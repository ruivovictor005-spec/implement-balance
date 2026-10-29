// Lado do saldo (débito ou crédito) e detecção de saldo invertido. Função pura — só olha o número e
// o texto da natureza, sem banco e sem I/O.
//
// A convenção do sinal é a do balancete de origem e está fixada em `agregar.ts`, que monta as
// partidas: saldo NEGATIVO é débito, POSITIVO é crédito. É por isso que o ativo chega com menos.

export type Lado = 'D' | 'C';

/** O lado em que o saldo está. Zero não tem lado. */
export function ladoDoSaldo(saldoAtual: number): Lado | null {
  if (saldoAtual < 0) return 'D';
  if (saldoAtual > 0) return 'C';
  return null;
}

const semAcento = (texto: string): string =>
  texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toUpperCase()
    .trim();

/**
 * Lado em que cada natureza normalmente deixa o saldo. A ordem importa e vale a primeira que casar:
 * "DEDUÇÃO DA RECEITA" contém "RECEITA" mas é devedora, então vem antes.
 *
 * A lista de naturezas é DADO (vem de `natureza.json`, versionado) e pode crescer. Por isso o padrão
 * é não opinar: natureza desconhecida devolve null e nunca é apontada como invertida — é melhor não
 * avisar do que acusar um saldo correto de estar virado.
 */
const REGRAS: { quando: (n: string) => boolean; lado: Lado }[] = [
  { quando: (n) => n.includes('DEDUCAO'), lado: 'D' },
  { quando: (n) => n.startsWith('ATIVO'), lado: 'D' },
  { quando: (n) => n.startsWith('PASSIVO'), lado: 'C' },
  { quando: (n) => n.includes('PATRIMONIO LIQUIDO'), lado: 'C' },
  { quando: (n) => n.startsWith('RECEITA'), lado: 'C' },
  { quando: (n) => n.startsWith('DESPESA'), lado: 'D' },
  { quando: (n) => n.includes('CUSTO'), lado: 'D' },
  { quando: (n) => n.includes('TRIBUTO'), lado: 'D' },
];

/** O lado esperado para a natureza, ou null quando não se sabe dizer. */
export function ladoEsperado(natureza: string): Lado | null {
  const n = semAcento(natureza);
  if (n === '') return null;
  return REGRAS.find((r) => r.quando(n))?.lado ?? null;
}

/**
 * True quando o saldo está no lado CONTRÁRIO ao da natureza da conta — um ativo credor, um passivo
 * devedor. Costuma ser erro de lançamento na origem, e é o que a pessoa precisa ver antes de
 * importar. Saldo zero, natureza vazia ou natureza desconhecida não são apontados.
 */
export function saldoInvertido(saldoAtual: number, natureza: string): boolean {
  const atual = ladoDoSaldo(saldoAtual);
  const esperado = ladoEsperado(natureza);
  if (atual === null || esperado === null) return false;
  return atual !== esperado;
}
