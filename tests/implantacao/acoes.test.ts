import { readFileSync } from 'node:fs';
import { eq } from 'drizzle-orm';
import type { PgliteDatabase } from 'drizzle-orm/pglite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { semear } from '../../scripts/semear.js';
import {
  anexarBalancete,
  definirAjusteManual,
  excluirImplantacao,
  guardarImplantacao,
  iniciarImplantacao,
  minhasImplantacoesAbertas,
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

  // As linhas resolvidas são gravadas em UMA consulta (jsonb_to_recordset), e não uma por uma: este
  // teste confere que cada coluna chega inteira, inclusive `grupos_permitidos`, que é um text[] e
  // atravessa o JSON como lista.
  it('a gravação em lote preenche todas as colunas resolvidas, inclusive o array de grupos', async () => {
    const id = await iniciarImplantacao(banco, usuarioId);
    await comDados(id);
    await anexarBalancete(banco, id, usuarioId, arquivo);

    const linhas = await banco
      .select()
      .from(schema.implantacaoLinha)
      .where(eq(schema.implantacaoLinha.implantacaoId, id));

    expect(linhas.every((l) => l.nomeNormalizado !== null && l.nomeNormalizado !== '')).toBe(true);
    expect(linhas.every((l) => l.origemResolucao !== null)).toBe(true);
    expect(linhas.some((l) => l.codigoResolvido !== null)).toBe(true);

    // Array: tem de voltar como lista de verdade, não como texto "{A,B}" nem nulo.
    const comGrupos = linhas.filter((l) => l.natureza !== null && l.natureza !== '');
    expect(comGrupos.length).toBeGreaterThan(0);
    for (const l of comGrupos) {
      expect(Array.isArray(l.gruposPermitidos)).toBe(true);
    }
    const algum = comGrupos.find((l) => (l.gruposPermitidos ?? []).length > 0);
    expect(algum).toBeDefined();
    expect(algum!.gruposPermitidos!.every((g) => typeof g === 'string' && g !== '')).toBe(true);
  });

  // Um UPDATE por linha custaria uma ida e volta ao banco por conta; em produção (banco remoto) isso
  // é a diferença entre instantâneo e dezenas de segundos. Aqui a garantia é de comportamento: um
  // balancete grande recalcula inteiro e com os mesmos números.
  it('recalcular grava um balancete grande de uma vez', async () => {
    // Cabeçalho canônico do Domínio: "Conta" e "Código" são os DOIS apelidos da coluna de código
    // (ver perfis.ts), então um cabeçalho com os dois deixa a coluna do nome sem casar.
    const cabecalho = 'codi_cta;nome_cta;clas_cta;tipo_cta;saldoant;totdeb;totcre;saldoatu\n';
    const corpo = Array.from(
      { length: 400 },
      (_, i) => `${1000 + i};CONTA DE TESTE ${i};1.1.1.02.${i};A;0;0;0;-1,00\n`,
    ).join('');
    const grande = {
      bytes: new TextEncoder().encode(cabecalho + corpo),
      nomeArquivo: 'grande.csv',
    };

    const id = await iniciarImplantacao(banco, usuarioId);
    await comDados(id);
    const anexo = await anexarBalancete(banco, id, usuarioId, grande);
    expect(anexo.painel.analiticas).toBe(400);

    const gravadas = await banco
      .select()
      .from(schema.implantacaoLinha)
      .where(eq(schema.implantacaoLinha.implantacaoId, id));
    expect(gravadas).toHaveLength(400);
    expect(gravadas.every((l) => l.statusTexto !== null && l.statusTexto !== '')).toBe(true);

    // Recalcular de novo não deve mudar nada nem perder linha.
    const denovo = await recalcular(banco, id, usuarioId);
    expect(denovo.painel.analiticas).toBe(400);
    expect(denovo.linhas).toHaveLength(400);
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

  describe('salvar para depois e excluir', () => {
    it('implantação nova nasce não guardada', async () => {
      const id = await iniciarImplantacao(banco, usuarioId);
      const [aberta] = await minhasImplantacoesAbertas(banco, usuarioId);
      expect(aberta.id).toBe(id);
      expect(aberta.guardadaEm).toBeNull();
    });

    it('guardar marca a data, e guardar de novo atualiza', async () => {
      const id = await iniciarImplantacao(banco, usuarioId);
      expect(await guardarImplantacao(banco, id, usuarioId)).toEqual({ ok: true });

      const [primeira] = await minhasImplantacoesAbertas(banco, usuarioId);
      expect(primeira.guardadaEm).toBeInstanceOf(Date);

      expect(await guardarImplantacao(banco, id, usuarioId)).toEqual({ ok: true });
      const [segunda] = await minhasImplantacoesAbertas(banco, usuarioId);
      expect(segunda.guardadaEm!.getTime()).toBeGreaterThanOrEqual(primeira.guardadaEm!.getTime());
    });

    // O trabalho feito não é apagado: a implantação sai da mesa, mas as linhas e a auditoria ficam,
    // para ainda se saber depois o que foi feito e por quem.
    it('excluir tira da mesa e preserva as linhas e o histórico', async () => {
      const id = await iniciarImplantacao(banco, usuarioId);
      await comDados(id);
      await anexarBalancete(banco, id, usuarioId, arquivo);

      expect(await excluirImplantacao(banco, id, usuarioId)).toEqual({ ok: true });
      expect(await minhasImplantacoesAbertas(banco, usuarioId)).toHaveLength(0);

      const [imp] = await banco
        .select()
        .from(schema.implantacao)
        .where(eq(schema.implantacao.id, id));
      expect(imp.status).toBe('descartada');

      const linhas = await banco
        .select()
        .from(schema.implantacaoLinha)
        .where(eq(schema.implantacaoLinha.implantacaoId, id));
      expect(linhas.length).toBeGreaterThan(0);
    });

    it('guardar e excluir gravam auditoria', async () => {
      const guardadaId = await iniciarImplantacao(banco, usuarioId);
      const excluidaId = await iniciarImplantacao(banco, usuarioId);
      await guardarImplantacao(banco, guardadaId, usuarioId);
      await excluirImplantacao(banco, excluidaId, usuarioId);

      const registros = await banco.select().from(schema.auditoria);
      const acoes = registros.map((r) => r.acao);
      expect(acoes).toContain('guardar_implantacao');
      expect(acoes).toContain('excluir_implantacao');
    });

    // A mensagem é DEVOLVIDA, não lançada: exceção de dentro de uma Server Action é censurada em
    // produção e a tela mostraria só o aviso genérico de erro de servidor.
    it('implantação de outra pessoa não pode ser guardada nem excluída', async () => {
      const [outra] = await banco
        .insert(schema.usuario)
        .values({ oidEntra: 'o2', email: 'b@x.com', nome: 'Bruno' })
        .returning({ id: schema.usuario.id });
      const id = await iniciarImplantacao(banco, usuarioId);

      expect(await guardarImplantacao(banco, id, outra.id)).toEqual({
        ok: false,
        erro: 'Esta implantação é de outra pessoa.',
      });
      expect(await excluirImplantacao(banco, id, outra.id)).toEqual({
        ok: false,
        erro: 'Esta implantação é de outra pessoa.',
      });

      const [imp] = await banco
        .select()
        .from(schema.implantacao)
        .where(eq(schema.implantacao.id, id));
      expect(imp.status).toBe('em_andamento');
      expect(imp.guardadaEm).toBeNull();
    });

    it('implantação que não está em andamento não pode ser guardada nem excluída', async () => {
      const id = await iniciarImplantacao(banco, usuarioId);
      await banco
        .update(schema.implantacao)
        .set({ status: 'concluida' })
        .where(eq(schema.implantacao.id, id));

      for (const r of [
        await guardarImplantacao(banco, id, usuarioId),
        await excluirImplantacao(banco, id, usuarioId),
      ]) {
        expect(r.ok).toBe(false);
        expect(r).toHaveProperty('erro', 'Esta implantação já foi concluída ou excluída.');
      }
    });

    it('implantação inexistente devolve erro em vez de lançar', async () => {
      expect(await guardarImplantacao(banco, 99999, usuarioId)).toEqual({
        ok: false,
        erro: 'Implantação não encontrada.',
      });
      expect(await excluirImplantacao(banco, 99999, usuarioId)).toEqual({
        ok: false,
        erro: 'Implantação não encontrada.',
      });
    });
  });
});
