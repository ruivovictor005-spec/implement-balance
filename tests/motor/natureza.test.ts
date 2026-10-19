import { describe, expect, it } from 'vitest';
import { resolverNatureza } from '../../src/motor/natureza.js';
import { carregarBalancete, carregarNatureza } from '../apoio/fixtures.js';

const regras = carregarNatureza();

describe('resolverNatureza — precedência do prefixo', () => {
  it('prefixo mais específico vence o genérico', () =>
    expect(resolverNatureza('1.1.0.00.00.00.00000', regras)?.natureza).toBe('ATIVO CIRCULANTE'));

  it('cai no genérico quando não há específico', () =>
    expect(resolverNatureza('1.0.0.00.00.00.00000', regras)?.gruposDominio).toEqual(['11', '12']));

  it('totalizador P.L.A. é NÃO MIGRAR', () =>
    expect(resolverNatureza('5.9.9.99', regras)?.naoMigrar).toBe(true));

  it('NÃO MIGRAR não traz grupo nenhum', () =>
    expect(resolverNatureza('5.9.9.99.99.99.99999', regras)?.gruposDominio).toEqual([]));

  it('classificação desconhecida devolve null', () =>
    expect(resolverNatureza('X.Y', regras)).toBeNull());

  it('classificação vazia devolve null', () => expect(resolverNatureza('', regras)).toBeNull());

  it('ignora espaços nas pontas da classificação', () =>
    expect(resolverNatureza('  1.1.0.00  ', regras)?.natureza).toBe('ATIVO CIRCULANTE'));

  it('segue a ordem do campo ordem, não a ordem do array', () => {
    // Genérico primeiro no array, específico primeiro na ordem: vence o específico.
    const foraDeOrdem = [
      { ordem: 2, prefixo: '8', grupoCosif: 'g', natureza: 'DESPESA', gruposDominio: ['4'], naoMigrar: false },
      { ordem: 1, prefixo: '8.9', grupoCosif: 'e', natureza: 'TRIBUTOS S/ LUCRO', gruposDominio: ['46'], naoMigrar: false },
    ];
    expect(resolverNatureza('8.9.1', foraDeOrdem)?.natureza).toBe('TRIBUTOS S/ LUCRO');
  });

  it('não casa prefixo mais longo que a classificação', () =>
    // "8.1.9.25" é mais longo que "8.1.9": a regra do ISS não pode valer para o pai.
    expect(resolverNatureza('8.1.9', regras)?.natureza).toBe('DESPESA'));
});

describe('resolverNatureza — gabarito das 113 linhas do balancete', () => {
  it.each(carregarBalancete())(
    'linha %#: $clasCta',
    ({ clasCta, naturezaEsperada, gruposEsperados }) => {
      const resultado = resolverNatureza(clasCta, regras);
      expect(resultado).not.toBeNull();
      expect(resultado?.natureza).toBe(naturezaEsperada);
      // Ponte com o gabarito: a coluna R da planilha guarda o veto como o item literal
      // "NÃO MIGRAR" no lugar da lista de grupos; aqui ele é `naoMigrar` com lista vazia.
      if (gruposEsperados.length === 1 && gruposEsperados[0] === 'NÃO MIGRAR') {
        expect(resultado?.naoMigrar).toBe(true);
        expect(resultado?.gruposDominio).toEqual([]);
      } else {
        expect(resultado?.naoMigrar).toBe(false);
        expect(resultado?.gruposDominio).toEqual(gruposEsperados);
      }
    },
  );
});
