// Auditoria do balancete de ORIGEM, antes de confiar nele: em que plano de contas ele está e se o
// sinal do saldo segue a convenção que o motor assume. Função pura — só olha as linhas.
//
// Por que existe: o motor assume UMA convenção de sinal (débito negativo, crédito positivo, ver
// `lado.ts`) e UMA tabela de natureza para a origem (a COSIF do Infobank). Quando o arquivo não
// segue essas duas coisas, nada estoura: o sistema simplesmente produz tudo errado em silêncio —
// natureza trocada, "saldo invertido" em conta correta e, no limite, um TXT com todos os
// lançamentos do lado contrário, que ainda FECHA (débito e crédito trocados continuam somando
// igual), então nem a diferença do painel acusa. Daí conferir antes.
import { ladoEsperado } from './lado.js';

/** Em qual plano de contas está a classificação do balancete de origem. */
export type PlanoOrigem = 'cosif' | 'dominio' | 'indefinido';

/**
 * Se o sinal do saldo atual segue a convenção do motor (débito negativo) ou a contrária.
 *  - `normal`: devedoras somam débito e credoras somam crédito, como se espera.
 *  - `invertida`: os dois lados somam ao contrário — o arquivo usa a convenção oposta.
 *  - `ausente`: nenhum saldo tem sinal (todos do mesmo sinal). Num balancete de verdade ativo e
 *    passivo ficam em lados opostos, então um arquivo todo de um sinal não traz sinal nenhum: o
 *    D/C se perdeu no export e não há como saber de que lado está cada saldo.
 *  - `indefinida`: não há evidência suficiente para afirmar — e aí não se mexe em nada.
 */
export type Convencao = 'normal' | 'invertida' | 'ausente' | 'indefinida';

export type AuditoriaOrigem = {
  plano: PlanoOrigem;
  convencao: Convencao;
  /** Soma dos saldos das contas cuja natureza espera DÉBITO (ativo, despesa, custo...). */
  devedoras: number;
  /** Soma dos saldos das contas cuja natureza espera CRÉDITO (passivo, PL, receita). */
  credoras: number;
  /** Quantas linhas entraram na conferência de convenção. */
  conferidas: number;
};

const soDigitos = (s: string): string => s.replace(/\D/g, '');

const arredondar2 = (v: number): number => Math.round(v * 100) / 100;

/**
 * O plano da origem pelos grupos de 1º nível que aparecem na classificação.
 *
 * Isto importa porque o grupo 4 quer dizer PASSIVO no COSIF e CUSTO/DESPESA no Domínio, e o 2 quer
 * dizer ATIVO NÃO CIRCULANTE no COSIF e PASSIVO no Domínio: ler um balancete do Domínio pela tabela
 * COSIF troca a natureza de quase tudo — e o grupo 3, que no COSIF é "compensação / não migrar",
 * faria a receita inteira desaparecer do TXT em silêncio.
 *
 * Só se afirma o plano com EVIDÊNCIA, nunca por ausência de evidência:
 *  - 5, 6, 7 ou 8 presentes → COSIF (passivo-REF, patrimônio líquido, receitas e despesas lá).
 *  - 3 E 4 presentes, sem nenhum daqueles → Domínio (receita no 3, custo/despesa no 4).
 *  - qualquer outro caso → `indefinido`, e quem chama segue com o padrão (COSIF) avisando.
 *
 * Exigir os DOIS grupos de resultado do Domínio é o que impede um balancete pequeno — ou só de
 * contas patrimoniais — de ser classificado por acidente.
 */
export function detectarPlanoOrigem(linhas: { clasCta: string }[]): PlanoOrigem {
  const grupos = new Set<string>();
  for (const l of linhas) {
    const d = soDigitos(l.clasCta);
    if (d !== '') grupos.add(d[0]);
  }
  if (['5', '6', '7', '8'].some((g) => grupos.has(g))) return 'cosif';
  if (grupos.has('3') && grupos.has('4')) return 'dominio';
  return 'indefinido';
}

/** Mínimo de contas em CADA lado para o veredito valer. Abaixo disso é pouca evidência. */
const MINIMO_POR_LADO = 2;

/**
 * Compara o lado em que os saldos estão com o lado que a natureza de cada conta espera, olhando o
 * balancete INTEIRO. É um juízo sobre o arquivo, não sobre contas: uma conta pode legitimamente
 * estar virada (banco em cheque especial, prejuízo acumulado, conta redutora), mas o ativo todo no
 * crédito e o passivo todo no débito ao mesmo tempo não é erro de lançamento — é o arquivo usando a
 * convenção de sinal contrária.
 *
 * Saldo zero não conta (não tem lado) e natureza desconhecida não conta (não há o que esperar).
 */
export function conferirConvencao(
  linhas: { natureza: string; saldoAtual: number }[],
): Omit<AuditoriaOrigem, 'plano'> {
  let devedoras = 0;
  let credoras = 0;
  let nD = 0;
  let nC = 0;
  let negativos = 0;
  let positivos = 0;
  for (const l of linhas) {
    const saldo = arredondar2(l.saldoAtual);
    if (saldo === 0) continue;
    const esperado = ladoEsperado(l.natureza);
    if (esperado === null) continue;
    if (esperado === 'D') {
      devedoras += l.saldoAtual;
      nD += 1;
    } else {
      credoras += l.saldoAtual;
      nC += 1;
    }
    if (saldo < 0) negativos += 1;
    else positivos += 1;
  }
  const base = {
    devedoras: arredondar2(devedoras),
    credoras: arredondar2(credoras),
    conferidas: nD + nC,
  };
  if (nD < MINIMO_POR_LADO || nC < MINIMO_POR_LADO) return { ...base, convencao: 'indefinida' };
  // Tudo do mesmo sinal: o arquivo não traz sinal. Ativo e passivo ficam em lados opostos num
  // balancete de verdade, então isto não é convenção nenhuma — é o D/C perdido no export.
  if (negativos === 0 || positivos === 0) return { ...base, convencao: 'ausente' };
  // A convenção do motor: devedoras somam negativo, credoras somam positivo.
  if (base.devedoras < 0 && base.credoras > 0) return { ...base, convencao: 'normal' };
  if (base.devedoras > 0 && base.credoras < 0) return { ...base, convencao: 'invertida' };
  return { ...base, convencao: 'indefinida' };
}

/**
 * True quando o sinal do arquivo NÃO serve como está: ou está trocado, ou não existe. Nos dois
 * casos o lado de cada saldo é desconhecido, então conferir conta por conta só gera alarme falso e
 * o TXT não pode ser dado como pronto. `indefinida` não entra: ali o problema é falta de massa para
 * julgar, não evidência de que o sinal esteja errado.
 */
export const sinalNaoConfiavel = (convencao: Convencao): boolean =>
  convencao === 'invertida' || convencao === 'ausente';

/** Plano e convenção juntos: o que o sistema sabe dizer sobre o arquivo que recebeu. */
export function auditarOrigem(
  balancete: { clasCta: string }[],
  analiticas: { natureza: string; saldoAtual: number }[],
): AuditoriaOrigem {
  return { plano: detectarPlanoOrigem(balancete), ...conferirConvencao(analiticas) };
}
