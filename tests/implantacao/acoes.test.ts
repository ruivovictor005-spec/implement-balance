import { readFileSync } from 'node:fs';
import { eq } from 'drizzle-orm';
import type { PgliteDatabase } from 'drizzle-orm/pglite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { semear } from '../../scripts/semear.js';
import {
  anexarBalancete,
  definirAjusteManual,
  iniciarImplantacao,
  recalcular,
  registrarContaCriada,
  salvarDadosEmpresa,
} from '../../src/dados/implantacoes.js';
import * as schema from '../../src/dados/schema.js';
import { criarBancoTeste } from '../apoio/banco.js';

const BALANCETE = new Uint8Array(
  readFileSync(new URL('../../fixtures/arquivos/balancete-dominio.xlsx', import.meta.url)),
);
const arquivo = { bytes: BALANCETE, nomeArquivo: 'balancete-dominio.xlsx' };

describe('ações da implantação', () => {
  let banco: PgliteDatabase<typeof schema>;
  let fechar: () => Promise<void>;
  let usuarioId: number;

  beforeEach(async () => {
    ({ banco, fechar } = await criarBancoTeste());
    await semear(banco);
    const [u] = await banco
      .insert(schema.usuario)
      .values({ oidEntra: 'o1', email: 'a@x.com', nome: 'Ana' })
      .returning({ id: schema.usuario.id });
    usuarioId = u.id;
  });
  afterEach(async () => {
    await fechar();
  });

  const comDados = async (id: number): Promise<void> =>
    salvarDadosEmpresa(banco, id, usuarioId, {
      empresaCnpj: '12345678000190',
      empresaCodigoDominio: '1',
      dataSaldo: '2026-08-31',
      tipoLote: 'V',
      codigoHistorico: '700',
      incluirCabecalho: false,
    });

  it('iniciar uma nova mantém as anteriores em andamento (várias por pessoa)', async () => {
    const id1 = await iniciarImplantacao(banco, usuarioId);
    const id2 = await iniciarImplantacao(banco, usuarioId);
    expect(id2).not.toBe(id1);
    const linhas = await banco.select().from(schema.implantacao);
    expect(linhas).toHaveLength(2);
    const porId = new Map(linhas.map((l) => [l.id, l.status]));
    expect(porId.get(id1)).toBe('em_andamento');
    expect(porId.get(id2)).toBe('em_andamento');
  });

  it('anexar balancete grava linhas resolvidas e o painel', async () => {
    const id = await iniciarImplantacao(banco, usuarioId);
    await comDados(id);
    const { painel } = await anexarBalancete(banco, id, usuarioId, arquivo);
    expect(painel.analiticas).toBe(27);

    const linhas = await banco
      .select()
      .from(schema.implantacaoLinha)
      .where(eq(schema.implantacaoLinha.implantacaoId, id));
    expect(linhas).toHaveLength(27);
    expect(linhas.every((l) => l.statusTexto !== null && l.statusTexto !== '')).toBe(true);

    const [imp] = await banco.select().from(schema.implantacao).where(eq(schema.implantacao.id, id));
    expect(imp.qtdAnaliticas).toBe(27);
  });

  it('ajuste manual vence e muda o status da linha', async () => {
    const id = await iniciarImplantacao(banco, usuarioId);
    await comDados(id);
    await anexarBalancete(banco, id, usuarioId, arquivo);
    await definirAjusteManual(banco, id, usuarioId, '032630-5', '485');
    const { linhas } = await recalcular(banco, id, usuarioId);
    const linha = linhas.find((l) => l.codiCta === '032630-5');
    expect(linha?.codigo).toBe('485');
    expect(linha?.status).toBe('Manual (coluna L)');
  });

  it('conta criada passa a valer para o ajuste manual da mesma implantação', async () => {
    const id = await iniciarImplantacao(banco, usuarioId);
    await comDados(id);
    await anexarBalancete(banco, id, usuarioId, arquivo);
    await registrarContaCriada(banco, id, usuarioId, {
      codigoReduzido: '9001',
      descricao: 'Conta Nova de Teste',
      classificacao: '4.1',
    });
    await definirAjusteManual(banco, id, usuarioId, '032630-5', '9001');
    const { linhas } = await recalcular(banco, id, usuarioId);
    const linha = linhas.find((l) => l.codiCta === '032630-5');
    expect(linha?.codigo).toBe('9001');
    expect(linha?.origem).toBe('manual');
  });

  it('conta criada não vale para outra implantação', async () => {
    const idA = await iniciarImplantacao(banco, usuarioId);
    await registrarContaCriada(banco, idA, usuarioId, {
      codigoReduzido: '9001',
      descricao: 'Conta Nova de Teste',
      classificacao: '4.1',
    });

    const [u2] = await banco
      .insert(schema.usuario)
      .values({ oidEntra: 'o2', email: 'b@x.com', nome: 'Bia' })
      .returning({ id: schema.usuario.id });
    const idB = await iniciarImplantacao(banco, u2.id);
    await salvarDadosEmpresa(banco, idB, u2.id, { empresaCnpj: '1', empresaCodigoDominio: '1' });
    await anexarBalancete(banco, idB, u2.id, arquivo);
    await definirAjusteManual(banco, idB, u2.id, '032630-5', '9001');
    const { linhas } = await recalcular(banco, idB, u2.id);
    const linha = linhas.find((l) => l.codiCta === '032630-5');
    expect(linha?.codigo).toBeNull();
    expect(linha?.origem).toBe('nao_encontrado');
  });

  it('recalcular com CNPJ e empresa vazios deixa o painel fora de PRONTO', async () => {
    const id = await iniciarImplantacao(banco, usuarioId);
    // sem salvar dados da empresa (CNPJ/empresa vazios)
    await anexarBalancete(banco, id, usuarioId, arquivo);
    // resolve as duas pendências de coluna L, para isolar o efeito do CNPJ/empresa vazios
    await definirAjusteManual(banco, id, usuarioId, '032630-5', '485');
    await definirAjusteManual(banco, id, usuarioId, '002171-7', '485');
    const { painel } = await recalcular(banco, id, usuarioId);
    expect(painel.pendentes).toBe(0);
    expect(painel.pronto).toBe(false);
  });

  it('arquivo de layout desconhecido devolve erro pedindo mapeamento manual', async () => {
    const id = await iniciarImplantacao(banco, usuarioId);
    const lixo = { bytes: new TextEncoder().encode('a;b;c\n1;2;3\n'), nomeArquivo: 'qualquer.csv' };
    await expect(anexarBalancete(banco, id, usuarioId, lixo)).rejects.toThrow(/manual|reconhecido/i);
  });

  it('reconhece colunas mas sem a do NOME pede mapeamento manual (não finge reconhecer)', async () => {
    // Cabeçalho casa código/classif/tipo/saldos (o header do nome é "Conta", que o perfil usa como
    // código), então a coluna do NOME não casa e todo nome viria vazio. Deve cair no manual.
    const csv =
      'Conta;Código;Classificação;Tipo;Saldo anterior;Débito;Crédito;Saldo atual\n' +
      'BANCO INTER;536;1.1.1.02.000003;A;0;0;0;1,00\n' +
      'CLIENTES;540;1.1.2.01.000001;A;0;0;0;2,00\n';
    const id = await iniciarImplantacao(banco, usuarioId);
    const semNome = { bytes: new TextEncoder().encode(csv), nomeArquivo: 'dominio-sem-nome.csv' };
    await expect(anexarBalancete(banco, id, usuarioId, semNome)).rejects.toThrow(/NOME|manual/i);

    // Com o mapeamento manual apontando a coluna do nome, grava com o nome preenchido.
    const r = await anexarBalancete(banco, id, usuarioId, semNome, {
      linhaCabecalho: 1,
      colunas: { nomeCta: 0, codiCta: 1, clasCta: 2, tipoCta: 3, saldoAnterior: 4, totalDebito: 5, totalCredito: 6, saldoAtual: 7 },
    });
    expect(r.painel.analiticas).toBe(2);
    const linhas = await banco
      .select()
      .from(schema.implantacaoLinha)
      .where(eq(schema.implantacaoLinha.implantacaoId, id));
    expect(linhas.map((l) => l.nomeCta).sort()).toEqual(['BANCO INTER', 'CLIENTES']);
  });

  it('cada ação grava auditoria com usuário e implantação', async () => {
    const id = await iniciarImplantacao(banco, usuarioId);
    await comDados(id);
    await anexarBalancete(banco, id, usuarioId, arquivo);

    const registros = await banco
      .select()
      .from(schema.auditoria)
      .where(eq(schema.auditoria.entidadeId, String(id)));
    const acoes = registros.map((r) => r.acao);
    expect(acoes).toContain('iniciar_implantacao');
    expect(acoes).toContain('salvar_dados_empresa');
    expect(acoes).toContain('anexar_balancete');
    expect(acoes).toContain('recalcular');
    expect(registros.every((r) => r.usuarioId === usuarioId)).toBe(true);
  });
});
