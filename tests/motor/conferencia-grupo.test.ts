import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  conferirPorGrupo,
  type ContaDoPlano,
  type LinhaParaConferir,
} from '../../src/motor/conferencia-grupo.js';

const plano: ContaDoPlano[] = JSON.parse(
  readFileSync(new URL('../../fixtures/plano.json', import.meta.url), 'utf8'),
).map((c: { codigoReduzido: unknown; classificacao: unknown; descricao: string }) => ({
  codigoReduzido: String(c.codigoReduzido),
  classificacao: String(c.classificacao),
  descricao: c.descricao,
}));

// Contas reais do plano, pelo código reduzido:
//   1   → 11101001 Caixa - Fundo Fixo          (grupo 1, subgrupo 11)
//   99  → 12101001 Empréstimos Funcionários    (grupo 1, subgrupo 12)
//   108 → 13101001 Investimento Original       (grupo 1, subgrupo 13)
//   235 → 21401003 PIS a Recolher              (grupo 2, subgrupo 21)
//   267 → 24101001 Capital Social              (grupo 2, subgrupo 24)
//   485 → 42101001 Salários                    (grupo 4, subgrupo 42)
const linha = (
  natureza: string,
  gruposDominio: string[],
  saldoAtual: number,
  codigo: string | null,
): LinhaParaConferir => ({ natureza, gruposDominio, saldoAtual, codigo });

const conferir = (linhas: LinhaParaConferir[]) => conferirPorGrupo(linhas, plano);
const g = (c: ReturnType<typeof conferir>, chave: string) =>
  c.grupos.find((x) => x.chave === chave)!;

describe('1º nível: origem × Domínio', () => {
  it('tudo no grupo certo não pede atenção', () => {
    const c = conferir([
      linha('ATIVO CIRCULANTE', ['11'], -1000, '1'),
      linha('PASSIVO', ['21', '22'], 600, '235'),
      linha('DESPESA ADMINISTRATIVA', ['42'], -400, '485'),
    ]);
    expect(c.confere).toBe(true);
    expect(g(c, '1').rotulo).toBe('ATIVO');
    expect(g(c, '1').nivel).toBe(0);
  });

  it('conta indicada para outro grupo vira um par de diferenças opostas', () => {
    const c = conferir([
      linha('ATIVO CIRCULANTE', ['11'], -1000, '485'), // ativo → despesa
      linha('DESPESA ADMINISTRATIVA', ['42'], -400, '485'),
    ]);
    expect(g(c, '1').diferenca).toBe(-1000);
    expect(g(c, '4').diferenca).toBe(1000);
    expect(g(c, '1').diferenca + g(c, '4').diferenca).toBe(0);
  });

  it('linha pendente não vira diferença', () => {
    const c = conferir([
      linha('ATIVO CIRCULANTE', ['11'], -1000, '1'),
      linha('ATIVO CIRCULANTE', ['11'], -250, null),
    ]);
    expect(c.confere).toBe(true);
    expect(g(c, '1').pendente).toBe(-250);
    expect(g(c, '11').pendente).toBe(-250);
  });

  it('patrimônio líquido confere dentro do passivo', () => {
    const c = conferir([linha('PATRIMÔNIO LÍQUIDO', ['24'], 5000, '267')]);
    expect(c.confere).toBe(true);
    expect(g(c, '2').origem).toBe(5000);
    expect(g(c, '24').rotulo).toBe('Patrimônio Líquido');
  });
});

