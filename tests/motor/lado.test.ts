import { describe, expect, it } from 'vitest';
import { ladoDoSaldo, ladoEsperado, saldoInvertido } from '../../src/motor/lado.js';

describe('lado do saldo', () => {
  // A convenção é a de `agregar.ts`, que monta as partidas: negativo é débito.
  it.each([
    [-1234.56, 'D'],
    [-0.01, 'D'],
    [1234.56, 'C'],
    [0.01, 'C'],
  ])('saldo %s está em %s', (saldo, esperado) => {
    expect(ladoDoSaldo(saldo)).toBe(esperado);
  });

  it('saldo zero não tem lado', () => {
    expect(ladoDoSaldo(0)).toBeNull();
    expect(ladoDoSaldo(-0)).toBeNull();
  });
});

describe('lado esperado pela natureza', () => {
  it.each([
    ['ATIVO', 'D'],
    ['ATIVO CIRCULANTE', 'D'],
    ['ATIVO NÃO CIRCULANTE', 'D'],
    ['PASSIVO', 'C'],
    ['PASSIVO - REF', 'C'],
    ['PATRIMÔNIO LÍQUIDO', 'C'],
    ['RECEITA', 'C'],
    ['RECEITA DE SERVIÇOS', 'C'],
    ['RECEITA FINANCEIRA', 'C'],
    ['RECEITA DE INVESTIMENTOS', 'C'],
    ['DESPESA', 'D'],
    ['DESPESA ADMINISTRATIVA', 'D'],
    ['DESPESA / CUSTO', 'D'],
    ['TRIBUTOS S/ LUCRO', 'D'],
  ])('%s é %s', (natureza, esperado) => {
    expect(ladoEsperado(natureza)).toBe(esperado);
  });

  // Contém "RECEITA", mas dedução é conta devedora: a ordem das regras tem de pegar isso.
  it('dedução da receita é devedora, apesar de conter "RECEITA"', () => {
    expect(ladoEsperado('DEDUÇÃO DA RECEITA')).toBe('D');
  });

  it('acento e caixa não mudam o resultado', () => {
    expect(ladoEsperado('patrimônio líquido')).toBe('C');
    expect(ladoEsperado('PATRIMONIO LIQUIDO')).toBe('C');
    expect(ladoEsperado('  Ativo Circulante  ')).toBe('D');
  });

  // A lista de naturezas é dado versionado e pode crescer; o padrão tem de ser não opinar.
  it.each([['COMPENSAÇÃO'], ['TOTALIZADOR P.L.A.'], ['NATUREZA QUE AINDA NÃO EXISTE'], ['']])(
    'natureza %s não tem lado esperado',
    (natureza) => {
      expect(ladoEsperado(natureza)).toBeNull();
    },
  );
});

describe('saldo invertido', () => {
  it('ativo credor e passivo devedor são apontados', () => {
    expect(saldoInvertido(500, 'ATIVO CIRCULANTE')).toBe(true);
    expect(saldoInvertido(-500, 'PASSIVO')).toBe(true);
    expect(saldoInvertido(500, 'DESPESA')).toBe(true);
    expect(saldoInvertido(-500, 'RECEITA DE SERVIÇOS')).toBe(true);
  });

  it('saldo no lado certo não é apontado', () => {
    expect(saldoInvertido(-500, 'ATIVO CIRCULANTE')).toBe(false);
    expect(saldoInvertido(500, 'PASSIVO')).toBe(false);
    expect(saldoInvertido(-500, 'DESPESA')).toBe(false);
    expect(saldoInvertido(500, 'PATRIMÔNIO LÍQUIDO')).toBe(false);
  });

  // Não acusar um saldo correto de estar virado é mais importante que avisar.
  it('natureza desconhecida, vazia ou saldo zero nunca são apontados', () => {
    expect(saldoInvertido(500, 'COMPENSAÇÃO')).toBe(false);
    expect(saldoInvertido(-500, 'NATUREZA NOVA')).toBe(false);
    expect(saldoInvertido(500, '')).toBe(false);
    expect(saldoInvertido(0, 'ATIVO')).toBe(false);
  });
});
