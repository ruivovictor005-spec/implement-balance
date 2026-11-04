// Reconhecimento do layout e extração das linhas do balancete. Decide o perfil pelo cabeçalho,
// converte os números no formato que vierem (brasileiro ou americano, sinal à direita, parênteses)
// e devolve as linhas no tipo que o motor consome.
import type { LinhaBalancete } from '../motor/tipos.js';
import type { Celula, Matriz } from './ler-arquivo.js';
import { PERFIS, type Perfil } from './perfis.js';

const LINHAS_PARA_CABECALHO = 20;
const MIN_CAMPOS = 6;

export type Deteccao = { perfil: Perfil; linhaCabecalho: number; colunas: Record<string, number> };

/** minúsculas, sem acento, só letras/dígitos separados por espaço. "Código" e "codigo" viram iguais. */
const normalizar = (s: string): string =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/** O lado escrito na célula: 'D' (devedor) ou 'C' (credor), e o que sobra do valor. */
type ComLado = { lado: 'D' | 'C'; resto: string };

/**
 * Separa a letra de lado que o balancete brasileiro escreve junto do valor: `5.574,25D`,
 * `1.234,56 C`, `D 5.574,25`. Devolve null quando a célula não diz o lado. Uma célula que seja só a
 * letra não casa — ela não tem valor, e vira erro de "valor não numérico" mais adiante.
 */
function separarLado(s: string): ComLado | null {
  const fim = /^(.+?)\s*([DdCc])$/.exec(s);
  if (fim !== null) return { lado: fim[2].toUpperCase() as 'D' | 'C', resto: fim[1].trim() };
  const inicio = /^([DdCc])\s*(.+)$/.exec(s);
  if (inicio !== null) return { lado: inicio[1].toUpperCase() as 'D' | 'C', resto: inicio[2].trim() };
  return null;
}

/**
 * O lado a partir de uma COLUNA de indicação (não da mesma célula do valor): 'D', 'C' ou '' quando
 * a coluna não existe ou traz outra coisa. Aceita a letra, a abreviação e a palavra inteira, com ou
 * sem acento — é como os exports escrevem "D", "Db", "Devedor", "Débito".
 *
 * Qualquer outro texto é ignorado de propósito: num arquivo em que a coluna "natureza" traz
 * "ATIVO CIRCULANTE" em vez de D/C, é melhor não ter indicação do que inventar um lado.
 */
