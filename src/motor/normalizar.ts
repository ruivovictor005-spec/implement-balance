// Normalização do nome da conta (§6.2). Reproduz as duas etapas de SUBSTITUTE da planilha.
import type { RegraNormalizacao } from './tipos.js';

const ESPACO_NAO_SEPARAVEL = '\u00A0';

/**
 * TRIM do Excel: tira os espaços das pontas e reduz cada sequência interna a um espaço só.
 * É esse colapso que faz "CITI BANK - 0429901014" virar "CITI BANK 0429901014" depois de a
 * etapa 1 trocar o hífen por espaço. Como no Excel, só o espaço comum conta.
 */
function aparar(texto: string): string {
  return texto
    .split(' ')
    .filter((pedaco) => pedaco !== '')
    .join(' ');
}

/**
 * Aplica as regras de uma etapa em cadeia, na ordem do campo `ordem`, cada uma sobre o
 * resultado da anterior e substituindo todas as ocorrências.
 */
function aplicarEtapa(texto: string, regras: RegraNormalizacao[], etapa: 1 | 2): string {
  const daEtapa = regras.filter((regra) => regra.etapa === etapa).sort((a, b) => a.ordem - b.ordem);
  let atual = texto;
  for (const regra of daEtapa) {
    // Trecho vazio é inerte: no Excel, SUBSTITUTE com texto antigo vazio devolve o texto intacto.
    if (regra.de === '') continue;
    // split/join e não replaceAll: no replaceAll o `$` do texto de substituição teria
    // significado especial, e aqui "substituir por" é texto literal.
    atual = atual.split(regra.de).join(regra.para);
  }
  return atual;
}

/**
 * Nome da conta na forma com que o motor compara: maiúsculas, sem acento nem pontuação e com
 * as abreviações do dicionário expandidas. O texto é envolvido em espaços antes de cada etapa
 * para que trechos como ` DE ` casem palavra inteira.
 */
export function normalizarNome(nome: string, regras: RegraNormalizacao[]): string {
  const maiusculas = nome.toUpperCase().split(ESPACO_NAO_SEPARAVEL).join(' ');
  const etapa1 = aplicarEtapa(` ${maiusculas} `, regras, 1);
  const etapa2 = aplicarEtapa(` ${aparar(etapa1)} `, regras, 2);
  return aparar(etapa2);
}
