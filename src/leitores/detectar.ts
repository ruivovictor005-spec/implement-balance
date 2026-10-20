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

/**
 * Número a partir de uma célula. Aceita formato brasileiro e americano, decidindo o separador
 * decimal pela última ocorrência de `,` ou `.`; sinal à direita (`1.234,56-`) e parênteses
 * (`(1.234,56)`) contam como negativo. Vazio é zero. Texto não numérico lança erro com o valor
 * original — errar aqui geraria TXT errado em silêncio.
 */
export function converterNumero(valor: Celula): number {
  if (valor === null) return 0;
  if (typeof valor === 'number') return valor;

  let s = valor.trim();
  if (s === '') return 0;

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
): LinhaBalancete[] {
  const celula = (linha: Celula[], campo: string): Celula => {
    const idx = colunas[campo];
    return idx === undefined ? null : (linha[idx] ?? null);
  };
  const texto = (linha: Celula[], campo: string): string => {
    const v = celula(linha, campo);
    return v === null ? '' : String(v);
  };

  const linhas: LinhaBalancete[] = [];
  for (let r = linhaCabecalho; r < m.length; r++) {
    const linha = m[r];
    if (texto(linha, 'codiCta').trim() === '') continue;
    linhas.push({
      codiCta: texto(linha, 'codiCta'),
      nomeCta: texto(linha, 'nomeCta'),
      clasCta: texto(linha, 'clasCta'),
      tipoCta: texto(linha, 'tipoCta'),
      saldoAnterior: converterNumero(celula(linha, 'saldoAnterior')),
      totalDebito: converterNumero(celula(linha, 'totalDebito')),
      totalCredito: converterNumero(celula(linha, 'totalCredito')),
      saldoAtual: converterNumero(celula(linha, 'saldoAtual')),
    });
  }
  return linhas;
}
