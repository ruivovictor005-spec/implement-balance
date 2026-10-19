// Extrai da planilha original a massa real de teste (as fixtures em fixtures/*.json).
//
// Uso: npx tsx scripts/extrair-fixtures.ts "<caminho do .xlsm>"
//
// Lê somente os VALORES EM CACHE das células (nunca as fórmulas). As colunas calculadas da planilha
// (nome normalizado, código sugerido, status, natureza, grupos) são o gabarito contra o qual o motor
// será comparado. Nada é aparado (trim): espaços no início/fim importam em vários pontos
// (trechos da normalização, linhas posicionais do TXT, códigos como "      -").
//
// Os dados da empresa (CNPJ, código, nome) não são lidos: a aba de configuração não é aberta e o
// registro 01 do TXT não existe na planilha (cabeçalho desligado).

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as XLSX from 'xlsx';
import type {
  ContaPlano,
  LinhaBalanceteGabarito,
  RegraNatureza,
  RegraNormalizacao,
  SinonimoFixture,
} from '../src/motor/tipos.js';

const ABAS = {
  plano: 'Plano Domínio',
  balancete: 'Balancete importado',
  importacao: 'Importação',
  natureza: 'Natureza COSIF',
  normalizacao: 'Normalização',
  sinonimos: 'Sinônimos',
} as const;

const PASTA_FIXTURES = new URL('../fixtures/', import.meta.url);

type Aba = XLSX.WorkSheet;

function referencia(endereco: string, aba: string): string {
  return `${aba}!${endereco}`;
}

/** Valor em cache da célula, como texto exato. Célula ausente ou vazia vira ''. */
function texto(aba: Aba, nomeAba: string, coluna: string, linha: number): string {
  const endereco = `${coluna}${linha}`;
  const celula = aba[endereco] as XLSX.CellObject | undefined;
  if (celula === undefined || celula.v === undefined || celula.v === null) return '';
  if (typeof celula.v === 'string') return celula.v;
  if (typeof celula.v === 'number') {
    // Número armazenado como número (ex.: código reduzido 1, 18). Se o formato de exibição
    // diferisse do valor (zeros à esquerda, por exemplo), a forma textual seria outra: falha alto.
    if (celula.w !== undefined && celula.w !== String(celula.v)) {
      throw new Error(
        `${referencia(endereco, nomeAba)}: valor ${celula.v} é exibido como "${celula.w}"; decidir qual é a forma textual`,
      );
    }
    return String(celula.v);
  }
  throw new Error(`${referencia(endereco, nomeAba)}: tipo de célula inesperado "${celula.t}"`);
}

function numero(aba: Aba, nomeAba: string, coluna: string, linha: number): number {
  const endereco = `${coluna}${linha}`;
  const celula = aba[endereco] as XLSX.CellObject | undefined;
  if (celula === undefined || typeof celula.v !== 'number') {
    throw new Error(`${referencia(endereco, nomeAba)}: esperado número, veio ${JSON.stringify(celula?.v)}`);
  }
  return celula.v;
}

function exigir(valor: string, aba: string, coluna: string, linha: number): string {
  if (valor === '') throw new Error(`${referencia(`${coluna}${linha}`, aba)}: valor obrigatório vazio`);
  return valor;
}

function ultimaLinhaDaAba(aba: Aba): number {
  const ref = aba['!ref'];
  if (ref === undefined) throw new Error('Aba sem dimensão');
  return XLSX.utils.decode_range(ref).e.r + 1;
}

/**
 * Percorre as linhas de dados a partir de `primeira` e monta um item por linha preenchida.
 * Linhas vazias no fim (a planilha tem fórmulas e espaços reservados até a linha 2000 ou 3000)
 * não geram item. Uma linha preenchida depois de uma vazia indicaria dado que seria descartado
 * em silêncio, então falha.
 */
