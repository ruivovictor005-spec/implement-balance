import { describe, expect, it } from 'vitest';
import { gerarLancamentos, type Lancamento, type SaldoResolvido } from '../../src/motor/agregar.js';
import { criarIndicePlano } from '../../src/motor/resolver.js';
import type { ContaPlano } from '../../src/motor/tipos.js';
import {
  carregarBalancete,
  carregarPlano,
  carregarTxtEsperado,
  somenteAnaliticas,
} from '../apoio/fixtures.js';

function conta(codigoReduzido: string, classificacao: string, descricao: string): ContaPlano {
  return {
    codigoReduzido,
    classificacao,
    descricao,
    tipo: 'A',
    descricaoNormalizada: descricao.toUpperCase(),
  };
}

const indice = criarIndicePlano([
  conta('1', '11101001', 'Caixa Geral'),
  conta('2', '21101001', 'Fornecedores a Pagar'),
  conta('3', '11101002', 'Banco Conta Movimento'),
]);

/** Saldo de origem resolvido para `codigo`; origem padrão "O<n>". */
const s = (codigo: string, saldoAtual: number, origemCodigo = 'O1', origemNome = 'ORIGEM'): SaldoResolvido => ({
  codigo,
  saldoAtual,
  origemCodigo,
  origemNome,
});

/** Saldo assinado de um lançamento, na convenção do motor: débito negativo, crédito positivo. */
const assinado = (l: Lancamento): number => (l.contaDebito !== null ? -l.valor : l.valor);

describe('gerarLancamentos — um lançamento por conta de origem', () => {
  it('três fornecedores que vão para a mesma conta geram TRÊS lançamentos, não um somado', () => {
    const ls = gerarLancamentos(
      [
        s('2', 100, '1000', 'FORNECEDOR 1'),
        s('2', 250, '1001', 'FORNECEDOR 2'),
        s('2', 50, '1002', 'FORNECEDOR 3'),
      ],
      indice,
    );
    expect(ls.map((l) => [l.contaCredito, l.valor, l.origemCodigo])).toEqual([
      ['2', 100, '1000'],
      ['2', 250, '1001'],
      ['2', 50, '1002'],
    ]);
  });

  it('o histórico de cada lançamento diz de qual conta de origem o saldo veio', () => {
    const [l] = gerarLancamentos([s('2', 100, '1000', 'Fornecedor  1')], indice);
    expect(l.complemento).toBe('IMPLANTAÇÃO DE SALDO REFERENTE À CONTA 1000 - FORNECEDOR 1');
    expect(l).toMatchObject({ origemCodigo: '1000', origemNome: 'Fornecedor  1' });
  });

  it('saldo negativo vira débito e positivo vira crédito', () => {
    const [debito, credito] = gerarLancamentos([s('1', -10), s('2', 10)], indice);
    expect(debito).toMatchObject({ contaDebito: '1', contaCredito: null });
    expect(credito).toMatchObject({ contaDebito: null, contaCredito: '2' });
  });

  it('valor é o módulo do saldo', () =>
    expect(gerarLancamentos([s('1', -1234.56)], indice)[0]?.valor).toBe(1234.56));

  it('descarta saldo zero e saldo que arredonda para zero', () =>
    expect(gerarLancamentos([s('1', 0), s('1', 0.004)], indice)).toEqual([]));

  it('origens de sinais opostos na mesma conta não se compensam: viram débito e crédito, com o mesmo líquido', () => {
    const ls = gerarLancamentos([s('1', -100, 'A'), s('1', 30, 'B')], indice);
    expect(ls).toHaveLength(2);
    expect(ls.reduce((t, l) => t + assinado(l), 0)).toBe(-70);
  });

  it('ordena pela classificação da conta do Domínio e, dentro dela, pela ordem do balancete', () =>
    expect(
      gerarLancamentos(
        [s('2', 5, 'X'), s('3', -5, 'Y'), s('1', -5, 'Z'), s('1', -7, 'W')],
        indice,
      ).map((l) => `${l.contaDebito ?? l.contaCredito}:${l.origemCodigo}`),
    ).toEqual(['1:Z', '1:W', '3:Y', '2:X']));
});

describe('gerarLancamentos — gabarito do balancete real', () => {
  const indiceReal = criarIndicePlano(carregarPlano());
  const resolvidas = somenteAnaliticas(carregarBalancete())
    .filter((linha) => linha.codigoEsperado !== '')
    .map((linha) => s(linha.codigoEsperado, linha.saldoAtual, linha.codiCta, linha.nomeCta));
  const lancamentos = gerarLancamentos(resolvidas, indiceReal);

  /** Do TXT da planilha: a conta e o valor assinado de cada registro 03, na ordem gravada. */
  const daPlanilha = carregarTxtEsperado()
    .filter((linha) => linha.startsWith('03'))
    .map((linha) => {
      const debito = String(Number(linha.slice(9, 16)));
      const credito = String(Number(linha.slice(16, 23)));
      const valor = Number(linha.slice(23, 38)) / 100;
      return debito === '0' ? { codigo: credito, valor } : { codigo: debito, valor: -valor };
    });

  it('gera um lançamento por conta de origem com saldo: 26, débito igual a crédito', () => {
    expect(lancamentos).toHaveLength(26);
    const somar = (lado: 'contaDebito' | 'contaCredito') =>
      Math.round(lancamentos.filter((l) => l[lado] !== null).reduce((t, l) => t + l.valor, 0) * 100) / 100;
    expect(somar('contaDebito')).toBe(22957089.75);
    expect(somar('contaCredito')).toBe(22957089.75);
  });

  it('o saldo LÍQUIDO de cada conta do Domínio é exatamente o lançamento que a planilha fazia', () => {
    const liquido = new Map<string, number>();
    for (const l of lancamentos) {
      const codigo = (l.contaDebito ?? l.contaCredito) as string;
      liquido.set(codigo, Math.round(((liquido.get(codigo) ?? 0) + assinado(l)) * 100) / 100);
    }
    expect(Object.fromEntries(liquido)).toEqual(
      Object.fromEntries(daPlanilha.map((p) => [p.codigo, p.valor])),
    );
  });

  it('as contas do Domínio saem na mesma ordem que no TXT da planilha', () => {
    const ordem = [...new Set(lancamentos.map((l) => (l.contaDebito ?? l.contaCredito) as string))];
    expect(ordem).toEqual(daPlanilha.map((p) => p.codigo));
  });
});