export function lerLado(valor: string | null | undefined): 'D' | 'C' | '' {
  const v = (valor ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toUpperCase()
    .trim();
  if (v === 'D' || v === 'DB' || v.startsWith('DEVEDOR') || v.startsWith('DEBITO')) return 'D';
  if (v === 'C' || v === 'CR' || v.startsWith('CREDOR') || v.startsWith('CREDITO')) return 'C';
  return '';
}

/** O saldo com o sinal que o lado manda: débito negativo, crédito positivo (ver motor/lado.ts). */
export const comLado = (valor: number, lado: 'D' | 'C'): number =>
  lado === 'D' ? -Math.abs(valor) : Math.abs(valor);

/**
 * Número a partir de uma célula. Aceita formato brasileiro e americano, decidindo o separador
 * decimal pela última ocorrência de `,` ou `.`; sinal à direita (`1.234,56-`) e parênteses
 * (`(1.234,56)`) contam como negativo. Vazio é zero. Texto não numérico lança erro com o valor
 * original — errar aqui geraria TXT errado em silêncio.
 *
 * A letra D/C colada no valor (`5.574,25D`) é o próprio balancete dizendo de que lado está o saldo,
 * então ela MANDA no sinal: débito vira negativo, crédito positivo. Antes essa letra fazia a leitura
 * do arquivo falhar — e é o formato normal de um balancete brasileiro.
 */
export function converterNumero(valor: Celula): number {
  if (valor === null) return 0;
  if (typeof valor === 'number') return valor;

  let s = valor.trim();
  if (s === '') return 0;

  const lado = separarLado(s);
  if (lado !== null) s = lado.resto;

  let negativo = false;
  if (/^\(.*\)$/.test(s)) {
    negativo = true;
    s = s.slice(1, -1).trim();
  }
  if (s.endsWith('-')) {
    negativo = true;
    s = s.slice(0, -1).trim();
  } else if (s.startsWith('-')) {
    negativo = true;
    s = s.slice(1).trim();
  } else if (s.startsWith('+')) {
    s = s.slice(1).trim();
  }

  const ultimaVirgula = s.lastIndexOf(',');
  const ultimoPonto = s.lastIndexOf('.');
  let normalizado: string;
  if (ultimaVirgula === -1 && ultimoPonto === -1) {
    normalizado = s;
  } else {
    const separadorDecimal = ultimaVirgula > ultimoPonto ? ',' : '.';
    const separadorMilhar = separadorDecimal === ',' ? '.' : ',';
    normalizado = s.split(separadorMilhar).join('').replace(separadorDecimal, '.');
  }
  normalizado = normalizado.replace(/\s/g, '');

  if (!/^\d+(\.\d+)?$/.test(normalizado)) {
    throw new Error(`Valor não numérico: "${valor}"`);
  }
  const n = Number(normalizado);
  if (lado !== null) return comLado(n, lado.lado);
  return negativo ? -n : n;
}

/** Para cada campo do perfil, a primeira coluna da linha cujo texto casa um dos apelidos. */
function colunasDoPerfil(linha: Celula[], perfil: Perfil): Record<string, number> {
  const normalizadas = linha.map((c) => (c === null ? '' : normalizar(String(c))));
  const colunas: Record<string, number> = {};
  for (const [campo, apelidos] of Object.entries(perfil.apelidos)) {
    const alvos = new Set(apelidos.map(normalizar));
    const idx = normalizadas.findIndex((texto) => texto !== '' && alvos.has(texto));
    if (idx !== -1) colunas[campo] = idx;
  }
  return colunas;
}

/**
 * O perfil e a linha de cabeçalho que melhor casam, procurando nas primeiras linhas (o balancete
 * exportado costuma ter título e dados da empresa acima da tabela). Ganha quem casa mais campos;
 * empate fica com o primeiro perfil (Domínio) e com a linha mais alta. Abaixo do mínimo, é layout
 * desconhecido e devolve `null` — a tela então abre o mapeamento manual.
 */
export function detectarPerfil(m: Matriz): Deteccao | null {
  let melhor: (Deteccao & { pontos: number }) | null = null;
  const limite = Math.min(m.length, LINHAS_PARA_CABECALHO);
  for (let r = 0; r < limite; r++) {
    for (const perfil of PERFIS) {
      const colunas = colunasDoPerfil(m[r], perfil);
      const pontos = Object.keys(colunas).length;
      if (pontos < MIN_CAMPOS) continue;
      if (melhor === null || pontos > melhor.pontos) {
        melhor = { perfil, linhaCabecalho: r + 1, colunas, pontos };
      }
    }
  }
  if (melhor === null) return null;
  const { perfil, linhaCabecalho, colunas } = melhor;
  return { perfil, linhaCabecalho, colunas };
}

/**
 * Linhas do balancete a partir da linha seguinte ao cabeçalho. Linha sem código de conta é pulada
 * (linha em branco ou de totais). Campo de coluna ausente vira texto vazio ou zero.
 */
export function extrairLinhas(
  m: Matriz,
  linhaCabecalho: number,
  colunas: Record<string, number>,
  negrito?: boolean[][],
): LinhaBalancete[] {
  const celula = (linha: Celula[], campo: string): Celula => {
    const idx = colunas[campo];
    return idx === undefined ? null : (linha[idx] ?? null);
  };
  const texto = (linha: Celula[], campo: string): string => {
    const v = celula(linha, campo);
    return v === null ? '' : String(v);
  };

  // Conta sintética (de grupo): quando a coluna tipo_cta começa com "S" OU quando a linha vem em
  // NEGRITO no arquivo (padrão dos balancetes exportados, onde os grupos ficam em negrito).
  const emNegrito = (r: number): boolean => {
    if (negrito === undefined) return false;
    const idxNome = colunas.nomeCta;
    const idxCodi = colunas.codiCta;
    return (
      (idxNome !== undefined && negrito[r]?.[idxNome] === true) ||
      (idxCodi !== undefined && negrito[r]?.[idxCodi] === true)
    );
  };

  const linhas: LinhaBalancete[] = [];
  for (let r = linhaCabecalho; r < m.length; r++) {
    const linha = m[r];
    if (texto(linha, 'codiCta').trim() === '') continue;
    const tipoColuna = texto(linha, 'tipoCta');
    const tipoCta = tipoColuna.startsWith('S') || emNegrito(r) ? 'S' : tipoColuna || 'A';
    // Coluna só de lado (D/C), quando o arquivo tem uma: ela decide o sinal do saldo atual, porque
    // é a origem dizendo de que lado está o saldo. Sem ela, vale o sinal que vier no número.
    const lado = lerLado(texto(linha, 'ladoSaldo'));
    const saldoAtual = converterNumero(celula(linha, 'saldoAtual'));
    linhas.push({
      codiCta: texto(linha, 'codiCta'),
      nomeCta: texto(linha, 'nomeCta'),
      clasCta: texto(linha, 'clasCta'),
      tipoCta,
      saldoAnterior: converterNumero(celula(linha, 'saldoAnterior')),
      totalDebito: converterNumero(celula(linha, 'totalDebito')),
      totalCredito: converterNumero(celula(linha, 'totalCredito')),
      saldoAtual: lado === '' ? saldoAtual : comLado(saldoAtual, lado),
      custoDespesa: texto(linha, 'custoDespesa').trim(),
    });
  }
  return linhas;
}
