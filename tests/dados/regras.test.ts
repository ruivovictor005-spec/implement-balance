// Edição das duas tabelas de regras globais: natureza (classificação → natureza e grupos) e
// normalização (as substituições que montam o nome comparável).
//
// O caso perigoso está todo aqui: mudar uma regra de NORMALIZAÇÃO muda a chave de todo sinônimo já
// gravado e a descrição normalizada de todo o plano. Se as três pontas não forem recalculadas
// juntas, os sinônimos param de casar sem ninguém perceber.
import { eq } from 'drizzle-orm';
import type { PgliteDatabase } from 'drizzle-orm/pglite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { semear } from '../../scripts/semear.js';
import {
  alterarRegraNatureza,
  alterarRegraNormalizacao,
  carregarRegras,
  listarRegrasNatureza,
  listarRegrasNormalizacao,
} from '../../src/dados/regras.js';
import { carregarSinonimos } from '../../src/dados/sinonimos.js';
import { normalizarNome } from '../../src/motor/normalizar.js';
import { resolverNatureza } from '../../src/motor/natureza.js';
import * as schema from '../../src/dados/schema.js';
import { criarBancoTeste } from '../apoio/banco.js';

describe('regras globais: ver e mudar', () => {
  let banco: PgliteDatabase<typeof schema>;
  let fechar: () => Promise<void>;
  let usuarioId: number;
  let adminId: number;

  beforeEach(async () => {
    ({ banco, fechar } = await criarBancoTeste());
    await semear(banco);
    const [u, a] = await banco
      .insert(schema.usuario)
      .values([
        { oidEntra: 'u1', email: 'u@x', nome: 'U', papel: 'usuario' },
        { oidEntra: 'a1', email: 'a@x', nome: 'Admin', papel: 'admin' },
      ])
      .returning({ id: schema.usuario.id });
    usuarioId = u.id;
    adminId = a.id;
  });
  afterEach(async () => {
    await fechar();
  });

  /** A invariante que não pode quebrar: o que está guardado é o que o motor calcularia agora. */
  const chavesConferem = async (): Promise<void> => {
    const regras = await carregarRegras(banco);
    const sins = await banco
      .select({
        nome: schema.sinonimo.nomeOriginal,
        chave: schema.sinonimo.chaveNormalizada,
      })
      .from(schema.sinonimo);
    for (const s of sins) {
      expect(s.chave, `chave de ${s.nome}`).toBe(normalizarNome(s.nome, regras.normalizacao));
    }
    const contas = await banco
      .select({
        descricao: schema.planoConta.descricao,
        norm: schema.planoConta.descricaoNormalizada,
      })
      .from(schema.planoConta);
    for (const c of contas) {
      expect(c.norm, `plano: ${c.descricao}`).toBe(
        normalizarNome(c.descricao, regras.normalizacao),
      );
    }
  };

  describe('natureza', () => {
    const regraDoPrefixo = async (prefixo: string) => {
      const regra = (await listarRegrasNatureza(banco)).find((r) => r.prefixo === prefixo);
      expect(regra, `nenhuma regra para o prefixo ${prefixo}`).toBeDefined();
      return regra!;
    };

    it('lista na ordem em que o motor consulta', async () => {
      const regras = await listarRegrasNatureza(banco);
      expect(regras.length).toBeGreaterThan(0);
      expect(regras.map((r) => r.ordem)).toEqual([...regras.map((r) => r.ordem)].sort((a, b) => a - b));
    });

    // A mudança aparece no motor sem mexer em nada gravado: natureza é recalculada a cada vez.
    it('mudar os grupos aceitos muda o que o motor responde', async () => {
      const regra = await regraDoPrefixo('1.1');
      expect(resolverNatureza('1.1.2.30', (await carregarRegras(banco)).natureza)?.gruposDominio)
        .toEqual(['11']);

      const r = await alterarRegraNatureza(banco, adminId, regra.id, {
        natureza: 'ATIVO CIRCULANTE',
        gruposDominio: ['11', '12'],
        naoMigrar: false,
      });
      expect(r.ok).toBe(true);
      expect(resolverNatureza('1.1.2.30', (await carregarRegras(banco)).natureza)?.gruposDominio)
        .toEqual(['11', '12']);
    });

    it('marcar "não migrar" limpa os grupos: eles não teriam uso', async () => {
      const regra = await regraDoPrefixo('1.1');
      await alterarRegraNatureza(banco, adminId, regra.id, {
        natureza: 'COMPENSAÇÃO',
        gruposDominio: ['11'],
        naoMigrar: true,
      });
      const depois = await regraDoPrefixo('1.1');
      expect(depois.naoMigrar).toBe(true);
      expect(depois.gruposDominio).toEqual([]);
    });

    it.each([
      [{ natureza: '  ', gruposDominio: ['11'], naoMigrar: false }, /não pode ficar vazia/],
      [{ natureza: 'X', gruposDominio: ['abc'], naoMigrar: false }, /não é um grupo do Domínio/],
      [{ natureza: 'X', gruposDominio: ['111'], naoMigrar: false }, /não é um grupo do Domínio/],
      [{ natureza: 'X', gruposDominio: [], naoMigrar: false }, /nenhuma conta casa/],
    ])('recusa campos que não fazem sentido (%#)', async (campos, esperado) => {
      const regra = await regraDoPrefixo('1.1');
      const r = await alterarRegraNatureza(banco, adminId, regra.id, campos);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.erro).toMatch(esperado);
      expect((await regraDoPrefixo('1.1')).natureza).toBe(regra.natureza); // nada mudou
    });

    it('quem não é administrador não muda regra global', async () => {
      const regra = await regraDoPrefixo('1.1');
      const r = await alterarRegraNatureza(banco, usuarioId, regra.id, {
        natureza: 'OUTRA COISA',
        gruposDominio: ['11'],
        naoMigrar: false,
      });
      expect(r).toEqual({ ok: false, erro: 'Apenas o administrador pode mudar regras.' });
      expect((await regraDoPrefixo('1.1')).natureza).toBe(regra.natureza);
    });
  });

  describe('normalização', () => {
    const regraDe = async (de: string) => {
      const regra = (await listarRegrasNormalizacao(banco)).find((r) => r.de === de);
      expect(regra, `nenhuma regra para ${JSON.stringify(de)}`).toBeDefined();
      return regra!;
    };

    it('a base semeada já começa consistente', async () => {
      await chavesConferem();
    });

    // O coração: a chave guardada e a que o motor calcula têm de continuar iguais depois da troca.
    it('mudar uma regra recalcula as chaves dos sinônimos e do plano', async () => {
      const antes = await carregarSinonimos(banco);
      expect(antes.get('INSS PAGAR')).toBe('227');

      const regra = await regraDe(' RECOLHER ');
      const r = await alterarRegraNormalizacao(banco, adminId, regra.id, {
        de: ' RECOLHER ',
        para: ' QUITAR ',
        ativo: true,
      });
      expect(r.ok).toBe(true);

      await chavesConferem();
      const depois = await carregarSinonimos(banco);
      expect(depois.get('INSS PAGAR')).toBeUndefined(); // a chave antiga não existe mais
      expect(depois.get('INSS QUITAR')).toBe('227'); // e a nova aponta para a mesma conta

      // O que importa de verdade: o nome do balancete continua chegando na mesma conta.
      const regras = await carregarRegras(banco);
      expect(depois.get(normalizarNome('INSS A RECOLHER', regras.normalizacao))).toBe('227');
    });

    it('desligar uma regra tira ela do motor — a coluna "ativo" não era consultada', async () => {
      const regra = await regraDe(' RECOLHER ');
      await alterarRegraNormalizacao(banco, adminId, regra.id, {
        de: regra.de,
        para: regra.para,
        ativo: false,
      });
      const regras = await carregarRegras(banco);
      expect(regras.normalizacao.some((n) => n.de === ' RECOLHER ')).toBe(false);
      expect(normalizarNome('INSS A RECOLHER', regras.normalizacao)).toBe('INSS RECOLHER');
      await chavesConferem();
    });

    // Duas regras diferentes virando a mesma chave fariam um sinônimo sumir pelo índice único.
    it('colisão entre dois sinônimos ativos aborta tudo e explica quais são', async () => {
      const antes = await carregarSinonimos(banco);
      expect(antes.get('INSS')).toBe('227');
      expect(antes.get('INSS RETIDO')).toBe('227');

      const regra = await regraDe(' BCO ');
      const r = await alterarRegraNormalizacao(banco, adminId, regra.id, {
        de: ' RETIDO ',
        para: ' ',
        ativo: true,
      });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.erro).toMatch(/viram a mesma chave/);

      // Nada foi gravado: nem a regra, nem as chaves.
      expect((await regraDe(' BCO ')).para).toBe(regra.para);
      await chavesConferem();
      expect((await carregarSinonimos(banco)).get('INSS RETIDO')).toBe('227');
    });

    it('trecho procurado vazio é recusado', async () => {
      const regra = await regraDe(' RECOLHER ');
      const r = await alterarRegraNormalizacao(banco, adminId, regra.id, {
        de: '',
        para: ' X ',
        ativo: true,
      });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.erro).toMatch(/não pode ficar vazio/);
    });

    it('quem não é administrador não muda regra global', async () => {
      const regra = await regraDe(' RECOLHER ');
      const r = await alterarRegraNormalizacao(banco, usuarioId, regra.id, {
        de: ' RECOLHER ',
        para: ' QUITAR ',
        ativo: true,
      });
      expect(r).toEqual({ ok: false, erro: 'Apenas o administrador pode mudar regras.' });
      expect((await regraDe(' RECOLHER ')).para).toBe(regra.para);
    });

    it('regra de outra versão (ou inexistente) não é alterada', async () => {
      const r = await alterarRegraNormalizacao(banco, adminId, 999999, {
        de: ' X ',
        para: ' Y ',
        ativo: true,
      });
      expect(r).toEqual({ ok: false, erro: 'Regra não encontrada na versão vigente.' });
    });
  });
});
