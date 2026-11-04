import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  montarBalancete,
  ordemDaClassificacao,
  type ContaDoPlano,
} from '../../src/motor/arvore-balancete.js';

const plano: ContaDoPlano[] = JSON.parse(
  readFileSync(new URL('../../fixtures/plano.json', import.meta.url), 'utf8'),
).map((c: { codigoReduzido: unknown; classificacao: unknown; descricao: string }) => ({
  codigoReduzido: String(c.codigoReduzido),
  classificacao: String(c.classificacao),
  descricao: c.descricao,
}));

const resumo = (linhas: ReturnType<typeof montarBalancete>) =>
  linhas.map((l) => `${'  '.repeat(l.nivel)}${l.classificacao} ${l.descricao}${l.sintetica ? ' [S]' : ''}`);

describe('ordem da classificação', () => {
  // A comparação numérica colocaria "2" antes de "11102001" e desmontaria a hierarquia.
  it('é de texto, não numérica', () => {
    const ordenado = ['2', '11102001', '1', '21'].sort(ordemDaClassificacao);
    expect(ordenado).toEqual(['1', '11102001', '2', '21']);
  });
});

describe('balancete hierárquico, com o plano real', () => {
  it('a conta analítica traz toda a cadeia de sintéticas acima dela', () => {
    const linhas = montarBalancete([{ codigo: '10', debito: 100, credito: 0 }], plano);

    expect(resumo(linhas)).toEqual([
      '1 ATIVO [S]',
      '  11 Ativo Circulante [S]',
      '    111 Disponível [S]',
      '      11102 Bancos Conta Movimento [S]',
      '        11102001 Bradesco',
    ]);
  });

  it('cada sintética soma tudo o que está abaixo dela', () => {
    // Bradesco (11102001) e Santander (11102006) penduram na mesma sintética.
    const linhas = montarBalancete(
      [
        { codigo: '10', debito: 100, credito: 0 },
        { codigo: '15', debito: 0, credito: 40 },
      ],
      plano,
    );
    const por = new Map(linhas.map((l) => [l.classificacao, l]));

    expect(por.get('11102')!.debito).toBe(100);
    expect(por.get('11102')!.credito).toBe(40);
    expect(por.get('1')!.debito).toBe(100);
    expect(por.get('1')!.credito).toBe(40);
    expect(por.get('11102')!.sintetica).toBe(true);
    expect(por.get('11102001')!.sintetica).toBe(false);
  });

  it('o topo de cada grupo fecha com a soma das suas analíticas', () => {
    const linhas = montarBalancete(
      [
        { codigo: '10', debito: 100, credito: 0 }, // ativo
        { codigo: '235', debito: 0, credito: 300 }, // passivo
        { codigo: '537', debito: 50, credito: 0 }, // despesa
      ],
      plano,
    );
    const por = new Map(linhas.map((l) => [l.classificacao, l]));

    expect(por.get('1')!.descricao).toBe('ATIVO');
    expect(por.get('1')!.debito).toBe(100);
    expect(por.get('2')!.descricao).toBe('PASSIVO');
    expect(por.get('2')!.credito).toBe(300);
    expect(por.get('4')!.descricao).toBe('CUSTOS E DESPESAS');
    expect(por.get('4')!.debito).toBe(50);
  });

  it('os grupos saem na ordem da classificação, com as filhas dentro', () => {
    const linhas = montarBalancete(
      [
        { codigo: '537', debito: 50, credito: 0 }, // despesa (4…), informada primeiro
        { codigo: '10', debito: 100, credito: 0 }, // ativo (1…)
      ],
      plano,
    );
    const classes = linhas.map((l) => l.classificacao);
    expect(classes[0]).toBe('1');
    expect(classes.indexOf('11102001')).toBeLessThan(classes.indexOf('4'));
  });

  it('o nível acompanha a profundidade no plano', () => {
    const linhas = montarBalancete([{ codigo: '10', debito: 1, credito: 0 }], plano);
    expect(linhas.map((l) => l.nivel)).toEqual([0, 1, 2, 3, 4]);
  });

  it('só entram as sintéticas que têm alguma analítica com saldo', () => {
    const linhas = montarBalancete([{ codigo: '10', debito: 1, credito: 0 }], plano);
    // O plano tem 182 sintéticas; aqui só podem aparecer as 4 da cadeia do Bradesco.
    expect(linhas.filter((l) => l.sintetica)).toHaveLength(4);
    expect(linhas.some((l) => l.classificacao === '2')).toBe(false);
  });

  it('balancete vazio não inventa linha nenhuma', () => {
    expect(montarBalancete([], plano)).toEqual([]);
  });

  // Conta que não está no plano não pendura em sintética nenhuma; não pode sumir da conferência.
  it('conta fora do plano vai para o fim, sem classificação', () => {
    const linhas = montarBalancete(
      [
        { codigo: '10', debito: 100, credito: 0 },
        { codigo: 'XX', debito: 7, credito: 0 },
      ],
      plano,
    );
    const ultima = linhas[linhas.length - 1];
    expect(ultima.codigo).toBe('XX');
    expect(ultima.classificacao).toBe('');
    expect(ultima.sintetica).toBe(false);
    expect(ultima.debito).toBe(7);

    // E não entrou em nenhum total:
    const ativo = linhas.find((l) => l.classificacao === '1')!;
    expect(ativo.debito).toBe(100);
  });

  it('o total das analíticas bate com o total dos grupos de topo', () => {
    const saldos = [
      { codigo: '10', debito: 100, credito: 0 },
      { codigo: '15', debito: 0, credito: 40 },
      { codigo: '235', debito: 0, credito: 300 },
      { codigo: '537', debito: 50, credito: 0 },
    ];
    const linhas = montarBalancete(saldos, plano);

    const soma = (ls: typeof linhas, campo: 'debito' | 'credito') =>
      ls.reduce((s, l) => s + l[campo], 0);
    const topos = linhas.filter((l) => l.nivel === 0 && l.sintetica);
    const analiticas = linhas.filter((l) => !l.sintetica);

    expect(soma(topos, 'debito')).toBe(soma(analiticas, 'debito'));
    expect(soma(topos, 'credito')).toBe(soma(analiticas, 'credito'));
  });
});
