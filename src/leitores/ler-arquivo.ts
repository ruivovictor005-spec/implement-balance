// Borda de entrada: transforma os bytes de um arquivo em uma matriz de células (e um mapa de quais
// estão em NEGRITO, para reconhecer contas sintéticas por formatação). Lê .xlsx/.xlsm por exceljs e
// .csv/.txt por um leitor de delimitado. O .xls antigo é recusado (vulnerabilidades sem correção).
import ExcelJS from 'exceljs';

export type Celula = string | number | null;
export type Matriz = Celula[][];
export type Leitura = { matriz: Matriz; negrito: boolean[][] };

const MENSAGEM_XLS = 'Este arquivo está no formato antigo .xls; abra no Excel e salve como .xlsx.';

/**
 * Falha causada pelo arquivo enviado, não por um defeito do sistema: a mensagem é escrita para a
 * pessoa ler e pode ser mostrada na tela. Quem chama distingue isto de um erro interno, que não
 * deve virar texto de interface. Erros lançados de dentro de uma Server Action são censurados em
 * produção, então esta mensagem precisa chegar à tela como valor de retorno, nunca lançada.
 */
export class ErroDeArquivo extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = 'ErroDeArquivo';
  }
}

/** Devolve só os valores (compatibilidade). Use `lerArquivoComFormato` para também saber o negrito. */
export async function lerArquivo(bytes: Uint8Array, nomeArquivo: string): Promise<Matriz> {
  return (await lerArquivoComFormato(bytes, nomeArquivo)).matriz;
}

export async function lerArquivoComFormato(bytes: Uint8Array, nomeArquivo: string): Promise<Leitura> {
  const ponto = nomeArquivo.lastIndexOf('.');
  const ext = ponto === -1 ? '' : nomeArquivo.slice(ponto).toLowerCase();
  if (ext === '.xls') throw new ErroDeArquivo(MENSAGEM_XLS);
  if (ext === '.xlsx' || ext === '.xlsm') return lerPlanilha(bytes);
  if (ext === '.csv' || ext === '.txt') {
    const matriz = lerDelimitado(bytes);
    return { matriz, negrito: matriz.map((linha) => linha.map(() => false)) };
  }
  throw new ErroDeArquivo(
    `Extensão não suportada: "${ext || nomeArquivo}". Use .xlsx, .xlsm, .csv ou .txt.`,
  );
}

/** Uma cópia do conteúdo como ArrayBuffer puro. */
function paraArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

/** Valor de exibição de uma célula do exceljs: número/texto como está, fórmula pelo resultado. */
function valorDaCelula(v: ExcelJS.CellValue): Celula {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number' || typeof v === 'string') return v;
  if (typeof v === 'boolean') return String(v);
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'object') {
    if ('result' in v) return valorDaCelula((v as ExcelJS.CellFormulaValue).result ?? null);
    if ('richText' in v) return (v as ExcelJS.CellRichTextValue).richText.map((t) => t.text).join('');
    if ('text' in v) return String((v as ExcelJS.CellHyperlinkValue).text);
    if ('error' in v) return null;
  }
  return null;
}

async function lerPlanilha(bytes: Uint8Array): Promise<Leitura> {
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(paraArrayBuffer(bytes));
  } catch {
    // Arquivo corrompido, vazio, ou .xls antigo renomeado para .xlsx: o exceljs lança algo
    // ininteligível para quem está na tela. Vira mensagem de arquivo.
    throw new ErroDeArquivo(
      'Não consegui abrir esta planilha. Confira se o arquivo não está corrompido e se foi mesmo ' +
        'salvo como .xlsx (renomear um .xls para .xlsx não converte o arquivo).',
    );
  }
  const ws = wb.worksheets[0];
  const matriz: Matriz = [];
  const negrito: boolean[][] = [];
  if (ws === undefined) return { matriz, negrito };

  const nCols = ws.columnCount;
  ws.eachRow({ includeEmpty: true }, (row) => {
    const linha: Celula[] = [];
    const linhaNegrito: boolean[] = [];
    for (let col = 1; col <= nCols; col++) {
      const cell = row.getCell(col);
      linha.push(valorDaCelula(cell.value));
      linhaNegrito.push(cell.font?.bold === true);
    }
    matriz.push(linha);
    negrito.push(linhaNegrito);
  });
  return { matriz, negrito };
}

function lerDelimitado(bytes: Uint8Array): Matriz {
  const texto = new TextDecoder('utf-8').decode(bytes).replace(/^﻿/, '');
  const linhas = texto.split(/\r\n|\n|\r/);
  while (linhas.length > 0 && linhas[linhas.length - 1] === '') linhas.pop();
  if (linhas.length === 0) return [];
  const delimitador = escolherDelimitador(linhas[0]);
  return linhas.map((linha) => dividirLinha(linha, delimitador));
}

/** O delimitador mais frequente no cabeçalho, entre `;`, tabulação e `,`. Empate fica com `;`. */
function escolherDelimitador(cabecalho: string): string {
  let melhor = ';';
  let max = -1;
  for (const candidato of [';', '\t', ',']) {
    const n = cabecalho.split(candidato).length - 1;
    if (n > max) {
      max = n;
      melhor = candidato;
    }
  }
  return melhor;
}

/** Divide uma linha respeitando aspas duplas, com `""` escapando aspas dentro do campo. */
function dividirLinha(linha: string, delimitador: string): Celula[] {
  const campos: Celula[] = [];
  let atual = '';
  let dentroAspas = false;
  for (let i = 0; i < linha.length; i++) {
    const c = linha[i];
    if (c === '"') {
      if (dentroAspas && linha[i + 1] === '"') {
        atual += '"';
        i++;
      } else {
        dentroAspas = !dentroAspas;
      }
    } else if (c === delimitador && !dentroAspas) {
      campos.push(atual);
      atual = '';
    } else {
      atual += c;
    }
  }
  campos.push(atual);
  return campos;
}
