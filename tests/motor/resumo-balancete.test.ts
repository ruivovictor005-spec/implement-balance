import { describe, expect, it } from 'vitest';
import {
  grupoDaNatureza,
  resumirBalancete,
  type LinhaDoResumo,
} from '../../src/motor/resumo-balancete.js';

const linha = (over: Partial<LinhaDoResumo> & { natureza: string }): LinhaDoResumo => ({
  saldoAnterior: 0,
  totalDebito: 0,
  totalCredito: 0,
  saldoAtual: 0,
  ...over,
});

describe('grupo da natureza', () => {
  it.each([
    ['ATIVO', 'ativo'],
    ['ATIVO CIRCULANTE', 'ativo'],
    ['ATIVO NÃO CIRCULANTE', 'ativo'],
    ['PASSIVO', 'passivo'],
    ['PASSIVO - REF', 'passivo'],
    ['PATRIMÔNIO LÍQUIDO', 'patrimonioLiquido'],
    ['RECEITA', 'receitas'],
    ['RECEITA DE SERVIÇOS', 'receitas'],
    ['RECEITA FINANCEIRA', 'receitas'],
    ['DESPESA', 'custos'],
    ['DESPESA ADMINISTRATIVA', 'custos'],
    ['DESPESA / CUSTO', 'custos'],
    ['TRIBUTOS S/ LUCRO', 'custos'],
  ])('%s cai em %s', (natureza, grupo) => {
    expect(grupoDaNatureza(natureza)).toBe(grupo);
  });

  it('dedução da receita é conta de resultado devedora, não receita', () => {
    expect(grupoDaNatureza('DEDUÇÃO DA RECEITA')).toBe('custos');
  });

  it('natureza desconhecida ou vazia não é chutada em nenhum grupo', () => {
    expect(grupoDaNatureza('COMPENSAÇÃO')).toBeNull();
    expect(grupoDaNatureza('TOTALIZADOR P.L.A.')).toBeNull();
    expect(grupoDaNatureza('ALGO NOVO')).toBeNull();
    expect(grupoDaNatureza('')).toBeNull();
  });
});

// Os números vêm de um RESUMO DO BALANCETE real, impresso pelo próprio Domínio. Se a derivação das
// linhas calculadas (devedoras, credoras e os dois resultados) estiver errada, este teste acusa.
describe('resumo conferido contra um relatório real do Domínio', () => {
  const resumo = resumirBalancete([
    linha({
      natureza: 'ATIVO CIRCULANTE',
      saldoAnterior: -18177277.09,
      totalDebito: 10289559.06,
      totalCredito: 10795555.65,
      saldoAtual: -17671280.5,
    }),
    linha({
      natureza: 'PASSIVO',
      saldoAnterior: 22359741.08,
      totalDebito: 663317.86,
      totalCredito: 331730.97,
      saldoAtual: 22028154.19,
    }),
    linha({
      natureza: 'RECEITA DE SERVIÇOS',
      saldoAnterior: 676229.12,
      totalDebito: 1448.35,
      totalCredito: 162791.57,
      saldoAtual: 837572.34,
    }),
    linha({
      natureza: 'DESPESA ADMINISTRATIVA',
      saldoAnterior: -4858693.11,
      totalDebito: 335752.92,
      totalCredito: 0,
      saldoAtual: -5194446.03,
    }),
    linha({
      natureza: 'PATRIMÔNIO LÍQUIDO',
      saldoAnterior: 3166412.23,
      totalDebito: 0,
      totalCredito: 0,
      saldoAtual: 3166412.23,
    }),
  ]);

  const grupo = (id: string) => resumo.grupos.find((g) => g.id === id)!;

  it('os grupos saem na ordem do relatório', () => {
    expect(resumo.grupos.map((g) => g.rotulo)).toEqual([
      'ATIVO',
      'PASSIVO',
      'RECEITAS',
      'CUSTOS E DESPESAS',
      'Patrimônio Líquido',
    ]);
  });

  it('ATIVO e CUSTOS ficam devedores; PASSIVO, RECEITAS e P.L. ficam credores', () => {
    expect(grupo('ativo').saldoAtual).toBeCloseTo(-17671280.5, 2);
    expect(grupo('custos').saldoAtual).toBeCloseTo(-5194446.03, 2);
    expect(grupo('passivo').saldoAtual).toBeCloseTo(22028154.19, 2);
    expect(grupo('receitas').saldoAtual).toBeCloseTo(837572.34, 2);
    expect(grupo('patrimonioLiquido').saldoAtual).toBeCloseTo(3166412.23, 2);
  });

  it('CONTAS DEVEDORAS somam ativo e custos, nas quatro colunas', () => {
    expect(resumo.devedoras.saldoAnterior).toBeCloseTo(-23035970.2, 2);
    expect(resumo.devedoras.totalDebito).toBeCloseTo(10625311.98, 2);
    expect(resumo.devedoras.totalCredito).toBeCloseTo(10795555.65, 2);
    expect(resumo.devedoras.saldoAtual).toBeCloseTo(-22865726.53, 2);
  });

  it('CONTAS CREDORAS somam passivo, receitas e P.L., nas quatro colunas', () => {
    expect(resumo.credoras.saldoAnterior).toBeCloseTo(26202382.43, 2);
    expect(resumo.credoras.totalDebito).toBeCloseTo(664766.21, 2);
    expect(resumo.credoras.totalCredito).toBeCloseTo(494522.54, 2);
    expect(resumo.credoras.saldoAtual).toBeCloseTo(26032138.76, 2);
  });

  it('RESULTADO DO MÊS é só a movimentação líquida do período', () => {
    expect(resumo.resultadoDoMes.saldoAnterior).toBe(0);
    expect(resumo.resultadoDoMes.totalDebito).toBeCloseTo(335752.92, 2);
    expect(resumo.resultadoDoMes.totalCredito).toBeCloseTo(161343.22, 2);
    expect(resumo.resultadoDoMes.saldoAtual).toBeCloseTo(-174409.7, 2); // devedor
  });

  it('RESULTADO DO EXERCÍCIO é o acumulado de receitas contra despesas', () => {
    expect(resumo.resultadoDoExercicio.saldoAnterior).toBeCloseTo(-4182463.99, 2);
    expect(resumo.resultadoDoExercicio.totalDebito).toBeCloseTo(5194446.03, 2);
    expect(resumo.resultadoDoExercicio.totalCredito).toBeCloseTo(837572.34, 2);
    expect(resumo.resultadoDoExercicio.saldoAtual).toBeCloseTo(-4356873.69, 2); // devedor
  });

  it('nenhuma linha ficou fora do resumo', () => {
    expect(resumo.foraDoResumo).toBe(0);
  });
});

