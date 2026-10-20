import { eq } from 'drizzle-orm';
import type { PgliteDatabase } from 'drizzle-orm/pglite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { semear } from '../../scripts/semear.js';
import { carregarRegras } from '../../src/dados/regras.js';
import {
  decidirAlteracao,
  desfazer,
  ensinarSinonimo,
  solicitarAlteracao,
} from '../../src/dados/sinonimos.js';
import { normalizarNome } from '../../src/motor/normalizar.js';
import * as schema from '../../src/dados/schema.js';
import { criarBancoTeste } from '../apoio/banco.js';

describe('sinônimos: ensinar, revisar, desfazer', () => {
  let banco: PgliteDatabase<typeof schema>;
  let fechar: () => Promise<void>;
  let usuarioId: number;
  let revisorId: number;

  beforeEach(async () => {
    ({ banco, fechar } = await criarBancoTeste());
    await semear(banco);
    const [u] = await banco
      .insert(schema.usuario)
      .values({ oidEntra: 'u1', email: 'u@x', nome: 'U', papel: 'usuario' })
      .returning({ id: schema.usuario.id });
    const [r] = await banco
      .insert(schema.usuario)
      .values({ oidEntra: 'r1', email: 'r@x', nome: 'R', papel: 'revisor' })
      .returning({ id: schema.usuario.id });
    usuarioId = u.id;
    revisorId = r.id;
  });
  afterEach(async () => {
    await fechar();
  });

  const ensinar = (nome: string, codigo: string, uid = usuarioId, motivo = 'teste') =>
    ensinarSinonimo(banco, { nomeOriginal: nome, codigo, motivo, usuarioId: uid });

  it('ensinar cria o sinônimo e um evento de criação', async () => {
    const r = await ensinar('CONTA DE TESTE ABCXYZ', '485');
    expect(r.ok).toBe(true);
    const sins = await banco
      .select()
      .from(schema.sinonimo)
      .where(eq(schema.sinonimo.codigoReduzido, '485'));
    expect(sins.some((s) => s.nomeOriginal === 'CONTA DE TESTE ABCXYZ')).toBe(true);
    const eventos = await banco.select().from(schema.sinonimoEvento);
    expect(eventos.some((e) => e.tipo === 'criado')).toBe(true);
  });

  it('ensinar sem motivo é recusado', async () => {
    const r = await ensinarSinonimo(banco, {
      nomeOriginal: 'X',
      codigo: '485',
      motivo: '   ',
      usuarioId,
    });
    expect(r.ok).toBe(false);
  });

  it('ensinar código fora do plano vigente marca fora_do_padrao e devolve aviso', async () => {
    // segunda versão (não vigente) com um código que não está na vigente
    const [v2] = await banco
      .insert(schema.planoVersao)
      .values({ nome: 'antiga', vigente: false })
      .returning({ id: schema.planoVersao.id });
    await banco.insert(schema.planoConta).values({
      planoVersaoId: v2.id,
      codigoReduzido: '888888',
      classificacao: '9',
      descricao: 'Antiga',
      tipo: 'A',
      descricaoNormalizada: 'ANTIGA',
    });
    const r = await ensinar('CONTA FORA DO PADRAO ZZZ', '888888');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.aviso).toBeDefined();
    const [s] = await banco
      .select()
      .from(schema.sinonimo)
      .where(eq(schema.sinonimo.codigoReduzido, '888888'));
    expect(s.foraDoPadrao).toBe(true);
  });

  it('ensinar código que não existe em lugar nenhum é recusado', async () => {
    const r = await ensinar('CONTA INEXISTENTE WWW', '7777777');
    expect(r.ok).toBe(false);
  });

  it('chave normalizada é calculada com as regras vigentes, não com o texto digitado', async () => {
    await ensinar('Citi Bank Teste Único', '485');
    const regras = await carregarRegras(banco);
    const esperada = normalizarNome('Citi Bank Teste Único', regras.normalizacao);
    const [s] = await banco
      .select()
      .from(schema.sinonimo)
      .where(eq(schema.sinonimo.nomeOriginal, 'Citi Bank Teste Único'));
    expect(s.chaveNormalizada).toBe(esperada);
    expect(s.chaveNormalizada).not.toBe('Citi Bank Teste Único');
  });

  it('alterar sinônimo existente cria pedido pendente e não altera direto', async () => {
    const criado = await ensinar('CONTA PARA ALTERAR QQQ', '485');
    const sinId = criado.ok ? criado.sinonimoId : 0;
    const r = await solicitarAlteracao(banco, {
      sinonimoId: sinId,
      codigoProposto: '18',
      motivo: 'corrigir',
      usuarioId,
    });
    expect(r.ok).toBe(true);
    const [s] = await banco.select().from(schema.sinonimo).where(eq(schema.sinonimo.id, sinId));
    expect(s.codigoReduzido).toBe('485'); // não mudou
    const pedidos = await banco
      .select()
      .from(schema.alteracaoSinonimo)
      .where(eq(schema.alteracaoSinonimo.sinonimoId, sinId));
    expect(pedidos).toHaveLength(1);
    expect(pedidos[0].status).toBe('pendente');
  });

  it('usuário comum não decide pedido; revisor decide; aprovar aplica e registra evento', async () => {
    const criado = await ensinar('CONTA DECIDIR RRR', '485');
    const sinId = criado.ok ? criado.sinonimoId : 0;
    const ped = await solicitarAlteracao(banco, { sinonimoId: sinId, codigoProposto: '18', motivo: 'x', usuarioId });
    const alteracaoId = ped.ok ? ped.alteracaoId : 0;

    const comum = await decidirAlteracao(banco, alteracaoId, true, '', usuarioId);
    expect(comum.ok).toBe(false);

    const rev = await decidirAlteracao(banco, alteracaoId, true, 'ok', revisorId);
    expect(rev.ok).toBe(true);
    const [s] = await banco.select().from(schema.sinonimo).where(eq(schema.sinonimo.id, sinId));
    expect(s.codigoReduzido).toBe('18');
    const eventos = await banco
      .select()
      .from(schema.sinonimoEvento)
      .where(eq(schema.sinonimoEvento.sinonimoId, sinId));
    expect(eventos.some((e) => e.tipo === 'alterado')).toBe(true);
  });

  it('desfazer volta ao código anterior e registra evento', async () => {
    const criado = await ensinar('CONTA DESFAZER TTT', '485');
    const sinId = criado.ok ? criado.sinonimoId : 0;
    const ped = await solicitarAlteracao(banco, { sinonimoId: sinId, codigoProposto: '18', motivo: 'x', usuarioId });
    await decidirAlteracao(banco, ped.ok ? ped.alteracaoId : 0, true, '', revisorId);
    const [evAlterado] = await banco
      .select()
      .from(schema.sinonimoEvento)
      .where(eq(schema.sinonimoEvento.tipo, 'alterado'));

    const r = await desfazer(banco, Number(evAlterado.id), usuarioId);
    expect(r.ok).toBe(true);
    const [s] = await banco.select().from(schema.sinonimo).where(eq(schema.sinonimo.id, sinId));
    expect(s.codigoReduzido).toBe('485');
    const desfeitos = await banco
      .select()
      .from(schema.sinonimoEvento)
      .where(eq(schema.sinonimoEvento.tipo, 'desfeito'));
    expect(desfeitos.length).toBeGreaterThan(0);
  });

  it('salvar sobre versão desatualizada recebe aviso, não sobrescreve', async () => {
    const criado = await ensinar('CONTA CONCORRENTE UUU', '485');
    const sinId = criado.ok ? criado.sinonimoId : 0;
    const [ultimo] = await banco
      .select({ id: schema.sinonimoEvento.id })
      .from(schema.sinonimoEvento)
      .where(eq(schema.sinonimoEvento.sinonimoId, sinId));
    const eventoConhecido = Number(ultimo.id);
    // outra pessoa altera no meio-tempo (novo evento)
    await banco
      .insert(schema.sinonimoEvento)
      .values({ sinonimoId: sinId, tipo: 'alterado', codigoDe: '485', codigoPara: '18', autorId: revisorId });
    const r = await solicitarAlteracao(banco, {
      sinonimoId: sinId,
      codigoProposto: '62',
      motivo: 'x',
      usuarioId,
      eventoConhecido,
    });
    expect(r.ok).toBe(false);
  });

  it('duas pessoas ensinando a mesma chave ao mesmo tempo: a segunda recebe mensagem', async () => {
    const [a, b] = await Promise.allSettled([
      ensinar('NOME IGUAL CONCORRENTE', '18', usuarioId),
      ensinar('NOME IGUAL CONCORRENTE', '485', revisorId),
    ]);
    const resultados = [a, b].map((x) => (x.status === 'fulfilled' ? x.value : { ok: false, erro: 'rejeitou' }));
    expect(resultados.filter((r) => r.ok)).toHaveLength(1);
    const falha = resultados.find((r) => !r.ok) as { ok: false; erro: string };
    expect(falha.erro).toMatch(/Já existe sinônimo/);
  });
});
