import { readFileSync } from 'node:fs';
import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import {
  converterNumero,
  detectarPerfil,
  extrairLinhas,
  lerLado,
} from '../../src/leitores/detectar.js';
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

// O formato normal de um balancete brasileiro: o lado vem escrito junto do valor. Antes isto fazia
// a leitura do arquivo FALHAR ("Valor não numérico: 5.574,25D"), e a mensagem é censurada em
// produção — a pessoa via um erro sem explicação. Valores reais do balancete da ZERO MARKETS.
describe('o lado (D/C) escrito no arquivo decide o sinal', () => {
  it.each([
    ['5.574,25D', -5574.25],
    ['5.033,53C', 5033.53],
    ['1.234,56 D', -1234.56],
    ['1.234,56 c', 1234.56],
    ['D 1.234,56', -1234.56],
    ['C1.234,56', 1234.56],
    ['756.099,49D', -756099.49],
    ['0,00', 0],
  ])('converte %s em %s', (entrada, esperado) => {
    expect(converterNumero(entrada)).toBeCloseTo(esperado, 2);
  });

  it('o lado manda sobre o sinal escrito, porque é a origem dizendo o lado', () => {
    expect(converterNumero('-1.234,56C')).toBeCloseTo(1234.56, 2);
  });

  it('uma célula que é só a letra não é número', () => {
    expect(() => converterNumero('D')).toThrow(/"D"/);
    expect(() => converterNumero('TOTAL C')).toThrow(/TOTAL C/);
  });

  it.each([
    ['D', 'D'],
    ['c', 'C'],
    ['Devedor', 'D'],
    ['CREDORA', 'C'],
    ['Débito', 'D'],
    ['crédito', 'C'],
    ['ATIVO CIRCULANTE', ''],
    ['', ''],
  ])('coluna de lado: %s → %s', (entrada, esperado) => {
    expect(lerLado(entrada)).toBe(esperado);
  });

  it('coluna separada de D/C define o sinal do saldo atual', () => {
    const m: Matriz = [
      ['codi_cta', 'nome_cta', 'clas_cta', 'tipo_cta', 'saldoant', 'totdeb', 'totcre', 'saldoatu', 'd/c'],
      ['566', 'BANCO INTER', '1.1.10.200.001', 'A', '3729,58', '25668,41', '23823,74', '5574,25', 'D'],
      ['10001', 'FORNECEDORES', '2.1.30.100.000', 'A', '0', '0', '0', '5033,53', 'C'],
      // Sem indicação na coluna, vale o sinal que vier no número.
      ['245', 'CAPITAL SOCIAL', '2.3.10.100.000', 'A', '0', '0', '0', '30000', ''],
    ];
    const d = detectarPerfil(m);
    expect(d).not.toBeNull();
    expect(d?.colunas.ladoSaldo).toBe(8);
    const linhas = extrairLinhas(m, d!.linhaCabecalho, d!.colunas);
    expect(linhas.map((l) => l.saldoAtual)).toEqual([-5574.25, 5033.53, 30000]);
  });

  it('coluna "natureza" com texto de natureza é ignorada, não vira lado', () => {
    const m: Matriz = [
      ['codi_cta', 'nome_cta', 'clas_cta', 'tipo_cta', 'saldoant', 'totdeb', 'totcre', 'saldoatu', 'natureza'],
      ['566', 'BANCO INTER', '1.1.10.200.001', 'A', '0', '0', '0', '-5574,25', 'ATIVO CIRCULANTE'],
    ];
    const d = detectarPerfil(m);
    const linhas = extrairLinhas(m, d!.linhaCabecalho, d!.colunas);
    expect(linhas[0].saldoAtual).toBeCloseTo(-5574.25, 2);
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
