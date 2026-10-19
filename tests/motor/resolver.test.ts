import { describe, expect, it } from 'vitest';
import type { ResultadoNatureza } from '../../src/motor/natureza.js';
import { criarIndicePlano, resolverConta } from '../../src/motor/resolver.js';
import type { ContaPlano } from '../../src/motor/tipos.js';
import {
  carregarBalancete,
  carregarPlano,
  carregarSinonimos,
  mapaSinonimos,
  somenteAnaliticas,
} from '../apoio/fixtures.js';

function conta(
  codigoReduzido: string,
  classificacao: string,
  descricaoNormalizada: string,
  tipo: 'A' | 'S' = 'A',
): ContaPlano {
  return { codigoReduzido, classificacao, descricao: descricaoNormalizada, tipo, descricaoNormalizada };
}

const PLANO = [
  conta('1', '11101001', 'CAIXA GERAL'),
  conta('2', '21101001', 'FORNECEDORES'),
  conta('3', '11101002', 'DEPOSITO JUDICIAL TRABALHISTA FGTS'),
  conta('4', '11101003', 'NOME REPETIDO'),
  conta('5', '11101004', 'NOME REPETIDO'),
  conta('6', '11101005', 'OUTRA CONTA'),
  conta('9', '111', 'DISPONIVEL', 'S'),
];

const indice = criarIndicePlano(PLANO);

const ATIVO: ResultadoNatureza = {
  natureza: 'ATIVO CIRCULANTE',
  gruposDominio: ['11'],
  naoMigrar: false,
};
const PASSIVO: ResultadoNatureza = { natureza: 'PASSIVO', gruposDominio: ['21', '22'], naoMigrar: false };
const NAO_MIGRAR: ResultadoNatureza = {
  natureza: 'TOTALIZADOR P.L.A.',
  gruposDominio: [],
  naoMigrar: true,
};

type Entrada = Parameters<typeof resolverConta>[0];

function resolver(parcial: Partial<Entrada>) {
  return resolverConta({
    nomeNormalizado: 'NAO EXISTE NO PLANO',
    natureza: ATIVO,
    ajusteManual: null,
    indice,
    sinonimos: new Map(),
    ...parcial,
  });
}

describe('criarIndicePlano', () => {
  it('indexa todas as contas por código, inclusive as sintéticas', () => {
    expect(indice.porCodigo.get('9')?.tipo).toBe('S');
    expect(indice.porCodigo.size).toBe(PLANO.length);
  });

  it('indexa por nome normalizado só as analíticas', () => {
    expect(indice.porNomeNormalizado.get('DISPONIVEL')).toBeUndefined();
    expect(indice.porNomeNormalizado.get('CAIXA GERAL')?.map((c) => c.codigoReduzido)).toEqual(['1']);
  });

  it('guarda as contas de nome repetido na ordem do plano', () =>
    expect(indice.porNomeNormalizado.get('NOME REPETIDO')?.map((c) => c.codigoReduzido)).toEqual([
      '4',
      '5',
    ]));

  it('lista as analíticas na ordem do plano', () =>
    expect(indice.analiticas.map((c) => c.codigoReduzido)).toEqual(['1', '2', '3', '4', '5', '6']));
});

