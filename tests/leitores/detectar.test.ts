import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { converterNumero, detectarPerfil, extrairLinhas } from '../../src/leitores/detectar.js';
import { lerArquivo } from '../../src/leitores/ler-arquivo.js';
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
