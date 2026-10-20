// Borda de entrada: transforma os bytes de um arquivo em uma matriz de células, sem conhecer o
// significado das colunas (isso é do `detectar`). Lê .xlsx/.xlsm por exceljs e .csv/.txt por um
// leitor de delimitado. O formato antigo .xls é recusado: a biblioteca que o lê tem vulnerabilidades
// sem correção publicada e aqui receberia arquivo de qualquer pessoa (spec §7).
//
// Sem `fs`, `path` nem rede: recebe bytes e devolve dados em memória, para poder rodar no servidor
// ou no navegador.
import ExcelJS from 'exceljs';

export type Celula = string | number | null;
export type Matriz = Celula[][];

const MENSAGEM_XLS = 'Este arquivo está no formato antigo .xls; abra no Excel e salve como .xlsx.';

export async function lerArquivo(bytes: Uint8Array, nomeArquivo: string): Promise<Matriz> {
  const ponto = nomeArquivo.lastIndexOf('.');
  const ext = ponto === -1 ? '' : nomeArquivo.slice(ponto).toLowerCase();
  if (ext === '.xls') throw new Error(MENSAGEM_XLS);
  if (ext === '.xlsx' || ext === '.xlsm') return lerPlanilha(bytes);
  if (ext === '.csv' || ext === '.txt') return lerDelimitado(bytes);
  throw new Error(`Extensão não suportada: "${ext || nomeArquivo}". Use .xlsx, .xlsm, .csv ou .txt.`);
}

/** Uma cópia do conteúdo como ArrayBuffer puro, sem a visão `Uint8Array` nem o buffer ao redor. */
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

async function lerPlanilha(bytes: Uint8Array): Promise<Matriz> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(paraArrayBuffer(bytes));
  const ws = wb.worksheets[0];
  if (ws === undefined) return [];
  const matriz: Matriz = [];
  ws.eachRow({ includeEmpty: true }, (row) => {
    // `row.values` é 1-based (o índice 0 é sempre vazio); preserva a posição real das colunas.
    const valores = row.values as ExcelJS.CellValue[];
    const linha: Celula[] = [];
    for (let col = 1; col < valores.length; col++) linha.push(valorDaCelula(valores[col] ?? null));
    matriz.push(linha);
  });
  return matriz;
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
