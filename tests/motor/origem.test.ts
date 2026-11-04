// Auditoria do balancete de ORIGEM, provada com um balancete REAL que estava sendo lido errado:
// "Balancete 092026 - ZERO MARKETS BRASIL", que vem no plano do DOMÍNIO (1 ativo, 2 passivo,
// 3 receitas, 4 custos e despesas) e com o sinal na convenção do Domínio (débito positivo).
//
// O que acontecia: o sistema lia esse arquivo pela tabela COSIF, em que 2 é ativo não circulante,
// 3 é compensação e 4 é passivo. Resultado: BANCO INTER era apontada como "saldo invertido" sem
// estar, e a receita inteira ficava marcada "NÃO MIGRAR" — desaparecia do TXT em silêncio.
import { describe, expect, it } from 'vitest';
import { converter } from '../../src/motor/converter.js';
import { contaRedutora, saldoInvertido } from '../../src/motor/lado.js';
import { resolverNatureza, resolverNaturezaDominioOrigem } from '../../src/motor/natureza.js';
import {
  conferirConvencao,
  detectarPlanoOrigem,
  sinalNaoConfiavel,
} from '../../src/motor/origem.js';
import type { LinhaBalancete } from '../../src/motor/tipos.js';
import {
  carregarNatureza,
  carregarNaturezaDominio,
  carregarNormalizacao,
  carregarPlano,
} from '../apoio/fixtures.js';

const cosif = carregarNatureza();
const dominio = carregarNaturezaDominio();

// As contas analíticas do balancete, com o valor e o LADO exatamente como o PDF os mostra.
const REAIS: { cod: string; clas: string; nome: string; valor: number; lado: 'D' | 'C' }[] = [
  { cod: '566', clas: '1.1.10.200.001', nome: 'BANCO INTER', valor: 5574.25, lado: 'D' },
  { cod: '10062', clas: '1.1.31.000.000', nome: 'ZERO MARKETS HOLDING', valor: 2000, lado: 'D' },
  { cod: '10001', clas: '2.1.30.100.000', nome: 'FORNECEDORES', valor: 5033.53, lado: 'C' },
  { cod: '173', clas: '2.1.40.100.000', nome: 'ISS A RECOLHER', valor: 20.82, lado: 'C' },
  { cod: '179', clas: '2.1.40.100.000', nome: 'PIS A RECOLHER', valor: 2.71, lado: 'C' },
  { cod: '5017', clas: '2.1.60.300.000', nome: 'APORTES DE RECURSOS', valor: 1076902.98, lado: 'C' },
  { cod: '245', clas: '2.3.10.100.000', nome: 'CAPITAL SOCIAL - NACIONAL', valor: 30000, lado: 'C' },
  { cod: '267', clas: '2.3.40.100.000', nome: '(-) PREJUÍZOS ACUMULADOS', valor: 756099.49, lado: 'D' },
  { cod: '411', clas: '3.1.10.200.000', nome: 'SERVIÇOS PRESTADOS', valor: 6662.72, lado: 'C' },
  { cod: '427', clas: '3.1.20.300.000', nome: '(-) ISS', valor: 333.13, lado: 'D' },
  { cod: '350', clas: '4.2.20.300.000', nome: 'TAXAS DIVERSAS', valor: 4891.5, lado: 'D' },
  { cod: '686', clas: '4.2.20.400.000', nome: 'ASSESSORIA CONTÁBIL', valor: 17100, lado: 'D' },
  { cod: '356', clas: '4.2.20.500.000', nome: 'TELEFONE', valor: 3720.09, lado: 'D' },
  { cod: '557', clas: '4.3.10.700.000', nome: 'PROVISAO IRPJ', valor: 159.91, lado: 'D' },
];

/** O balancete como o motor o recebe. `convencao` é a do arquivo, não a do motor. */
const balanceteZeroMarkets = (convencao: 'debito negativo' | 'debito positivo'): LinhaBalancete[] =>
  REAIS.map((c) => ({
    codiCta: c.cod,
    nomeCta: c.nome,
    clasCta: c.clas,
    tipoCta: 'A',
    saldoAnterior: 0,
    totalDebito: 0,
    totalCredito: 0,
    saldoAtual:
      convencao === 'debito negativo'
        ? c.lado === 'D'
          ? -c.valor
          : c.valor
        : c.lado === 'D'
          ? c.valor
          : -c.valor,
    custoDespesa: '',
  }));

/** Linhas com a natureza que a tabela indicada dá, para conferir a convenção. */
const comNatureza = (balancete: LinhaBalancete[], tabela: 'cosif' | 'dominio') =>
  balancete.map((l) => ({
    natureza:
      (tabela === 'dominio'
        ? resolverNaturezaDominioOrigem(l.clasCta, dominio)
        : resolverNatureza(l.clasCta, cosif))?.natureza ?? '',
    saldoAtual: l.saldoAtual,
  }));