describe('resolverConta — os 12 textos de status', () => {
  it('1. não migrar', () => {
    const r = resolver({ natureza: NAO_MIGRAR });
    expect(r.status).toBe('Não migrar - TOTALIZADOR P.L.A.');
    expect(r).toMatchObject({ codigo: null, origem: 'nao_migrar' });
  });

  it('2. natureza não identificada', () => {
    const r = resolver({ natureza: null });
    expect(r.status).toBe('NÃO ENCONTRADO - natureza não identificada pela classificação (col. C)');
    expect(r).toMatchObject({ codigo: null, origem: 'nao_encontrado' });
  });

  it('3. código da coluna L não existe no plano', () => {
    const r = resolver({ ajusteManual: '999' });
    expect(r.status).toBe('Código da coluna L não existe no plano');
    expect(r).toMatchObject({ codigo: null, origem: 'nao_encontrado' });
  });

  it('4. manual (coluna L)', () => {
    const r = resolver({ ajusteManual: '1' });
    expect(r.status).toBe('Manual (coluna L)');
    expect(r).toMatchObject({ codigo: '1', origem: 'manual' });
  });

  it('5. código da coluna L é de outra natureza', () => {
    const r = resolver({ ajusteManual: '2' });
    expect(r.status).toBe('Código da coluna L é de outra natureza - conferir');
    expect(r).toMatchObject({ codigo: '2', origem: 'manual' });
  });

  it('6. sinônimo de outra natureza e nada mais encontrado', () => {
    const r = resolver({
      nomeNormalizado: 'FORNEC',
      sinonimos: new Map([['FORNEC', '2']]),
    });
    expect(r.status).toBe(
      'NÃO ENCONTRADO - sinônimo aponta p/ conta de outra natureza; digite na coluna L',
    );
    expect(r).toMatchObject({ codigo: null, origem: 'nao_encontrado' });
  });

  it('7. nada encontrado', () => {
    const r = resolver({ nomeNormalizado: 'CONTA QUE NAO EXISTE' });
    expect(r.status).toBe('NÃO ENCONTRADO - digite o código na coluna L');
    expect(r).toMatchObject({ codigo: null, origem: 'nao_encontrado' });
  });

  it('8. pela aba sinônimos', () => {
    const r = resolver({ nomeNormalizado: 'CX', sinonimos: new Map([['CX', '1']]) });
    expect(r.status).toBe('Pela aba Sinônimos');
    expect(r).toMatchObject({ codigo: '1', origem: 'sinonimo' });
  });

  it('9. sinônimo ignorado (outra natureza), resolvido pelo nome', () => {
    const r = resolver({
      nomeNormalizado: 'CAIXA GERAL',
      sinonimos: new Map([['CAIXA GERAL', '2']]),
    });
    expect(r.status).toBe('Sinônimo ignorado (outra natureza) - conferir');
    expect(r).toMatchObject({ codigo: '1', origem: 'nome_igual' });
  });

  it('10. nome repetido no plano', () => {
    const r = resolver({ nomeNormalizado: 'NOME REPETIDO' });
    expect(r.status).toBe('Nome repetido no plano - conferir');
    expect(r).toMatchObject({ codigo: '4', origem: 'nome_igual' });
  });

  it('11. nome igual ao plano', () => {
    const r = resolver({ nomeNormalizado: 'CAIXA GERAL' });
    expect(r.status).toBe('Nome igual ao plano');
    expect(r).toMatchObject({ codigo: '1', origem: 'nome_igual' });
  });

  it('12. nome cortado', () => {
    const r = resolver({ nomeNormalizado: 'DEPOSITO JUDICIAL TRABALH' });
    expect(r.status).toBe('Nome cortado - conferir');
    expect(r).toMatchObject({ codigo: '3', origem: 'nome_cortado' });
  });
});