describe('2º nível: subgrupo', () => {
  // O ganho real: os dois estão dentro de ATIVO, então o 1º nível não vê nada.
  it('conta do circulante indicada no não circulante passa no topo e acende no subgrupo', () => {
    const c = conferir([linha('ATIVO CIRCULANTE', ['11'], -1000, '99')]); // 11 esperado, caiu em 12

    expect(g(c, '1').confere).toBe(true); // o topo não enxerga
    expect(g(c, '11').confere).toBe(false);
    expect(g(c, '12').confere).toBe(false);
    expect(g(c, '11').diferenca).toBe(-1000);
    expect(g(c, '12').diferenca).toBe(1000);
    expect(c.confere).toBe(false);
  });

  it('subgrupo certo não pede atenção', () => {
    const c = conferir([linha('ATIVO CIRCULANTE', ['11'], -1000, '1')]);
    expect(g(c, '11').confere).toBe(true);
    expect(g(c, '11').rotulo).toBe('Ativo Circulante');
    expect(g(c, '11').nivel).toBe(1);
  });

  it('os subgrupos saem logo depois do grupo que os contém', () => {
    const c = conferir([
      linha('DESPESA ADMINISTRATIVA', ['42'], -400, '485'),
      linha('ATIVO CIRCULANTE', ['11'], -1000, '1'),
    ]);
    expect(c.grupos.map((x) => x.chave)).toEqual(['1', '11', '4', '42']);
  });

  // Natureza que aceita mais de um subgrupo não tem subgrupo esperado: apontar ali seria falso.
  it('natureza ambígua fica fora do 2º nível, sem acender nada', () => {
    const c = conferir([
      linha('ATIVO', ['11', '12'], -1000, '99'), // aceita os dois; caiu no 12
    ]);
    expect(c.foraDoSubgrupo).toEqual({ quantidade: 1, saldo: -1000 });
    expect(c.grupos.some((x) => x.nivel === 1)).toBe(false);
    expect(c.confere).toBe(true); // o topo confere e o subgrupo não foi julgado
  });

  it('ambígua e inequívoca convivem: só a inequívoca é conferida', () => {
    const c = conferir([
      linha('ATIVO', ['11', '12'], -500, '99'),
      linha('ATIVO CIRCULANTE', ['11'], -1000, '1'),
    ]);
    expect(c.foraDoSubgrupo.quantidade).toBe(1);
    expect(g(c, '11').origem).toBe(-1000);
    expect(g(c, '11').confere).toBe(true);
    expect(c.grupos.some((x) => x.chave === '12')).toBe(false);
  });

  it('natureza sem subgrupo permitido fica fora do 2º nível', () => {
    const c = conferir([linha('ATIVO CIRCULANTE', [], -300, '1')]);
    expect(c.foraDoSubgrupo).toEqual({ quantidade: 1, saldo: -300 });
    expect(g(c, '1').confere).toBe(true);
  });
});

describe('o que não dá para conferir é informado, não escondido', () => {
  it('natureza não reconhecida fica fora dos dois níveis', () => {
    const c = conferir([
      linha('ATIVO CIRCULANTE', ['11'], -1000, '1'),
      linha('COMPENSAÇÃO', [], -77, '1'),
    ]);
    expect(c.foraDaConferencia).toEqual({ quantidade: 1, saldo: -77 });
    expect(g(c, '1').origem).toBe(-1000);
    expect(c.confere).toBe(true);
  });

  it('conta indicada fora do plano fica fora dos dois níveis', () => {
    const c = conferir([
      linha('ATIVO CIRCULANTE', ['11'], -1000, '1'),
      linha('ATIVO CIRCULANTE', ['11'], -55, 'NAO-EXISTE'),
    ]);
    expect(c.foraDaConferencia).toEqual({ quantidade: 1, saldo: -55 });
    expect(g(c, '11').diferenca).toBe(0);
  });

  it('as duas contagens são independentes', () => {
    const c = conferir([
      linha('COMPENSAÇÃO', [], -10, '1'), // fora de tudo
      linha('ATIVO', ['11', '12'], -20, '1'), // só fora do subgrupo
    ]);
    expect(c.foraDaConferencia.quantidade).toBe(1);
    expect(c.foraDoSubgrupo.quantidade).toBe(1);
  });
});

describe('bordas', () => {
  it('balancete vazio confere e não inventa grupo', () => {
    const c = conferir([]);
    expect(c.grupos).toEqual([]);
    expect(c.confere).toBe(true);
    expect(c.foraDaConferencia).toEqual({ quantidade: 0, saldo: 0 });
    expect(c.foraDoSubgrupo).toEqual({ quantidade: 0, saldo: 0 });
  });

  it('grupo sem nada dos dois lados não polui a tabela', () => {
    const c = conferir([linha('ATIVO CIRCULANTE', ['11'], -1000, '1')]);
    expect(c.grupos.map((x) => x.chave)).toEqual(['1', '11']);
  });

  it('centavos são arredondados antes de julgar', () => {
    const c = conferir([
      linha('ATIVO CIRCULANTE', ['11'], -0.001, '1'),
      linha('ATIVO CIRCULANTE', ['11'], -1000, '1'),
    ]);
    expect(c.confere).toBe(true);
  });
});
