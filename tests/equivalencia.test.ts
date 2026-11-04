// O teste que protege a migração: o motor inteiro contra o gabarito extraído da planilha.
// Mesma massa, mesmos parâmetros (data 31/08/2026, lote V, histórico 700, sem cabeçalho) que
// produziram `fixtures/txt-esperado.json`.
//
// Duas regras mudaram de propósito em relação à planilha, a pedido de quem usa:
//  - um lançamento POR CONTA DE ORIGEM (a planilha somava as origens que iam para a mesma conta);
//  - o histórico é padronizado e cita a origem ("IMPLANTAÇÃO DE SALDO REFERENTE À CONTA ...").
// O que NÃO pode mudar continua provado aqui: o mesmo código para cada conta, o mesmo status, o
// mesmo saldo líquido em cada conta do Domínio (ver também agregar.test.ts), débito = crédito, e os
// registros 02 e 99 idênticos byte a byte.
import { describe, expect, it } from 'vitest';
import { converter } from '../src/motor/converter.js';
import type { ParametrosLote } from '../src/motor/leiaute-dominio.js';
import {
  carregarBalancete,
  carregarNatureza,
  carregarNaturezaDominio,
  carregarNormalizacao,
  carregarPlano,
  carregarSinonimos,
  carregarTxtEsperado,
  mapaSinonimos,
  somenteAnaliticas,
} from './apoio/fixtures.js';

const balancete = carregarBalancete();
const analiticas = somenteAnaliticas(balancete);

// Os ajustes de coluna L são ENTRADA: a planilha resolveu duas linhas assim. Sem semear, elas
// sairiam como pendência e a equivalência falharia por um motivo que não é defeito do motor.
const ajustesManuais = new Map(
  balancete
    .filter((l) => l.ajusteManual.trim() !== '')
    .map((l) => [l.codiCta, l.ajusteManual] as const),
);

const parametros: ParametrosLote = {
  dataSaldo: new Date(2026, 7, 31),
  cnpj: '12345678000190', // fictício; não aparece sem o registro 01
  codigoEmpresa: '1', // idem
  tipoLote: 'V',
  codigoHistorico: '700',
  incluirCabecalho: false,
};

const r = converter({
  balancete,
  plano: carregarPlano(),
  contasCriadas: [],
  sinonimos: mapaSinonimos(carregarSinonimos()),
  regrasNormalizacao: carregarNormalizacao(),
  regrasNatureza: carregarNatureza(),
  regrasNaturezaDominio: carregarNaturezaDominio(),
  ajustesManuais,
  parametros,
});

describe('equivalência com a planilha', () => {
  it('resolve o mesmo código que a planilha em todas as 27 analíticas', () => {
    expect(r.linhas).toHaveLength(27);
    analiticas.forEach((esperada, i) => {
      expect(r.linhas[i].codigo ?? '').toBe(esperada.codigoEsperado);
    });
  });

  it('produz o mesmo texto de status que a planilha em todas as 27 analíticas', () => {
    analiticas.forEach((esperada, i) => {
      expect(r.linhas[i].status).toBe(esperada.statusEsperado);
    });
  });

  it('gera um lançamento por conta de origem (26), com débito igual a crédito e diferença zero', () => {
    expect(r.lancamentos).toHaveLength(26);
    expect(r.painel.totalDebito).toBe(22957089.75);
    expect(r.painel.totalCredito).toBe(22957089.75);
    expect(r.painel.diferenca).toBe(0);
  });

  it('cada partida do TXT cita a conta de origem no histórico', () => {
    const partidas = r.txt.filter((l) => l.startsWith('03'));
    expect(partidas).toHaveLength(26);
    partidas.forEach((linha, i) => {
      const l = r.lancamentos[i];
      expect(linha).toHaveLength(664);
      expect(linha.slice(45, 557).trimEnd()).toBe(
        `IMPLANTAÇÃO DE SALDO REFERENTE À CONTA ${l.origemCodigo.trim()} - ${l.origemNome
          .replace(/\s+/g, ' ')
          .trim()
          .toUpperCase()}`,
      );
    });
  });

  it('registros 02 (abertura do lote) e 99 (encerramento) idênticos aos da planilha', () => {
    const esperado = carregarTxtEsperado();
    expect(r.txt[0]).toBe(esperado[0]);
    expect(r.txt.at(-1)).toBe(esperado.at(-1));
  });

  it('sequência das partidas começa em 2 e não pula', () => {
    r.txt
      .filter((l) => l.startsWith('03'))
      .forEach((linha, i) => expect(Number(linha.slice(2, 9))).toBe(i + 2));
  });

  it('painel mostra 27 analíticas, 27 mapeadas, 0 pendentes e PRONTO PARA IMPORTAR', () => {
    expect(r.painel).toMatchObject({
      analiticas: 27,
      mapeadas: 27,
      pendentes: 0,
      pronto: true,
      status: 'PRONTO PARA IMPORTAR',
    });
  });
});