describe('em que plano está a origem', () => {
  it('o balancete da ZERO MARKETS é reconhecido como plano do Domínio', () => {
    expect(detectarPlanoOrigem(balanceteZeroMarkets('debito positivo'))).toBe('dominio');
  });

  it('um balancete COSIF continua COSIF (grupos 7 e 8 denunciam)', () => {
    expect(
      detectarPlanoOrigem([
        { clasCta: '1.1.2.30.01.01.00040' },
        { clasCta: '4.9.9.99.00.00.00005' },
        { clasCta: '8.1.9.99.00.00.00005' },
      ]),
    ).toBe('cosif');
  });

  it('não se afirma plano por ausência de evidência: só o grupo 4 não decide nada', () => {
    expect(detectarPlanoOrigem([{ clasCta: '4.9.9.99.00.00.00005' }])).toBe('indefinido');
  });

  it('só contas patrimoniais não decidem: é indefinido, não um palpite', () => {
    expect(detectarPlanoOrigem([{ clasCta: '1.1.10.200.001' }, { clasCta: '2.1.30.100.000' }])).toBe(
      'indefinido',
    );
  });

  it('classificação sem máscara é reconhecida igual', () => {
    expect(detectarPlanoOrigem([{ clasCta: '1110200001' }, { clasCta: '3110200000' }, { clasCta: '4220400000' }])).toBe(
      'dominio',
    );
  });
});

describe('a tabela de natureza certa para a origem certa', () => {
  // Este é o estrago silencioso: lida pela tabela COSIF, a receita vira "não migrar".
  it('pela tabela COSIF, a receita do balancete do Domínio seria descartada', () => {
    const receita = resolverNatureza('3.1.10.200.000', cosif);
    expect(receita?.natureza).toBe('COMPENSAÇÃO');
    expect(receita?.naoMigrar).toBe(true);
  });

  it('pela tabela do Domínio, a receita é receita e migra', () => {
    const receita = resolverNaturezaDominioOrigem('3.1.10.200.000', dominio);
    expect(receita?.natureza).toBe('RECEITA');
    expect(receita?.naoMigrar).toBe(false);
    expect(receita?.gruposDominio).toEqual(['31']);
  });

  it('pela tabela do Domínio, 2 é passivo e 4 é despesa — não o contrário', () => {
    expect(resolverNatureza('2.1.30.100.000', cosif)?.natureza).toBe('ATIVO NÃO CIRCULANTE');
    expect(resolverNatureza('4.2.20.500.000', cosif)?.natureza).toBe('PASSIVO');
    expect(resolverNaturezaDominioOrigem('2.1.30.100.000', dominio)?.natureza).toBe(
      'PASSIVO CIRCULANTE',
    );
    expect(resolverNaturezaDominioOrigem('4.2.20.500.000', dominio)?.natureza).toBe('DESPESA');
  });

  it('o nível não se perde com a máscara: 1.1.10... é circulante, não "ATIVO" genérico', () => {
    expect(resolverNaturezaDominioOrigem('1.1.10.200.001', dominio)?.natureza).toBe(
      'ATIVO CIRCULANTE',
    );
  });

  it('classificação de origem SEM máscara encontra a regra com máscara', () => {
    expect(resolverNatureza('1110200001', cosif)?.natureza).toBe('ATIVO CIRCULANTE');
  });
});

describe('convenção de sinal do arquivo', () => {
  it('o balancete da ZERO MARKETS, como veio, está na convenção contrária', () => {
    const r = conferirConvencao(comNatureza(balanceteZeroMarkets('debito positivo'), 'dominio'));
    expect(r.convencao).toBe('invertida');
    expect(r.devedoras).toBeGreaterThan(0);
    expect(r.credoras).toBeLessThan(0);
  });

  it('o mesmo balancete com o sinal do motor confere', () => {
    const r = conferirConvencao(comNatureza(balanceteZeroMarkets('debito negativo'), 'dominio'));
    expect(r.convencao).toBe('normal');
    expect(r.devedoras).toBeLessThan(0);
    expect(r.credoras).toBeGreaterThan(0);
  });

  // Um export que perde o D/C deixa tudo positivo: não é convenção nenhuma, é falta de informação.
  it('arquivo todo do mesmo sinal: o D/C se perdeu, não há sinal para usar', () => {
    const semSinal = balanceteZeroMarkets('debito positivo').map((l) => ({
      ...l,
      saldoAtual: Math.abs(l.saldoAtual),
    }));
    const r = conferirConvencao(comNatureza(semSinal, 'dominio'));
    expect(r.convencao).toBe('ausente');
    expect(sinalNaoConfiavel(r.convencao)).toBe(true);
  });

  it('sinal confiável só quando confere ou falta massa para julgar', () => {
    expect(sinalNaoConfiavel('normal')).toBe(false);
    expect(sinalNaoConfiavel('indefinida')).toBe(false);
    expect(sinalNaoConfiavel('invertida')).toBe(true);
    expect(sinalNaoConfiavel('ausente')).toBe(true);
  });

  it('pouca evidência não vira veredito', () => {
    expect(
      conferirConvencao([
        { natureza: 'ATIVO CIRCULANTE', saldoAtual: 100 },
        { natureza: 'PASSIVO', saldoAtual: -100 },
      ]).convencao,
    ).toBe('indefinida');
  });

  it('saldo zero e natureza desconhecida não entram na conta', () => {
    const r = conferirConvencao([
      { natureza: 'ATIVO CIRCULANTE', saldoAtual: 0 },
      { natureza: 'COMPENSAÇÃO', saldoAtual: -50 },
    ]);
    expect(r.conferidas).toBe(0);
    expect(r.convencao).toBe('indefinida');
  });

  // Os dois lados somando devedor: não é a convenção do motor nem a contrária. Sem veredito.
  it('lados misturados sem padrão ficam indefinidos, não "invertida"', () => {
    const r = conferirConvencao([
      { natureza: 'ATIVO CIRCULANTE', saldoAtual: -100 },
      { natureza: 'ATIVO CIRCULANTE', saldoAtual: 50 },
      { natureza: 'PASSIVO', saldoAtual: -300 },
      { natureza: 'PASSIVO', saldoAtual: 100 },
    ]);
    expect(r.devedoras).toBe(-50);
    expect(r.credoras).toBe(-200);
    expect(r.convencao).toBe('indefinida');
  });
});

