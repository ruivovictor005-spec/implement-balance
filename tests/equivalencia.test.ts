// O teste que protege a migração: o motor inteiro contra o gabarito extraído da planilha.
// Mesma massa, mesmos parâmetros (data 31/08/2026, lote V, histórico 700, sem cabeçalho) que
// produziram `fixtures/txt-esperado.json`.
import { describe, expect, it } from 'vitest';
import { converter } from '../src/motor/converter.js';
import type { ParametrosLote } from '../src/motor/leiaute-dominio.js';
import {
  carregarBalancete,
  carregarNatureza,
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

  it('produz 22 lançamentos, com 22003884.50 em débito e em crédito e diferença zero', () => {
    expect(r.lancamentos).toHaveLength(22);
    expect(r.painel.totalDebito).toBe(22003884.5);
    expect(r.painel.totalCredito).toBe(22003884.5);
    expect(r.painel.diferenca).toBe(0);
  });

  it('produz TXT idêntico ao da planilha, linha por linha', () => {
    expect(r.txt).toEqual(carregarTxtEsperado());
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
