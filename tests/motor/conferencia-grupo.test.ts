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
//   10  → 11102001 Bradesco                 (grupo 1, ATIVO)
//   235 → 21401003 PIS a Recolher           (grupo 2, PASSIVO)
//   299 → 24501099 (-) Prejuízos Acumulados (grupo 2, dentro do PASSIVO)
//   537 → 42105002 Telefone                 (grupo 4, CUSTOS E DESPESAS)
const linha = (
  natureza: string,
  saldoAtual: number,
  codigo: string | null,
): LinhaParaConferir => ({ natureza, saldoAtual, codigo });

const conferir = (linhas: LinhaParaConferir[]) => conferirPorGrupo(linhas, plano);
const grupo = (c: ReturnType<typeof conferir>, chave: string) =>
  c.grupos.find((g) => g.chave === chave)!;

describe('conferência por grupo: origem × Domínio', () => {
  it('tudo mapeado para o grupo certo fecha sem diferença', () => {
    const c = conferir([
      linha('ATIVO CIRCULANTE', -1000, '10'),
      linha('PASSIVO', 600, '235'),
      linha('DESPESA ADMINISTRATIVA', -400, '537'),
    ]);

    expect(c.confere).toBe(true);
    expect(c.grupos.every((g) => g.diferenca === 0)).toBe(true);
    expect(grupo(c, '1').origem).toBe(-1000);
    expect(grupo(c, '1').dominio).toBe(-1000);
    expect(grupo(c, '4').rotulo).toBe('CUSTOS E DESPESAS');
  });

  // O caso que a conferência existe para pegar.
  it('conta indicada para o grupo errado aparece como par de diferenças opostas', () => {
    const c = conferir([
      linha('ATIVO CIRCULANTE', -1000, '537'), // ativo mapeado para Telefone (despesa!)
      linha('DESPESA ADMINISTRATIVA', -400, '537'),
    ]);

    expect(c.confere).toBe(false);
    // Falta no ativo o que sobrou na despesa, pelo mesmo valor.
    expect(grupo(c, '1').diferenca).toBe(-1000);
    expect(grupo(c, '4').diferenca).toBe(1000);
    expect(grupo(c, '1').diferenca + grupo(c, '4').diferenca).toBe(0);
  });

  // Pendência é ausência legítima no destino: não pode virar divergência.
  it('linha pendente não gera diferença', () => {
    const c = conferir([
      linha('ATIVO CIRCULANTE', -1000, '10'),
      linha('ATIVO CIRCULANTE', -250, null),
    ]);

    expect(c.confere).toBe(true);
    expect(grupo(c, '1').origem).toBe(-1250);
    expect(grupo(c, '1').pendente).toBe(-250);
    expect(grupo(c, '1').dominio).toBe(-1000);
    expect(grupo(c, '1').diferenca).toBe(0);
  });

  it('pendente e erro de grupo convivem sem se confundir', () => {
    const c = conferir([
      linha('ATIVO CIRCULANTE', -1000, '537'), // erro de grupo
      linha('ATIVO CIRCULANTE', -250, null), // pendente
    ]);
    expect(grupo(c, '1').pendente).toBe(-250);
    expect(grupo(c, '1').diferenca).toBe(-1000); // só o erro, sem a pendência
  });

  // No plano do Domínio o PL mora dentro do PASSIVO (classificação 24).
  it('patrimônio líquido confere dentro do passivo, sem divergência falsa', () => {
    const c = conferir([linha('PATRIMÔNIO LÍQUIDO', 5000, '299')]);
    expect(c.confere).toBe(true);
    expect(grupo(c, '2').origem).toBe(5000);
    expect(grupo(c, '2').dominio).toBe(5000);
  });

  it('receita e dedução da receita caem em grupos diferentes, como na contabilidade', () => {
    const c = conferir([
      linha('RECEITA DE SERVIÇOS', 900, '537'), // receita mapeada para despesa: erro
    ]);
    expect(grupo(c, '3').diferenca).toBe(900);
    expect(grupo(c, '4').diferenca).toBe(-900);
  });

  describe('o que não dá para conferir fica de fora e é informado', () => {
    it('natureza não reconhecida não entra em nenhum lado', () => {
      const c = conferir([
        linha('ATIVO CIRCULANTE', -1000, '10'),
        linha('COMPENSAÇÃO', -77, '10'),
      ]);

      expect(c.foraDaConferencia).toEqual({ quantidade: 1, saldo: -77 });
      // O grupo 1 só enxerga a linha que dava para conferir.
      expect(grupo(c, '1').origem).toBe(-1000);
      expect(grupo(c, '1').dominio).toBe(-1000);
      expect(c.confere).toBe(true);
    });

    it('conta indicada fora do plano não entra em nenhum lado', () => {
      const c = conferir([
        linha('ATIVO CIRCULANTE', -1000, '10'),
        linha('ATIVO CIRCULANTE', -55, 'NAO-EXISTE'),
      ]);

      expect(c.foraDaConferencia).toEqual({ quantidade: 1, saldo: -55 });
      expect(grupo(c, '1').diferenca).toBe(0);
    });
  });

  it('grupo sem nada dos dois lados não polui a tabela', () => {
    const c = conferir([linha('ATIVO CIRCULANTE', -1000, '10')]);
    expect(c.grupos.map((g) => g.chave)).toEqual(['1']);
  });

  it('balancete vazio confere e não inventa grupo', () => {
    const c = conferir([]);
    expect(c.grupos).toEqual([]);
    expect(c.confere).toBe(true);
    expect(c.foraDaConferencia).toEqual({ quantidade: 0, saldo: 0 });
  });

  it('centavos são arredondados antes de julgar a diferença', () => {
    const c = conferir([
      linha('ATIVO CIRCULANTE', -0.001, '10'),
      linha('ATIVO CIRCULANTE', -1000, '10'),
    ]);
    expect(c.confere).toBe(true);
  });
});