function lerLinhas<T>(
  aba: Aba,
  nomeAba: string,
  primeira: number,
  colunasChave: string[],
  montar: (linha: number) => T,
): T[] {
  const itens: T[] = [];
  const ultima = ultimaLinhaDaAba(aba);
  let linhaVazia: number | undefined;
  for (let linha = primeira; linha <= ultima; linha++) {
    const preenchida = colunasChave.some((coluna) => texto(aba, nomeAba, coluna, linha) !== '');
    if (!preenchida) {
      linhaVazia ??= linha;
      continue;
    }
    if (linhaVazia !== undefined) {
      throw new Error(`${nomeAba}: linha ${linha} tem dados depois da linha vazia ${linhaVazia}`);
    }
    itens.push(montar(linha));
  }
  return itens;
}

function extrairPlano(aba: Aba): ContaPlano[] {
  const nome = ABAS.plano;
  return lerLinhas(aba, nome, 2, ['A', 'B', 'C', 'D'], (linha) => {
    const tipo = texto(aba, nome, 'D', linha);
    if (tipo !== 'A' && tipo !== 'S') {
      throw new Error(`${referencia(`D${linha}`, nome)}: tipo "${tipo}" não é A nem S`);
    }
    return {
      codigoReduzido: exigir(texto(aba, nome, 'A', linha), nome, 'A', linha),
      classificacao: exigir(texto(aba, nome, 'B', linha), nome, 'B', linha),
      descricao: exigir(texto(aba, nome, 'C', linha), nome, 'C', linha),
      tipo,
      descricaoNormalizada: exigir(texto(aba, nome, 'E', linha), nome, 'E', linha),
    };
  });
}

function extrairSinonimos(aba: Aba): SinonimoFixture[] {
  const nome = ABAS.sinonimos;
  return lerLinhas(aba, nome, 5, ['B', 'C', 'F'], (linha) => ({
    nomeOriginal: exigir(texto(aba, nome, 'B', linha), nome, 'B', linha),
    chaveNormalizada: exigir(texto(aba, nome, 'F', linha), nome, 'F', linha),
    codigoReduzido: exigir(texto(aba, nome, 'C', linha), nome, 'C', linha),
  }));
}

function extrairNormalizacao(aba: Aba): RegraNormalizacao[] {
  const nome = ABAS.normalizacao;
  const ultima = ultimaLinhaDaAba(aba);
  const etapas: { etapa: 1 | 2; colunaDe: string; colunaPara: string }[] = [
    { etapa: 1, colunaDe: 'A', colunaPara: 'B' },
    { etapa: 2, colunaDe: 'D', colunaPara: 'E' },
  ];
  const regras: RegraNormalizacao[] = [];
  for (const { etapa, colunaDe, colunaPara } of etapas) {
    let ordem = 0;
    for (let linha = 2; linha <= ultima; linha++) {
      const de = texto(aba, nome, colunaDe, linha);
      const para = texto(aba, nome, colunaPara, linha);
      // Espaço sem trecho a substituir é inerte na planilha (SUBSTITUTE com texto vazio não altera nada).
      if (de === '') {
        if (para !== '') {
          console.log(
            `  aviso: ${nome} etapa ${etapa}, linha ${linha}: espaço sem trecho (substituir por ${JSON.stringify(para)}) ignorado`,
          );
        }
        continue;
      }
      ordem += 1;
      regras.push({ etapa, ordem, de, para });
    }
  }
  return regras;
}

function extrairNatureza(aba: Aba): RegraNatureza[] {
  const nome = ABAS.natureza;
  let ordem = 0;
  return lerLinhas(aba, nome, 5, ['A', 'B', 'C', 'D'], (linha) => {
    ordem += 1;
    const grupos = exigir(texto(aba, nome, 'D', linha), nome, 'D', linha);
    const naoMigrar = grupos === 'NÃO MIGRAR';
    return {
      ordem,
      prefixo: exigir(texto(aba, nome, 'A', linha), nome, 'A', linha),
      grupoCosif: exigir(texto(aba, nome, 'B', linha), nome, 'B', linha),
      natureza: exigir(texto(aba, nome, 'C', linha), nome, 'C', linha),
      gruposDominio: naoMigrar ? [] : grupos.split('|'),
      naoMigrar,
    };
  });
}

