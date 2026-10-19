import { describe, expect, it } from 'vitest';
import type { Lancamento } from '../../src/motor/agregar.js';
import {
  gerarRegistro01,
  gerarRegistro02,
  gerarRegistro03,
  gerarTxt,
  type ParametrosLote,
} from '../../src/motor/leiaute-dominio.js';

// CNPJ e código de empresa fictícios: o leiaute só os usa no registro 01.
const p: ParametrosLote = {
  dataSaldo: new Date(2026, 7, 31), // 31/08/2026 (mês 0-based)
  cnpj: '11.222.333/0001-81',
  codigoEmpresa: '42',
  tipoLote: 'V',
  codigoHistorico: '700',
  incluirCabecalho: true,
};

const lanc = (over: Partial<Lancamento> = {}): Lancamento => ({
  contaDebito: '18',
  contaCredito: null,
  valor: 29341.66,
  complemento: ' | Citibank',
  ...over,
});

describe('leiaute 19 posicional', () => {
  it('registro 01 tem 54 caracteres e os campos nas posições certas', () => {
    const r = gerarRegistro01(p);
    expect(r).toHaveLength(54);
    expect(r.slice(0, 2)).toBe('01');
    expect(r.slice(2, 9)).toBe('0000042'); // empresa 7, zeros à esquerda
    expect(r.slice(9, 23)).toBe('11222333000181'); // CNPJ 14, só dígitos
    expect(r.slice(23, 33)).toBe('31/08/2026');
    expect(r.slice(33, 43)).toBe('31/08/2026');
    expect(r.slice(43)).toBe('N0500000117');
  });

  it('registro 02 tem 150 caracteres', () => {
    const r = gerarRegistro02(p);
    expect(r).toHaveLength(150);
    expect(r.slice(0, 20)).toBe('020000001V31/08/2026');
  });

  it('registro 03 tem 664 caracteres', () => {
    expect(gerarRegistro03(lanc(), p, 2)).toHaveLength(664);
  });

  it('registro 99 tem 100 caracteres e 98 noves', () => {
    const txt = gerarTxt([], { ...p, incluirCabecalho: false });
    const r99 = txt[txt.length - 1];
    expect(r99).toHaveLength(100);
    expect(r99).toBe('99' + '9'.repeat(98));
  });

  it('CNPJ entra só com dígitos, completado com espaços à direita', () => {
    const r = gerarRegistro01({ ...p, cnpj: '123' });
    expect(r.slice(9, 23)).toBe('123' + ' '.repeat(11));
  });

  it('conta ausente vira 0000000', () => {
    const r = gerarRegistro03(lanc({ contaDebito: null, contaCredito: '235' }), p, 3);
    expect(r.slice(9, 16)).toBe('0000000'); // débito ausente
    expect(r.slice(16, 23)).toBe('0000235'); // crédito presente
  });

  it('valor entra multiplicado por 100 em 15 dígitos', () => {
    const r = gerarRegistro03(lanc({ valor: 29341.66 }), p, 2);
    expect(r.slice(23, 38)).toBe('000000002934166');
  });

  it('sequência dos registros 03 começa em 2', () => {
    const txt = gerarTxt([lanc(), lanc()], { ...p, incluirCabecalho: false });
    expect(txt[1].slice(2, 9)).toBe('0000002');
    expect(txt[2].slice(2, 9)).toBe('0000003');
  });

  it('cabeçalho 01 só aparece quando pedido', () => {
    expect(gerarTxt([], p)[0].slice(0, 2)).toBe('01');
    expect(gerarTxt([], { ...p, incluirCabecalho: false })[0].slice(0, 2)).toBe('02');
  });

  it('data sai como dd/mm/aaaa', () => {
    const r = gerarRegistro02({ ...p, dataSaldo: new Date(2026, 0, 5) });
    expect(r.slice(10, 20)).toBe('05/01/2026');
  });

  it('descrição de 600 caracteres não estoura o registro 03', () =>
    expect(gerarRegistro03(lanc({ complemento: 'A'.repeat(600) }), p, 2)).toHaveLength(664));

  it('descrição com CHAR(160), pipe e quebra de linha mantém 664', () =>
    expect(gerarRegistro03(lanc({ complemento: ' | Teste\r\ncom quebra' }), p, 2)).toHaveLength(
      664,
    ));
});
