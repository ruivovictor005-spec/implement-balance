// Reabrir implantação concluída, conta criada restrita à própria implantação, coluna opcional de
// custo/despesa vinda do arquivo e as duas tabelas de natureza (COSIF e Domínio).
import { eq } from 'drizzle-orm';
import type { PgliteDatabase } from 'drizzle-orm/pglite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { semear } from '../../scripts/semear.js';
import {
  anexarBalancete,
  iniciarImplantacao,
  listarContasCriadas,
  reabrirImplantacao,
  registrarContaCriada,
  salvarDadosEmpresa,
} from '../../src/dados/implantacoes.js';
import { carregarRegras } from '../../src/dados/regras.js';
import * as schema from '../../src/dados/schema.js';
import { concluirImplantacao, gerarTxtDaImplantacao } from '../../src/app/implantacao/concluir.js';
import { criarBancoTeste } from '../apoio/banco.js';

describe('correções: reabrir, conta criada, custo/despesa e natureza do Domínio', () => {
  let banco: PgliteDatabase<typeof schema>;
  let fechar: () => Promise<void>;
  let ana: number;
  let bruno: number;

  beforeEach(async () => {
    ({ banco, fechar } = await criarBancoTeste());
    await semear(banco);
    const [a, b] = await banco
      .insert(schema.usuario)
      .values([
        { oidEntra: 'a', email: 'ana@x.com', nome: 'Ana' },
        { oidEntra: 'b', email: 'bruno@x.com', nome: 'Bruno' },
      ])
      .returning({ id: schema.usuario.id });
    ana = a.id;
    bruno = b.id;
  });
  afterEach(async () => {
    await fechar();
  });

  const comDados = (id: number, usuarioId: number) =>
    salvarDadosEmpresa(banco, id, usuarioId, {
      empresaCnpj: '12345678000190',
      empresaCodigoDominio: '1',
      dataSaldo: '2026-08-31',
      tipoLote: 'V',
      codigoHistorico: '700',
      incluirCabecalho: false,
    });

  const csv = (linhas: string[]) => ({
    bytes: new TextEncoder().encode(
      ['codi_cta;nome_cta;clas_cta;tipo_cta;saldoant;totdeb;totcre;saldoatu;custo_despesa', ...linhas].join(
        '\n',
      ),
    ),
    nomeArquivo: 'balancete.csv',
  });

  const status = async (id: number) =>
    (await banco.select().from(schema.implantacao).where(eq(schema.implantacao.id, id)))[0];

  describe('reabrir implantação concluída', () => {
    const concluida = async () => {
      const id = await iniciarImplantacao(banco, ana);
      await comDados(id, ana);
      await anexarBalancete(banco, id, ana, csv(['1;CAIXA GERAL;1.1.1.10.00.00.00001;A;0;0;0;-100;']));
      await gerarTxtDaImplantacao(banco, id, ana, 'teste');
      expect((await concluirImplantacao(banco, id, ana)).ok).toBe(true);
      return id;
    };

    it('volta para em andamento, sai das concluídas e exige gerar o TXT de novo', async () => {
      const id = await concluida();
      expect(await reabrirImplantacao(banco, id, ana)).toEqual({ ok: true });
      const imp = await status(id);
      expect(imp.status).toBe('em_andamento');
      expect(imp.concluidaEm).toBeNull();
      expect(imp.txtHash).toBeNull();
      expect((await concluirImplantacao(banco, id, ana)).ok).toBe(false); // gere o TXT antes
    });

    it('outra pessoa não reabre', async () => {
      const id = await concluida();
      expect(await reabrirImplantacao(banco, id, bruno)).toEqual({
        ok: false,
        erro: 'Esta implantação é de outra pessoa.',
      });
    });

    it('só reabre o que está concluído', async () => {
      const id = await iniciarImplantacao(banco, ana);
      expect((await reabrirImplantacao(banco, id, ana)).ok).toBe(false);
    });
  });

  describe('conta criada fica restrita à implantação', () => {
    const conta = { codigoReduzido: '99001', descricao: 'Fornecedor Especial', classificacao: '21101099' };

    it('aparece só na implantação onde foi criada', async () => {
      const minha = await iniciarImplantacao(banco, ana);
      const outra = await iniciarImplantacao(banco, bruno);
      expect(await registrarContaCriada(banco, minha, ana, conta)).toEqual({ ok: true });
      expect((await listarContasCriadas(banco, minha)).map((c) => c.codigoReduzido)).toEqual(['99001']);
      expect(await listarContasCriadas(banco, outra)).toEqual([]);
    });

    it('recusa código que já existe no plano padrão', async () => {
      const id = await iniciarImplantacao(banco, ana);
      const r = await registrarContaCriada(banco, id, ana, { ...conta, codigoReduzido: '201' });
      expect(r.ok).toBe(false);
      expect(await listarContasCriadas(banco, id)).toEqual([]);
    });

    it('recusa criar o mesmo código duas vezes na mesma implantação', async () => {
      const id = await iniciarImplantacao(banco, ana);
      await registrarContaCriada(banco, id, ana, conta);
      expect((await registrarContaCriada(banco, id, ana, conta)).ok).toBe(false);
    });
  });

  describe('coluna opcional de custo ou despesa', () => {
    it('vem do arquivo e decide entre o salário de custo e o de despesa', async () => {
      const id = await iniciarImplantacao(banco, ana);
      await comDados(id, ana);
      const r = await anexarBalancete(
        banco,
        id,
        ana,
        csv([
          '1;SALARIOS;8.1.9.99.00.00.00005;A;0;0;0;-100;C',
          '2;SALARIOS;8.1.9.99.00.00.00006;A;0;0;0;-200;D',
          '3;SALARIOS;4.9.9.99.00.00.00007;A;0;0;0;300;C',
        ]),
      );
      const [custo, despesa, passivo] = r.linhas;
      expect([custo.natureza, custo.codigo]).toEqual(['CUSTO', '418']);
      expect([despesa.natureza, despesa.codigo]).toEqual(['DESPESA', '485']);
      expect([passivo.natureza, passivo.codigo]).toEqual(['PASSIVO', '219']);
    });

    it('sem a coluna, o balancete é lido como sempre', async () => {
      const id = await iniciarImplantacao(banco, ana);
      const semColuna = {
        bytes: new TextEncoder().encode(
          'codi_cta;nome_cta;clas_cta;tipo_cta;saldoant;totdeb;totcre;saldoatu\n1;CAIXA GERAL;1.1.1.10.00.00.00001;A;0;0;0;-100\n',
        ),
        nomeArquivo: 'balancete.csv',
      };
      const r = await anexarBalancete(banco, id, ana, semColuna);
      expect(r.linhas).toHaveLength(1);
    });
  });

  it('as regras chegam em duas tabelas: COSIF (origem) e Domínio (destino)', async () => {
    const regras = await carregarRegras(banco);
    expect(regras.natureza).toHaveLength(25);
    expect(regras.naturezaDominio).toHaveLength(20);
    expect(regras.natureza.every((r) => r.conjunto === 'cosif')).toBe(true);
    expect(regras.naturezaDominio.every((r) => r.conjunto === 'dominio')).toBe(true);
  });
});