function extrairBalancete(aba: Aba): LinhaBalanceteGabarito[] {
  const nome = ABAS.balancete;
  return lerLinhas(aba, nome, 2, ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'], (linha) => {
    const grupos = texto(aba, nome, 'R', linha);
    return {
      codiCta: exigir(texto(aba, nome, 'A', linha), nome, 'A', linha),
      nomeCta: exigir(texto(aba, nome, 'B', linha), nome, 'B', linha),
      clasCta: exigir(texto(aba, nome, 'C', linha), nome, 'C', linha),
      tipoCta: exigir(texto(aba, nome, 'D', linha), nome, 'D', linha),
      saldoAnterior: numero(aba, nome, 'E', linha),
      totalDebito: numero(aba, nome, 'F', linha),
      totalCredito: numero(aba, nome, 'G', linha),
      saldoAtual: numero(aba, nome, 'H', linha),
      // Entrada digitada pela pessoa (coluna L), não resultado de fórmula. Vazia quando não houve.
      ajusteManual: texto(aba, nome, 'L', linha),
      // Gabarito: o que a planilha calculou, copiado como está (K, Q, R, M, P). Texto vazio onde a
      // planilha deixa vazio. "NÃO MIGRAR" na coluna R vira o item literal ["NÃO MIGRAR"].
      nomeNormalizadoEsperado: texto(aba, nome, 'K', linha),
      naturezaEsperada: texto(aba, nome, 'Q', linha),
      gruposEsperados: grupos === '' ? [] : grupos.split('|'),
      codigoEsperado: texto(aba, nome, 'M', linha),
      statusEsperado: texto(aba, nome, 'P', linha),
    };
  });
}

function extrairTxt(aba: Aba): string[] {
  const nome = ABAS.importacao;
  const linhas: string[] = [];
  for (let linha = 12; linha <= 35; linha++) {
    linhas.push(exigir(texto(aba, nome, 'H', linha), nome, 'H', linha));
  }
  return linhas;
}

function abaObrigatoria(livro: XLSX.WorkBook, nome: string): Aba {
  const aba = livro.Sheets[nome];
  if (aba === undefined) throw new Error(`A planilha não tem a aba "${nome}"`);
  return aba;
}

function gravar(arquivo: string, dados: unknown): void {
  writeFileSync(new URL(arquivo, PASTA_FIXTURES), `${JSON.stringify(dados, null, 2)}\n`, 'utf8');
}

function main(): void {
  const caminho = process.argv[2];
  if (caminho === undefined) {
    console.error('Uso: npx tsx scripts/extrair-fixtures.ts "<caminho do .xlsm>"');
    process.exit(1);
  }

  const livro = XLSX.read(readFileSync(caminho), {
    type: 'buffer',
    cellFormula: false,
    cellHTML: false,
    cellStyles: false,
    sheets: Object.values(ABAS),
  });
  const aba = (nome: string): Aba => abaObrigatoria(livro, nome);

  const plano = extrairPlano(aba(ABAS.plano));
  const sinonimos = extrairSinonimos(aba(ABAS.sinonimos));
  const normalizacao = extrairNormalizacao(aba(ABAS.normalizacao));
  const natureza = extrairNatureza(aba(ABAS.natureza));
  const balancete = extrairBalancete(aba(ABAS.balancete));
  const txt = extrairTxt(aba(ABAS.importacao));

  mkdirSync(PASTA_FIXTURES, { recursive: true });
  gravar('plano.json', plano);
  gravar('sinonimos.json', sinonimos);
  gravar('normalizacao.json', normalizacao);
  gravar('natureza.json', natureza);
  gravar('balancete.json', balancete);
  gravar('txt-esperado.json', txt);

  const contar = (regras: RegraNormalizacao[], etapa: 1 | 2): number =>
    regras.filter((r) => r.etapa === etapa).length;
  console.log(`plano.json          ${plano.length} contas`);
  console.log(`sinonimos.json      ${sinonimos.length} sinônimos`);
  console.log(
    `normalizacao.json   ${normalizacao.length} regras (etapa 1: ${contar(normalizacao, 1)}, etapa 2: ${contar(normalizacao, 2)})`,
  );
  console.log(`natureza.json       ${natureza.length} regras`);
  console.log(`balancete.json      ${balancete.length} linhas`);
  console.log(`txt-esperado.json   ${txt.length} linhas`);
  console.log(`(arquivos em ${fileURLToPath(PASTA_FIXTURES)})`);
}

main();
