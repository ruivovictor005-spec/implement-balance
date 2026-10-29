import { readFileSync } from 'node:fs';
import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { converterNumero, detectarPerfil, extrairLinhas } from '../../src/leitores/detectar.js';
import { ErroDeArquivo, lerArquivo, lerArquivoComFormato } from '../../src/leitores/ler-arquivo.js';
import type { Matriz } from '../../src/leitores/ler-arquivo.js';

const bytesDe = (arquivo: string): Uint8Array =>
  new Uint8Array(readFileSync(new URL(`../../fixtures/arquivos/${arquivo}`, import.meta.url)));

const matrizDe = (arquivo: string): Promise<Matriz> => lerArquivo(bytesDe(arquivo), arquivo);

describe('reconhecimento e extração', () => {
  it('reconhece o perfil Domínio pelos nomes de coluna', async () => {
    const d = detectarPerfil(await matrizDe('balancete-dominio.xlsx'));
    expect(d).not.toBeNull();
    expect(d?.perfil.id).toBe('dominio');
    expect(d?.linhaCabecalho).toBe(1);
  });

  it('extrai 113 linhas, 27 analíticas', async () => {
    const m = await matrizDe('balancete-dominio.xlsx');
    const d = detectarPerfil(m);
    const linhas = extrairLinhas(m, d!.linhaCabecalho, d!.colunas);
    expect(linhas).toHaveLength(113);
    expect(linhas.filter((l) => !l.tipoCta.startsWith('S'))).toHaveLength(27);
  });

  it('acha o cabeçalho quando não está na primeira linha', async () => {
    const d = detectarPerfil(await matrizDe('balancete-com-titulo.xlsx'));
    expect(d?.perfil.id).toBe('dominio');
    expect(d?.linhaCabecalho).toBe(4); // três linhas de título antes do cabeçalho
  });

  it('lê CSV com decimal por vírgula e extrai as mesmas 113 linhas', async () => {
    const m = await matrizDe('balancete-virgula-decimal.csv');
    const d = detectarPerfil(m);
    expect(d?.perfil.id).toBe('dominio');
    expect(extrairLinhas(m, d!.linhaCabecalho, d!.colunas)).toHaveLength(113);
  });

  it('layout desconhecido devolve null', () => {
    const m: Matriz = [
      ['coluna 1', 'coluna 2', 'coluna 3'],
      ['a', 'b', 'c'],
    ];
    expect(detectarPerfil(m)).toBeNull();
  });

  it('recusa .xls com mensagem explicando o que fazer', async () => {
    await expect(lerArquivo(new Uint8Array(), 'balancete.xls')).rejects.toThrow(/\.xls/);
    await expect(lerArquivo(new Uint8Array(), 'balancete.xls')).rejects.toThrow(/salve como/i);
  });

  // As falhas causadas pelo arquivo precisam ser distinguíveis de um defeito do sistema: é o que
  // permite mostrá-las na tela em vez de deixar a Server Action censurar a mensagem em produção.
  it.each([
    ['.xls antigo', 'balancete.xls'],
    ['extensão não suportada', 'balancete.pdf'],
    ['arquivo sem extensão', 'balancete'],
  ])('%s é ErroDeArquivo', async (_rotulo, nome) => {
    await expect(lerArquivo(new Uint8Array(), nome)).rejects.toBeInstanceOf(ErroDeArquivo);
  });

  it('planilha ilegível vira ErroDeArquivo, não erro cru do exceljs', async () => {
    // Um .xls antigo renomeado para .xlsx: o exceljs falha com uma mensagem ininteligível.
    const bytes = new Uint8Array([0x09, 0x00, 0x04, 0x00, 0x02, 0x00, 0x10, 0x00]);
    await expect(lerArquivo(bytes, 'renomeado.xlsx')).rejects.toBeInstanceOf(ErroDeArquivo);
    await expect(lerArquivo(bytes, 'renomeado.xlsx')).rejects.toThrow(/renomear um \.xls/i);
  });

  it.each([
    ['1.234,56', 1234.56],
    ['1,234.56', 1234.56],
    ['1.234,56-', -1234.56],
    ['(1.234,56)', -1234.56],
    ['-1.234,56', -1234.56],
    ['', 0],
    [1234.56, 1234.56],
  ])('converte %s em %s', (entrada, esperado) => {
    expect(converterNumero(entrada)).toBeCloseTo(esperado, 2);
  });

  it('texto não numérico lança erro citando o valor', () => {
    expect(() => converterNumero('abc')).toThrow(/abc/);
  });
});

describe('contas sintéticas por negrito', () => {
  it('marca como sintética a linha em negrito, mesmo sem coluna tipo_cta', async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('B');
    ws.addRow(['codi_cta', 'nome_cta', 'clas_cta', 'saldoant', 'totdeb', 'totcre', 'saldoatu']);
    const grupo = ws.addRow(['1', 'ATIVO', '1', '0', '0', '0', '100']);
    grupo.font = { bold: true };
    grupo.getCell(1).font = { bold: true };
    grupo.getCell(2).font = { bold: true };
    ws.addRow(['18', 'Citibank', '1.1.1', '0', '0', '0', '50']);

    const bytes = new Uint8Array((await wb.xlsx.writeBuffer()) as ArrayBuffer);
    const { matriz, negrito } = await lerArquivoComFormato(bytes, 'b.xlsx');
    const d = detectarPerfil(matriz);
    expect(d).not.toBeNull();
    const linhas = extrairLinhas(matriz, d!.linhaCabecalho, d!.colunas, negrito);

    const grupoLinha = linhas.find((l) => l.codiCta === '1');
    const analitica = linhas.find((l) => l.codiCta === '18');
    expect(grupoLinha?.tipoCta.startsWith('S')).toBe(true);
    expect(analitica?.tipoCta.startsWith('S')).toBe(false);
    expect(linhas.filter((l) => !l.tipoCta.startsWith('S'))).toHaveLength(1);
  });
});