describe('a conta BANCO INTER — o caso que começou isto', () => {
  it('com o sinal certo, não é apontada como invertida', () => {
    expect(saldoInvertido(-5574.25, 'ATIVO CIRCULANTE', 'BANCO INTER')).toBe(false);
  });

  it('conta redutora não é apontada: prejuízo acumulado é PL com saldo devedor', () => {
    expect(contaRedutora('(-) PREJUÍZOS ACUMULADOS')).toBe(true);
    expect(saldoInvertido(-756099.49, 'PATRIMÔNIO LÍQUIDO', '(-) PREJUÍZOS ACUMULADOS')).toBe(false);
    // A mesma conta SEM o nome voltaria a ser acusada — é o nome que diz que ela é redutora.
    expect(saldoInvertido(-756099.49, 'PATRIMÔNIO LÍQUIDO')).toBe(true);
  });

  it('um ativo credor de verdade continua sendo apontado', () => {
    expect(saldoInvertido(5574.25, 'ATIVO CIRCULANTE', 'BANCO INTER')).toBe(true);
  });
});

describe('o motor inteiro sobre o balancete real', () => {
  const rodar = (convencao: 'debito negativo' | 'debito positivo') =>
    converter({
      balancete: balanceteZeroMarkets(convencao),
      plano: carregarPlano(),
      contasCriadas: [],
      sinonimos: new Map(),
      regrasNormalizacao: carregarNormalizacao(),
      regrasNatureza: cosif,
      regrasNaturezaDominio: dominio,
      ajustesManuais: new Map(),
      parametros: {
        dataSaldo: new Date(2026, 8, 30),
        cnpj: '56964932000109',
        codigoEmpresa: '1',
        tipoLote: 'V',
        codigoHistorico: '700',
        incluirCabecalho: false,
      },
    });

  it('a receita não é mais descartada', () => {
    const r = rodar('debito negativo');
    const receita = r.linhas.find((l) => l.codiCta === '411');
    expect(receita?.natureza).toBe('RECEITA');
    expect(receita?.gruposDominio).toEqual(['31']);
  });

  it('a despesa é despesa, não passivo', () => {
    const telefone = rodar('debito negativo').linhas.find((l) => l.codiCta === '356');
    expect(telefone?.natureza).toBe('DESPESA');
  });

  it('o painel diz em que plano leu e que o sinal confere', () => {
    const { painel } = rodar('debito negativo');
    expect(painel.origem.plano).toBe('dominio');
    expect(painel.origem.convencao).toBe('normal');
  });

  // O motivo de a conferência existir: trocar o sinal do balancete inteiro só TROCA débito com
  // crédito, então a diferença do painel fica igual em módulo e não acusa nada.
  it('o sinal trocado não muda a diferença do painel — por isso ela não acusa', () => {
    const certo = rodar('debito negativo').painel;
    const trocado = rodar('debito positivo').painel;
    expect(Math.abs(trocado.diferenca)).toBe(Math.abs(certo.diferenca));
    expect(trocado.totalDebito).toBe(certo.totalCredito);
    expect(trocado.totalCredito).toBe(certo.totalDebito);
  });

  it('com o sinal trocado o painel não diz "pronto" e explica o motivo', () => {
    const { painel } = rodar('debito positivo');
    expect(painel.origem.convencao).toBe('invertida');
    expect(painel.pronto).toBe(false);
    expect(painel.status).toContain('sinal');
  });
});