describe('resolverConta — a cascata', () => {
  it('ajuste manual vence sinônimo válido', () => {
    const r = resolver({
      nomeNormalizado: 'CX',
      sinonimos: new Map([['CX', '1']]),
      ajusteManual: '6',
    });
    expect(r).toMatchObject({ codigo: '6', origem: 'manual', status: 'Manual (coluna L)' });
  });

  it('ajuste manual vence nome igual ao plano', () => {
    const r = resolver({ nomeNormalizado: 'CAIXA GERAL', ajusteManual: '6' });
    expect(r).toMatchObject({ codigo: '6', origem: 'manual' });
  });

  it('ajuste manual de outra natureza é aceito, com aviso', () => {
    const r = resolver({ nomeNormalizado: 'CAIXA GERAL', ajusteManual: '2' });
    // Avisa e não bloqueia: o código fica, para a pessoa conferir ou corrigir.
    expect(r.codigo).toBe('2');
    expect(r.status).toBe('Código da coluna L é de outra natureza - conferir');
  });

  it('ajuste manual em branco não conta como preenchido', () => {
    const r = resolver({ nomeNormalizado: 'CAIXA GERAL', ajusteManual: '   ' });
    expect(r).toMatchObject({ codigo: '1', origem: 'nome_igual' });
  });

  it('sinônimo para conta de outra natureza é descartado', () => {
    const r = resolver({
      nomeNormalizado: 'CAIXA GERAL',
      sinonimos: new Map([['CAIXA GERAL', '2']]),
    });
    expect(r.origem).toBe('nome_igual');
  });

  it('sinônimo para código inexistente é descartado', () => {
    const r = resolver({
      nomeNormalizado: 'CAIXA GERAL',
      sinonimos: new Map([['CAIXA GERAL', '999']]),
    });
    expect(r).toMatchObject({
      codigo: '1',
      status: 'Sinônimo ignorado (outra natureza) - conferir',
    });
  });

  it('sinônimo vence nome igual ao plano', () => {
    const r = resolver({
      nomeNormalizado: 'CAIXA GERAL',
      sinonimos: new Map([['CAIXA GERAL', '6']]),
    });
    expect(r).toMatchObject({ codigo: '6', origem: 'sinonimo' });
  });

  it('nome cortado só é tentado com 25 caracteres ou mais', () => {
    expect(resolver({ nomeNormalizado: 'DEPOSITO JUDICIAL TRABAL' }).origem).toBe('nao_encontrado');
    expect(resolver({ nomeNormalizado: 'DEPOSITO JUDICIAL TRABALH' }).origem).toBe('nome_cortado');
  });

  it('conta sintética nunca é candidata pelo nome', () =>
    expect(resolver({ nomeNormalizado: 'DISPONIVEL' })).toMatchObject({
      codigo: null,
      origem: 'nao_encontrado',
    }));

  it('conta de outra natureza nunca é candidata pelo nome', () =>
    expect(resolver({ nomeNormalizado: 'FORNECEDORES' }).codigo).toBeNull());

  it('a mesma conta vale quando a natureza permite', () =>
    expect(resolver({ nomeNormalizado: 'FORNECEDORES', natureza: PASSIVO }).codigo).toBe('2'));

  it('o grupo pode casar com um ou com dois dígitos da classificação', () => {
    const umDigito: ResultadoNatureza = { natureza: 'ATIVO', gruposDominio: ['1'], naoMigrar: false };
    expect(resolver({ nomeNormalizado: 'CAIXA GERAL', natureza: umDigito }).codigo).toBe('1');
  });

  it('não migrar vence o ajuste manual', () =>
    // O veto existe para não duplicar saldo: o totalizador não entra nem digitado à mão.
    expect(resolver({ natureza: NAO_MIGRAR, ajusteManual: '1' })).toMatchObject({
      codigo: null,
      origem: 'nao_migrar',
    }));

  it('ajuste manual apontando para conta sintética avisa como outra natureza', () =>
    // Não há texto próprio para "é sintética": o aviso disponível é o de natureza.
    expect(resolver({ ajusteManual: '9' }).status).toBe(
      'Código da coluna L é de outra natureza - conferir',
    ));
});

describe('resolverConta — gabarito das 27 analíticas do balancete', () => {
  const indiceReal = criarIndicePlano(carregarPlano());
  const sinonimosReais = mapaSinonimos(carregarSinonimos());

  it.each(somenteAnaliticas(carregarBalancete()))('linha %#: $nomeCta', (linha) => {
    const vetado = linha.gruposEsperados.length === 1 && linha.gruposEsperados[0] === 'NÃO MIGRAR';
    const natureza: ResultadoNatureza = {
      natureza: linha.naturezaEsperada,
      gruposDominio: vetado ? [] : linha.gruposEsperados,
      naoMigrar: vetado,
    };
    const resultado = resolverConta({
      nomeNormalizado: linha.nomeNormalizadoEsperado,
      natureza,
      ajusteManual: linha.ajusteManual,
      indice: indiceReal,
      sinonimos: sinonimosReais,
    });
    // A planilha deixa a célula do código vazia quando não há código a sugerir.
    expect(resultado.codigo ?? '').toBe(linha.codigoEsperado);
    expect(resultado.status).toBe(linha.statusEsperado);
  });
});
