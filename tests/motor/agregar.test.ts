import { describe, expect, it } from 'vitest';
import { agregarLancamentos } from '../../src/motor/agregar.js';
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
  conta('2', '21101001', 'Fornecedores'),
  conta('3', '11101002', 'Banco Conta\r\nMovimento'),
]);

describe('agregarLancamentos', () => {
  it('soma saldos do mesmo código', () => {
    const lancamentos = agregarLancamentos(
      [
        { codigo: '1', saldoAtual: -10.5 },
        { codigo: '1', saldoAtual: -0.25 },
      ],
      indice,
    );
    expect(lancamentos).toHaveLength(1);
    expect(lancamentos[0]?.valor).toBe(10.75);
  });

  it('saldo negativo vira débito e positivo vira crédito', () => {
    const [debito, credito] = agregarLancamentos(
      [
        { codigo: '1', saldoAtual: -10 },
        { codigo: '2', saldoAtual: 10 },
      ],
      indice,
    );
    expect(debito).toMatchObject({ contaDebito: '1', contaCredito: null });
    expect(credito).toMatchObject({ contaDebito: null, contaCredito: '2' });
  });

  it('valor é o módulo do saldo', () =>
    expect(agregarLancamentos([{ codigo: '1', saldoAtual: -1234.56 }], indice)[0]?.valor).toBe(
      1234.56,
    ));

  it('descarta saldo zero', () =>
    expect(agregarLancamentos([{ codigo: '1', saldoAtual: 0 }], indice)).toEqual([]));

  it('ordena pela classificação da conta no plano', () =>
    expect(
      agregarLancamentos(
        [
          { codigo: '2', saldoAtual: 5 },
          { codigo: '3', saldoAtual: -5 },
          { codigo: '1', saldoAtual: -5 },
        ],
        indice,
      ).map((l) => l.contaDebito ?? l.contaCredito),
    ).toEqual(['1', '3', '2']));

  it('complemento é " | " mais a descrição, sem CR nem LF', () =>
    expect(agregarLancamentos([{ codigo: '3', saldoAtual: -1 }], indice)[0]?.complemento).toBe(
      ' | Banco Conta  Movimento',
    ));

  it('saldo que arredonda para zero não gera partida', () =>
    expect(agregarLancamentos([{ codigo: '1', saldoAtual: 0.004 }], indice)).toEqual([]));

  it('saldos que se anulam entre si não geram partida', () =>
    expect(
      agregarLancamentos(
        [
          { codigo: '1', saldoAtual: 100 },
          { codigo: '1', saldoAtual: -100 },
        ],
        indice,
      ),
    ).toEqual([]));

  it('arredonda em 2 casas antes de decidir, não depois', () =>
    // 0,006 + 0,006 = 0,012 → 0,01. Arredondar cada parcela antes de somar daria 0,02.
    expect(
      agregarLancamentos(
        [
          { codigo: '1', saldoAtual: 0.006 },
          { codigo: '1', saldoAtual: 0.006 },
        ],
        indice,
      )[0]?.valor,
    ).toBe(0.01));
});

describe('agregarLancamentos — gabarito do balancete real', () => {
  const indiceReal = criarIndicePlano(carregarPlano());
  const resolvidas = somenteAnaliticas(carregarBalancete())
    .filter((linha) => linha.codigoEsperado !== '')
    .map((linha) => ({ codigo: linha.codigoEsperado, saldoAtual: linha.saldoAtual }));
  const lancamentos = agregarLancamentos(resolvidas, indiceReal);

  it('gera 22 lançamentos do balancete real, com 22003884.50 em débito e em crédito', () => {
    expect(lancamentos).toHaveLength(22);
    const somar = (lado: 'contaDebito' | 'contaCredito') =>
      lancamentos.filter((l) => l[lado] !== null).reduce((total, l) => total + l.valor, 0);
    expect(somar('contaDebito')).toBe(22003884.5);
    expect(somar('contaCredito')).toBe(22003884.5);
  });

  it('põe as contas na mesma ordem e no mesmo lado que o TXT da planilha', () => {
    // Do TXT esperado: o lado preenchido de cada registro 03, na ordem em que a planilha gravou.
    const doTxt = carregarTxtEsperado()
      .filter((linha) => linha.startsWith('03'))
      .map((linha) => {
        const debito = String(Number(linha.slice(9, 16)));
        const credito = String(Number(linha.slice(16, 23)));
        return debito === '0' ? { lado: 'credito', codigo: credito } : { lado: 'debito', codigo: debito };
      });
    expect(
      lancamentos.map((l) =>
        l.contaDebito === null
          ? { lado: 'credito', codigo: l.contaCredito }
          : { lado: 'debito', codigo: l.contaDebito },
      ),
    ).toEqual(doTxt);
  });
});
