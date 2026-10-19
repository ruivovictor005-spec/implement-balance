import { describe, expect, it } from 'vitest';
import { normalizarNome } from '../../src/motor/normalizar.js';
import {
  carregarBalancete,
  carregarNormalizacao,
  carregarPlano,
  carregarSinonimos,
  somenteAnaliticas,
} from '../apoio/fixtures.js';

const regras = carregarNormalizacao();

describe('normalizarNome — exemplos das duas etapas', () => {
  it('maiúsculas, espaço não separável e espaços das pontas', () =>
    expect(normalizarNome(' caixa\u00A0geral ', regras)).toBe('CAIXA GERAL'));

  it('etapa 1 remove acento', () => expect(normalizarNome('Disponível', regras)).toBe('DISPONIVEL'));

  it('etapa 2 remove palavra inteira', () =>
    expect(normalizarNome('EMPRESA LTDA', regras)).toBe('EMPRESA'));

  it('etapa 2 não corta palavra parcial', () =>
    expect(normalizarNome('DEPOSITOS', regras)).toBe('DEPOSITOS'));

  it('etapa 1 aplica as regras em cadeia, uma sobre o resultado da anterior', () =>
    // "&" vira " E ", e a palavra E que nasce aí é apagada pela etapa 2.
    expect(normalizarNome('JUROS & MULTAS', regras)).toBe('JUROS MULTAS'));

  it('substituição por espaço separa em vez de colar', () =>
    expect(normalizarNome('PIS.COFINS', regras)).toBe('PIS COFINS'));

  it('palavra do dicionário que sobra sozinha depois da pontuação é apagada', () =>
    // "A" isolado é artigo no dicionário da etapa 2: o ponto separa e a letra some.
    expect(normalizarNome('A.B', regras)).toBe('B'));

  it('etapa 2 troca a abreviação pela palavra inteira', () =>
    expect(normalizarNome('TAXA A PAGAR', regras)).toBe('TAXAS PAGAR'));

  it('regra com trecho vazio é inerte', () =>
    expect(normalizarNome('CAIXA', [{ etapa: 1, ordem: 1, de: '', para: 'X' }])).toBe('CAIXA'));

  it('sem regras, só maiúsculas e espaços', () =>
    expect(normalizarNome('  banco   do   brasil ', [])).toBe('BANCO DO BRASIL'));
});

describe('normalizarNome — gabarito da planilha', () => {
  it.each(carregarSinonimos())('sinônimo %#: $nomeOriginal', ({ nomeOriginal, chaveNormalizada }) =>
    expect(normalizarNome(nomeOriginal, regras)).toBe(chaveNormalizada));

  it.each(carregarPlano())('conta do plano %#: $descricao', ({ descricao, descricaoNormalizada }) =>
    expect(normalizarNome(descricao, regras)).toBe(descricaoNormalizada));

  it.each(somenteAnaliticas(carregarBalancete()))(
    'linha do balancete %#: $nomeCta',
    ({ nomeCta, nomeNormalizadoEsperado }) =>
      expect(normalizarNome(nomeCta, regras)).toBe(nomeNormalizadoEsperado),
  );
});
