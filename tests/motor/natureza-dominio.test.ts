// Natureza das contas de DESTINO (plano padrão do Domínio) e a indicação opcional de custo/despesa.
// A origem continua no COSIF: estes testes garantem que as duas tabelas não se misturam.
import { describe, expect, it } from 'vitest';
import { converter } from '../../src/motor/converter.js';
import {
  aplicarCustoDespesa,
  lerCustoDespesa,
  naturezaContaDominio,
  resolverNatureza,
} from '../../src/motor/natureza.js';
import type { LinhaBalancete } from '../../src/motor/tipos.js';
import {
  carregarNatureza,
  carregarNaturezaDominio,
  carregarNormalizacao,
  carregarPlano,
} from '../apoio/fixtures.js';

const cosif = carregarNatureza();
const dominio = carregarNaturezaDominio();
const todas = [...cosif, ...dominio];
const plano = carregarPlano();

describe('natureza da conta do Domínio (destino)', () => {
  it.each([
    ['11102001', 'ATIVO CIRCULANTE'],
    ['13303001', 'ATIVO NÃO CIRCULANTE'],
    ['21301001', 'PASSIVO CIRCULANTE'],
    ['24101001', 'PATRIMÔNIO LÍQUIDO'],
    ['31103001', 'RECEITA'],
    ['32103005', 'DEDUÇÃO DA RECEITA'],
    ['41303001', 'CUSTO'],
    ['42101001', 'DESPESA'],
    ['46101001', 'TRIBUTOS S/ LUCRO'],
    ['4.2.1.01.001', 'DESPESA'], // com máscara
  ])('%s é %s', (classificacao, esperada) => {
    expect(naturezaContaDominio(classificacao, todas)).toBe(esperada);
  });

  it('nenhuma conta de custo/despesa do plano real aparece como passivo (o defeito relatado)', () => {
    const analiticas = plano.filter((c) => c.tipo === 'A');
    for (const conta of analiticas) {
      const n = naturezaContaDominio(conta.classificacao, todas);
      expect(n, `${conta.codigoReduzido} ${conta.descricao}`).not.toBe('');
      const grupo = conta.classificacao.charAt(0);
      if (grupo === '1') expect(n.startsWith('ATIVO')).toBe(true);
      if (grupo === '2') expect(/^PASSIVO|PATRIM/.test(n)).toBe(true);
      if (grupo === '3') expect(/RECEITA/.test(n)).toBe(true);
      if (grupo === '4') expect(/CUSTO|DESPESA|TRIBUTO/.test(n)).toBe(true);
    }
  });

  it('a natureza da ORIGEM continua COSIF: 4 é passivo e 8 é despesa, mesmo com a tabela do Domínio junto', () => {
    expect(resolverNatureza('4.9.9.99.00.00.00000', todas)?.natureza).toBe('PASSIVO');
    expect(resolverNatureza('8.1.7.06.01.01.00005', todas)?.natureza).toBe('DESPESA ADMINISTRATIVA');
    expect(resolverNatureza('7.1.7.10.00.00.00000', todas)?.natureza).toBe('RECEITA DE SERVIÇOS');
  });
});

describe('indicação de custo ou despesa (coluna opcional)', () => {
  it.each([
    ['C', 'C'],
    ['c', 'C'],
    ['Custo', 'C'],
    ['D', 'D'],
    ['despesa', 'D'],
    ['', ''],
    [undefined, ''],
    ['X', ''],
  ])('lê %s como %s', (valor, esperado) => {
    expect(lerCustoDespesa(valor)).toBe(esperado);
  });

  const despesaCosif = { natureza: 'DESPESA', gruposDominio: ['42', '45', '41'], naoMigrar: false };
  const genericaCosif = { natureza: 'DESPESA / CUSTO', gruposDominio: ['4', '32'], naoMigrar: false };
  const passivoCosif = { natureza: 'PASSIVO', gruposDominio: ['21', '22'], naoMigrar: false };

  it('C transforma despesa em custo e só aceita contas de custo (41)', () => {
    expect(aplicarCustoDespesa(despesaCosif, 'C')).toEqual({
      natureza: 'CUSTO',
      gruposDominio: ['41'],
      naoMigrar: false,
    });
  });

  it('D tira os grupos de custo de uma despesa', () => {
    expect(aplicarCustoDespesa(despesaCosif, 'D')?.gruposDominio).toEqual(['42', '45']);
  });

  it('D no genérico "despesa / custo" vira despesa com os grupos de despesa', () => {
    expect(aplicarCustoDespesa(genericaCosif, 'D')).toEqual({
      natureza: 'DESPESA',
      gruposDominio: ['42', '45', '46'],
      naoMigrar: false,
    });
  });

  it('não mexe em conta que não é de resultado devedora (salário a pagar no passivo)', () => {
    expect(aplicarCustoDespesa(passivoCosif, 'C')).toBe(passivoCosif);
  });

  it('sem indicação, nada muda', () => {
    expect(aplicarCustoDespesa(despesaCosif, '')).toBe(despesaCosif);
  });
});

describe('salário: custo, despesa ou passivo, conforme a indicação (exemplo real do plano)', () => {
  const linha = (over: Partial<LinhaBalancete>): LinhaBalancete => ({
    codiCta: '1',
    nomeCta: 'SALARIOS',
    clasCta: '8.1.9.99.00.00.00005', // COSIF: DESPESA, aceita 42, 45 e 41
    tipoCta: 'A',
    saldoAnterior: 0,
    totalDebito: 0,
    totalCredito: 0,
    saldoAtual: -100,
    ...over,
  });

  const resolver = (l: LinhaBalancete) =>
    converter({
      balancete: [l],
      plano,
      contasCriadas: [],
      sinonimos: new Map(),
      regrasNormalizacao: carregarNormalizacao(),
      regrasNatureza: todas,
      regrasNaturezaDominio: todas,
      ajustesManuais: new Map(),
      parametros: {
        dataSaldo: new Date(2026, 0, 31),
        cnpj: '',
        codigoEmpresa: '',
        tipoLote: 'V',
        codigoHistorico: '700',
        incluirCabecalho: false,
      },
    }).linhas[0];

  it('marcado C vai para Salários de CUSTO', () => {
    const r = resolver(linha({ custoDespesa: 'C' }));
    expect(r.natureza).toBe('CUSTO');
    expect(r.codigo).toBe('418');
  });

  it('marcado D vai para Salários de DESPESA', () => {
    const r = resolver(linha({ custoDespesa: 'D' }));
    expect(r.natureza).toBe('DESPESA');
    expect(r.codigo).toBe('485');
  });

  it('salário no passivo (COSIF 4) continua no passivo, mesmo marcado C', () => {
    const r = resolver(linha({ clasCta: '4.9.9.99.00.00.00005', custoDespesa: 'C' }));
    expect(r.natureza).toBe('PASSIVO');
    expect(r.codigo).toBe('219');
  });
});
