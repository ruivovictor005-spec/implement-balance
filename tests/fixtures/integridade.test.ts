import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type {
  ContaPlano,
  LinhaBalanceteGabarito,
  RegraNatureza,
  RegraNormalizacao,
  SinonimoFixture,
} from '../../src/motor/tipos.js';

const PASTA_FIXTURES = new URL('../../fixtures/', import.meta.url);

function carregar<T>(arquivo: string): T {
  return JSON.parse(readFileSync(new URL(arquivo, PASTA_FIXTURES), 'utf8')) as T;
}

function textoBruto(arquivo: string): string {
  return readFileSync(new URL(arquivo, PASTA_FIXTURES), 'utf8');
}

describe('integridade das fixtures extraídas da planilha', () => {
  it('plano tem 711 contas, 529 analíticas e 182 sintéticas', () => {
    const plano = carregar<ContaPlano[]>('plano.json');
    expect(plano).toHaveLength(711);
    expect(plano.filter((c) => c.tipo === 'A')).toHaveLength(529);
    expect(plano.filter((c) => c.tipo === 'S')).toHaveLength(182);
    for (const conta of plano) {
      expect(typeof conta.codigoReduzido).toBe('string');
      expect(conta.codigoReduzido).not.toBe('');
    }
    expect(new Set(plano.map((c) => c.codigoReduzido)).size).toBe(711);
    expect(plano.map((c) => c.codigoReduzido)).toContain('1');
  });

  it('sinônimos tem 1387 linhas, todas com chave e código', () => {
    const sinonimos = carregar<SinonimoFixture[]>('sinonimos.json');
    const codigosDoPlano = new Set(carregar<ContaPlano[]>('plano.json').map((c) => c.codigoReduzido));
    expect(sinonimos).toHaveLength(1387);
    expect(sinonimos.filter((s) => !codigosDoPlano.has(s.codigoReduzido))).toEqual([]);
    for (const s of sinonimos) {
      expect(s.nomeOriginal).not.toBe('');
      expect(s.chaveNormalizada).not.toBe('');
      expect(typeof s.codigoReduzido).toBe('string');
      expect(s.codigoReduzido).not.toBe('');
    }
  });

  it('normalização tem 50 regras na etapa 1 e 132 na etapa 2, com ordem sem buraco', () => {
    // A planilha tem 199 posições por etapa. Preenchidas hoje: 50 trechos na coluna A (mais uma
    // posição sem trecho, inerte, que não vira regra) e 132 na coluna D. Total 182.
    const regras = carregar<RegraNormalizacao[]>('normalizacao.json');
    const etapa1 = regras.filter((r) => r.etapa === 1);
    const etapa2 = regras.filter((r) => r.etapa === 2);
    expect(etapa1).toHaveLength(50);
    expect(etapa2).toHaveLength(132);
    expect(regras).toHaveLength(182);
    expect(etapa1.map((r) => r.ordem)).toEqual(etapa1.map((_, i) => i + 1));
    expect(etapa2.map((r) => r.ordem)).toEqual(etapa2.map((_, i) => i + 1));
    for (const regra of regras) {
      expect(regra.de).not.toBe('');
    }
    // Espaços nas pontas dos trechos importam (' DE ' é a palavra inteira) e não podem ser aparados;
    // e "substituir por" vazio (apagar o trecho) é uma regra válida.
    expect(etapa2).toContainEqual(expect.objectContaining({ de: ' DE ', para: ' ' }));
    expect(etapa1).toContainEqual(expect.objectContaining({ de: '\u00BA', para: '' })); // º (U+00BA) é apagado
  });

  it('regras cujo valor de substituição é só espaços são preservadas sem trim', () => {
    // Na planilha, o espaço é o conteúdo: " DE " vira " " (a palavra some, o espaço fica) e
    // "." vira " ". Um trim em massa transformaria essas regras em apagar sem deixar espaço e
    // juntaria palavras vizinhas. Por isso se contam as regras, e não só se amostram duas.
    const regras = carregar<RegraNormalizacao[]>('normalizacao.json');
    const etapa1 = regras.filter((r) => r.etapa === 1);
    const etapa2 = regras.filter((r) => r.etapa === 2);
    const soEspacos = (r: RegraNormalizacao) => r.para !== '' && r.para.trim() === '';
    expect(etapa1.filter(soEspacos)).toHaveLength(18);
    expect(etapa2.filter(soEspacos)).toHaveLength(17);
    expect(etapa1.filter((r) => r.para === '')).toHaveLength(3);
    expect(etapa2.filter((r) => r.para === '')).toHaveLength(0);
    // Todas as 132 palavras da etapa 2 têm espaço nas pontas (palavra inteira); nenhum trecho
    // da etapa 1 tem. É este número que pega um trim em massa em `de`.
    expect(regras.filter((r) => r.de !== r.de.trim())).toHaveLength(132);
    expect(etapa2.every((r) => r.de !== r.de.trim())).toBe(true);
  });

  it('natureza tem 25 regras, com NÃO MIGRAR em 5.9.9.99, 3 e 9', () => {
    const regras = carregar<RegraNatureza[]>('natureza.json');
    expect(regras).toHaveLength(25);
    expect(regras.map((r) => r.ordem)).toEqual(regras.map((_, i) => i + 1));
    const naoMigrar = regras.filter((r) => r.naoMigrar).map((r) => r.prefixo);
    expect(naoMigrar.sort()).toEqual(['3', '5.9.9.99', '9']);
    for (const regra of regras) {
      expect(typeof regra.prefixo).toBe('string');
      if (regra.naoMigrar) {
        expect(regra.gruposDominio).toEqual([]);
      } else {
        expect(regra.gruposDominio.length).toBeGreaterThan(0);
      }
    }
  });

  it('balancete tem 113 linhas, 27 analíticas e 86 sintéticas', () => {
    const balancete = carregar<LinhaBalanceteGabarito[]>('balancete.json');
    expect(balancete).toHaveLength(113);
    const analiticas = balancete.filter((l) => l.tipoCta.startsWith('A'));
    const sinteticas = balancete.filter((l) => l.tipoCta.startsWith('S'));
    expect(analiticas).toHaveLength(27);
    expect(sinteticas).toHaveLength(86);
    // Forma textual exata dos códigos: sem número e sem trim ("      -" é o código do totalizador P.L.A.).
    for (const linha of balancete) {
      expect(typeof linha.codiCta).toBe('string');
    }
    expect(balancete.map((l) => l.codiCta)).toEqual(expect.arrayContaining(['000083-3', '      -']));
    // Gabarito: natureza e grupos (Q, R) a planilha calcula para todas as linhas...
    for (const linha of balancete) {
      expect(linha.naturezaEsperada, linha.codiCta).not.toBe('');
      expect(linha.gruposEsperados.length, linha.codiCta).toBeGreaterThan(0);
    }
    // ...mas nome normalizado, código e status (K, M, P) só para as analíticas.
    for (const linha of sinteticas) {
      expect(linha.nomeNormalizadoEsperado).toBe('');
      expect(linha.codigoEsperado).toBe('');
      expect(linha.statusEsperado).toBe('');
    }
    for (const linha of analiticas) {
      expect(linha.nomeNormalizadoEsperado, linha.codiCta).not.toBe('');
      expect(linha.statusEsperado, linha.codiCta).not.toBe('');
      // A única analítica sem código sugerido é a que a planilha manda não migrar.
      const naoMigrar = linha.statusEsperado.startsWith('Não migrar');
      expect(linha.codigoEsperado === '', linha.codiCta).toBe(naoMigrar);
    }
    expect(analiticas.map((l) => l.codigoEsperado)).toContain('18');
    // Coluna L (ajusteManual) é entrada digitada, não resultado de fórmula. Sem ela, as duas linhas
    // abaixo são irreprodutíveis: o código 485 veio da mão da pessoa, não de nome nem de sinônimo.
    for (const linha of balancete) {
      expect(typeof linha.ajusteManual, linha.codiCta).toBe('string');
    }
    const comAjuste = balancete.filter((l) => l.ajusteManual !== '');
    expect(comAjuste.map((l) => l.codiCta).sort()).toEqual(['002171-7', '032630-5']);
    for (const linha of comAjuste) {
      expect(linha.ajusteManual, linha.codiCta).toBe('485');
      expect(linha.codigoEsperado, linha.codiCta).toBe('485');
      expect(linha.statusEsperado, linha.codiCta).toBe('Manual (coluna L)');
    }
  });

  it('TXT esperado tem 24 linhas: 1 registro 02, 22 registros 03, 1 registro 99', () => {
    const linhas = carregar<string[]>('txt-esperado.json');
    expect(linhas).toHaveLength(24);
    expect(linhas.filter((l) => l.startsWith('02'))).toHaveLength(1);
    expect(linhas.filter((l) => l.startsWith('03'))).toHaveLength(22);
    expect(linhas.filter((l) => l.startsWith('99'))).toHaveLength(1);
  });

  it('registros do TXT têm 150, 664 e 100 caracteres', () => {
    // Os espaços finais são significativos (layout posicional): nada de trim.
    const linhas = carregar<string[]>('txt-esperado.json');
    for (const linha of linhas) {
      const esperado = linha.startsWith('02') ? 150 : linha.startsWith('03') ? 664 : 100;
      expect(linha).toHaveLength(esperado);
    }
  });

  it('sequência dos registros 03 vai de 0000002 a 0000023 sem pular', () => {
    const linhas = carregar<string[]>('txt-esperado.json');
    const sequencias = linhas.filter((l) => l.startsWith('03')).map((l) => l.slice(2, 9));
    expect(sequencias).toEqual(
      Array.from({ length: 22 }, (_, i) => String(i + 2).padStart(7, '0')),
    );
  });

  it('nenhuma fixture contém CNPJ ou código de empresa', () => {
    // Fixtures de dados: nenhum texto no formato de CNPJ (14 dígitos ou máscara).
    const cnpjSemMascara = /(?<!\d)\d{14}(?!\d)/;
    const cnpjComMascara = /\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/;
    for (const arquivo of [
      'plano.json',
      'sinonimos.json',
      'normalizacao.json',
      'natureza.json',
      'balancete.json',
    ]) {
      const texto = textoBruto(arquivo);
      expect(texto, arquivo).not.toMatch(cnpjSemMascara);
      expect(texto, arquivo).not.toMatch(cnpjComMascara);
    }
    // TXT: o registro 01 é o único que carrega CNPJ e código da empresa, e deve estar ausente.
    // Não se procura o código da empresa no corpo dos registros: um campo numérico de 15 posições
    // pode conter esses dígitos por coincidência.
    const linhas = carregar<string[]>('txt-esperado.json');
    expect(linhas.filter((l) => l.startsWith('01'))).toEqual([]);
  });
});
