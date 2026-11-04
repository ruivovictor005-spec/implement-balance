import { describe, expect, it } from 'vitest';
import { historicoImplantacao } from '../../src/motor/agregar.js';
import { codificarWindows1252 } from '../../src/motor/ansi.js';
import { gerarRegistro03 } from '../../src/motor/leiaute-dominio.js';

describe('TXT em Windows-1252 (ANSI), como o Domínio lê', () => {
  it('letras acentuadas viram 1 byte cada, nos códigos do Windows-1252', () => {
    expect([...codificarWindows1252('ÇÃÀÉçãé')]).toEqual([
      0xc7, 0xc3, 0xc0, 0xc9, 0xe7, 0xe3, 0xe9,
    ]);
  });

  it('mantém o tamanho: um byte por caractere', () => {
    const texto = 'IMPLANTAÇÃO DE SALDO REFERENTE À CONTA 201 - FORNECEDORES DE SERVIÇOS';
    expect(codificarWindows1252(texto)).toHaveLength(texto.length);
  });

  it('aspas e travessões "bonitos" vão para a faixa 0x80–0x9F; o resto vira "?"', () => {
    expect([...codificarWindows1252('“–”€')]).toEqual([0x93, 0x96, 0x94, 0x80]);
    expect([...codificarWindows1252('✓')]).toEqual([0x3f]);
  });

  it('o registro 03 com histórico acentuado continua com 664 BYTES (posições não andam)', () => {
    const linha = gerarRegistro03(
      {
        contaDebito: '201',
        contaCredito: null,
        valor: 10,
        complemento: historicoImplantacao('1000', 'Fornecedores de Serviços'),
        origemCodigo: '1000',
        origemNome: 'Fornecedores de Serviços',
      },
      {
        dataSaldo: new Date(2026, 0, 31),
        cnpj: '',
        codigoEmpresa: '1',
        tipoLote: 'V',
        codigoHistorico: '700',
        incluirCabecalho: false,
      },
      2,
    );
    expect(codificarWindows1252(linha)).toHaveLength(664);
    expect(new TextEncoder().encode(linha).length).toBeGreaterThan(664); // em UTF-8 passaria
  });
});

describe('histórico padronizado', () => {
  it('diz que é implantação de saldo e de qual conta, em maiúsculas', () => {
    expect(historicoImplantacao('201', 'Fornecedores  de Serviços')).toBe(
      'IMPLANTAÇÃO DE SALDO REFERENTE À CONTA 201 - FORNECEDORES DE SERVIÇOS',
    );
  });

  it('sem descrição, fica só o código', () => {
    expect(historicoImplantacao('9', '')).toBe('IMPLANTAÇÃO DE SALDO REFERENTE À CONTA 9');
  });
});