describe('resumo: casos de borda', () => {
  it('balancete vazio devolve tudo zerado, sem quebrar', () => {
    const r = resumirBalancete([]);
    expect(r.grupos.every((g) => g.saldoAtual === 0 && g.saldoAnterior === 0)).toBe(true);
    expect(r.devedoras.saldoAtual).toBe(0);
    expect(r.resultadoDoExercicio.saldoAtual).toBe(0);
    expect(r.foraDoResumo).toBe(0);
  });

  it('linha de natureza desconhecida é contada à parte e não entra em nenhum total', () => {
    const r = resumirBalancete([
      linha({ natureza: 'ATIVO', saldoAtual: -100 }),
      linha({ natureza: 'COMPENSAÇÃO', saldoAtual: -999999 }),
      linha({ natureza: '', saldoAtual: 555 }),
    ]);
    expect(r.foraDoResumo).toBe(2);
    expect(r.devedoras.saldoAtual).toBeCloseTo(-100, 2);
    expect(r.credoras.saldoAtual).toBe(0);
  });

  it('várias linhas do mesmo grupo são somadas', () => {
    const r = resumirBalancete([
      linha({ natureza: 'ATIVO CIRCULANTE', saldoAtual: -100, totalDebito: 10 }),
      linha({ natureza: 'ATIVO NÃO CIRCULANTE', saldoAtual: -250, totalDebito: 5 }),
    ]);
    const ativo = r.grupos.find((g) => g.id === 'ativo')!;
    expect(ativo.saldoAtual).toBeCloseTo(-350, 2);
    expect(ativo.totalDebito).toBeCloseTo(15, 2);
  });

  it('os centavos são arredondados como no resto do motor', () => {
    const r = resumirBalancete([
      linha({ natureza: 'ATIVO', saldoAtual: -0.005 }),
      linha({ natureza: 'PASSIVO', saldoAtual: 0.005 }),
    ]);
    // meio centavo arredonda para longe do zero, dos dois lados
    expect(r.grupos.find((g) => g.id === 'ativo')!.saldoAtual).toBe(-0.01);
    expect(r.grupos.find((g) => g.id === 'passivo')!.saldoAtual).toBe(0.01);
  });
});
