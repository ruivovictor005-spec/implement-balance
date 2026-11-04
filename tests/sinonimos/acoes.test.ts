import { eq } from 'drizzle-orm';
import type { PgliteDatabase } from 'drizzle-orm/pglite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { semear } from '../../scripts/semear.js';
import { carregarRegras } from '../../src/dados/regras.js';
import {
  carregarSinonimos,
  decidirAlteracao,
  decidirSinonimo,
  desfazer,
  ensinarSinonimo,
  listarMinhasPropostas,
  listarPropostasPendentes,
  solicitarAlteracao,
} from '../../src/dados/sinonimos.js';
import { normalizarNome } from '../../src/motor/normalizar.js';
import * as schema from '../../src/dados/schema.js';
import { criarBancoTeste } from '../apoio/banco.js';

describe('sinônimos: propor, aprovar, alterar, desfazer', () => {
  let banco: PgliteDatabase<typeof schema>;
  let fechar: () => Promise<void>;
  let usuarioId: number;
  let revisorId: number;
  let adminId: number;

  beforeEach(async () => {
    ({ banco, fechar } = await criarBancoTeste());
    await semear(banco);
    const [u, r, a] = await banco
      .insert(schema.usuario)
      .values([
        { oidEntra: 'u1', email: 'u@x', nome: 'U', papel: 'usuario' },
        { oidEntra: 'r1', email: 'r@x', nome: 'R', papel: 'revisor' },
        { oidEntra: 'a1', email: 'a@x', nome: 'Admin', papel: 'admin' },
      ])
      .returning({ id: schema.usuario.id });
    usuarioId = u.id;
    revisorId = r.id;
    adminId = a.id;
  });
  afterEach(async () => {
    await fechar();
  });

  const ensinar = (nome: string, codigo: string, uid = usuarioId, motivo = 'teste') =>
    ensinarSinonimo(banco, { nomeOriginal: nome, codigo, motivo, usuarioId: uid });

  const chave = async (nome: string) => normalizarNome(nome, (await carregarRegras(banco)).normalizacao);

  const sinonimo = async (id: number) =>
    (await banco.select().from(schema.sinonimo).where(eq(schema.sinonimo.id, id)))[0];

  /** Proposta de usuário comum já aprovada pelo administrador. */
  const ativo = async (nome: string, codigo: string) => {
    const r = await ensinar(nome, codigo);
    const id = r.ok ? r.sinonimoId : 0;
    expect((await decidirSinonimo(banco, id, true, '', adminId)).ok).toBe(true);
    return id;
  };

  describe('proposta e aprovação', () => {
    it('usuário comum propõe: fica pendente e não vale para ninguém', async () => {
      const r = await ensinar('CONTA DE TESTE ABCXYZ', '485');
      expect(r.ok && r.pendente).toBe(true);
      const id = r.ok ? r.sinonimoId : 0;
      const s = await sinonimo(id);
      expect([s.status, s.propostoPor]).toEqual(['pendente', usuarioId]);
      expect((await carregarSinonimos(banco)).has(await chave('CONTA DE TESTE ABCXYZ'))).toBe(false);
      const eventos = await banco.select().from(schema.sinonimoEvento).where(eq(schema.sinonimoEvento.sinonimoId, id));
      expect(eventos.map((e) => e.tipo)).toEqual(['proposto']);
    });

    it('aprovada pelo administrador, passa a valer — o "criado" leva quem propôs', async () => {
      const id = await ativo('CONTA APROVADA AAA', '485');
      expect((await sinonimo(id)).status).toBe('ativo');
      expect((await carregarSinonimos(banco)).get(await chave('CONTA APROVADA AAA'))).toBe('485');
      const eventos = await banco.select().from(schema.sinonimoEvento).where(eq(schema.sinonimoEvento.sinonimoId, id));
      expect(eventos.find((e) => e.tipo === 'criado')?.autorId).toBe(usuarioId);
      expect(eventos.find((e) => e.tipo === 'aprovado')?.autorId).toBe(adminId);
    });

    it('rejeitada, nunca vale e guarda a observação', async () => {
      const r = await ensinar('CONTA RUIM BBB', '485');
      const id = r.ok ? r.sinonimoId : 0;
      expect(await decidirSinonimo(banco, id, false, 'não é despesa', adminId)).toEqual({ ok: true });
      const s = await sinonimo(id);
      expect([s.status, s.observacaoDecisao]).toEqual(['rejeitado', 'não é despesa']);
      expect((await carregarSinonimos(banco)).has(await chave('CONTA RUIM BBB'))).toBe(false);
      expect((await decidirSinonimo(banco, id, true, '', adminId)).ok).toBe(false); // já decidida
    });

    it('só o administrador decide uma proposta', async () => {
      const r = await ensinar('CONTA SEM PODER CCC', '485');
      const id = r.ok ? r.sinonimoId : 0;
      expect((await decidirSinonimo(banco, id, true, '', usuarioId)).ok).toBe(false);
      expect((await decidirSinonimo(banco, id, true, '', revisorId)).ok).toBe(false);
      expect((await sinonimo(id)).status).toBe('pendente');
    });

    it('o administrador ensina e já vale', async () => {
      const r = await ensinar('CONTA DO ADMIN DDD', '485', adminId);
      expect(r.ok && !r.pendente).toBe(true);
      expect((await carregarSinonimos(banco)).get(await chave('CONTA DO ADMIN DDD'))).toBe('485');
    });

    it('não propõe duas vezes o mesmo nome nem por cima de um que já vale', async () => {
      await ensinar('CONTA REPETIDA EEE', '485');
      expect((await ensinar('CONTA REPETIDA EEE', '18')).ok).toBe(false);
      await ativo('CONTA VALENDO FFF', '485');
      const r = await ensinar('CONTA VALENDO FFF', '18', revisorId);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.erro).toMatch(/peça uma alteração/);
    });

    it('duas propostas para o mesmo nome: aprovar a segunda substitui a primeira', async () => {
      const a = await ensinar('CONTA DISPUTADA GGG', '485', usuarioId);
      const b = await ensinar('CONTA DISPUTADA GGG', '18', revisorId);
      const idA = a.ok ? a.sinonimoId : 0;
      const idB = b.ok ? b.sinonimoId : 0;
      await decidirSinonimo(banco, idA, true, '', adminId);
      await decidirSinonimo(banco, idB, true, 'este é o certo', adminId);
      expect((await sinonimo(idA)).status).toBe('arquivado');
      expect((await carregarSinonimos(banco)).get(await chave('CONTA DISPUTADA GGG'))).toBe('18');
    });

    it('fila do administrador e "minhas propostas"', async () => {
      await ensinar('CONTA NA FILA HHH', '485');
      const fila = await listarPropostasPendentes(banco);
      expect(fila.map((p) => [p.nomeOriginal, p.propostoPor, p.codigoAtivo])).toEqual([
        ['CONTA NA FILA HHH', 'U', null],
      ]);
      await decidirSinonimo(banco, fila[0].id, false, 'errado', adminId);
      expect(await listarPropostasPendentes(banco)).toEqual([]);
      const minhas = await listarMinhasPropostas(banco, usuarioId);
      expect(minhas.map((m) => [m.status, m.observacaoDecisao])).toEqual([['rejeitado', 'errado']]);
      expect(await listarMinhasPropostas(banco, revisorId)).toEqual([]);
    });
  });

  it('ensinar sem motivo é recusado', async () => {
    const r = await ensinarSinonimo(banco, { nomeOriginal: 'X', codigo: '485', motivo: '   ', usuarioId });
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
    const [s] = await banco.select().from(schema.sinonimo).where(eq(schema.sinonimo.codigoReduzido, '888888'));
    expect(s.foraDoPadrao).toBe(true);
  });

  it('ensinar código que não existe em lugar nenhum é recusado', async () => {
    expect((await ensinar('CONTA INEXISTENTE WWW', '7777777')).ok).toBe(false);
  });

  it('chave normalizada é calculada com as regras vigentes, não com o texto digitado', async () => {
    await ensinar('Citi Bank Teste Único', '485');
    const [s] = await banco
      .select()
      .from(schema.sinonimo)
      .where(eq(schema.sinonimo.nomeOriginal, 'Citi Bank Teste Único'));
    expect(s.chaveNormalizada).toBe(await chave('Citi Bank Teste Único'));
    expect(s.chaveNormalizada).not.toBe('Citi Bank Teste Único');
  });

  it('alterar sinônimo existente cria pedido pendente e não altera direto', async () => {
    const sinId = await ativo('CONTA PARA ALTERAR QQQ', '485');
    const r = await solicitarAlteracao(banco, { sinonimoId: sinId, codigoProposto: '18', motivo: 'corrigir', usuarioId });
    expect(r.ok).toBe(true);
    expect((await sinonimo(sinId)).codigoReduzido).toBe('485'); // não mudou
    const pedidos = await banco
      .select()
      .from(schema.alteracaoSinonimo)
      .where(eq(schema.alteracaoSinonimo.sinonimoId, sinId));
    expect(pedidos.map((p) => p.status)).toEqual(['pendente']);
  });

  it('só o administrador decide alteração; aprovar aplica e registra evento', async () => {
    const sinId = await ativo('CONTA DECIDIR RRR', '485');
    const ped = await solicitarAlteracao(banco, { sinonimoId: sinId, codigoProposto: '18', motivo: 'x', usuarioId });
    const alteracaoId = ped.ok ? ped.alteracaoId : 0;

    expect((await decidirAlteracao(banco, alteracaoId, true, '', usuarioId)).ok).toBe(false);
    expect((await decidirAlteracao(banco, alteracaoId, true, '', revisorId)).ok).toBe(false);
    expect((await decidirAlteracao(banco, alteracaoId, true, 'ok', adminId)).ok).toBe(true);
    expect((await sinonimo(sinId)).codigoReduzido).toBe('18');
    const eventos = await banco.select().from(schema.sinonimoEvento).where(eq(schema.sinonimoEvento.sinonimoId, sinId));
    expect(eventos.some((e) => e.tipo === 'alterado')).toBe(true);
  });

  it('desfazer volta ao código anterior, registra evento e é só do administrador', async () => {
    const sinId = await ativo('CONTA DESFAZER TTT', '485');
    const ped = await solicitarAlteracao(banco, { sinonimoId: sinId, codigoProposto: '18', motivo: 'x', usuarioId });
    await decidirAlteracao(banco, ped.ok ? ped.alteracaoId : 0, true, '', adminId);
    const [evAlterado] = await banco
      .select()
      .from(schema.sinonimoEvento)
      .where(eq(schema.sinonimoEvento.tipo, 'alterado'));

    expect((await desfazer(banco, Number(evAlterado.id), usuarioId)).ok).toBe(false);
    expect((await desfazer(banco, Number(evAlterado.id), adminId)).ok).toBe(true);
    expect((await sinonimo(sinId)).codigoReduzido).toBe('485');
    const desfeitos = await banco
      .select()
      .from(schema.sinonimoEvento)
      .where(eq(schema.sinonimoEvento.tipo, 'desfeito'));
    expect(desfeitos.length).toBeGreaterThan(0);
  });

  it('salvar sobre versão desatualizada recebe aviso, não sobrescreve', async () => {
    const sinId = await ativo('CONTA CONCORRENTE UUU', '485');
    const eventos = await banco
      .select({ id: schema.sinonimoEvento.id })
      .from(schema.sinonimoEvento)
      .where(eq(schema.sinonimoEvento.sinonimoId, sinId));
    const eventoConhecido = Math.max(...eventos.map((e) => Number(e.id)));
    // outra pessoa altera no meio-tempo (novo evento)
    await banco
      .insert(schema.sinonimoEvento)
      .values({ sinonimoId: sinId, tipo: 'alterado', codigoDe: '485', codigoPara: '18', autorId: adminId });
    const r = await solicitarAlteracao(banco, {
      sinonimoId: sinId,
      codigoProposto: '62',
      motivo: 'x',
      usuarioId,
      eventoConhecido,
    });
    expect(r.ok).toBe(false);
  });

  it('dois administradores ensinando a mesma chave ao mesmo tempo: o segundo recebe mensagem', async () => {
    const [outro] = await banco
      .insert(schema.usuario)
      .values({ oidEntra: 'a2', email: 'a2@x', nome: 'Admin 2', papel: 'admin' })
      .returning({ id: schema.usuario.id });
    const [a, b] = await Promise.allSettled([
      ensinar('NOME IGUAL CONCORRENTE', '18', adminId),
      ensinar('NOME IGUAL CONCORRENTE', '485', outro.id),
    ]);
    const resultados = [a, b].map((x) => (x.status === 'fulfilled' ? x.value : { ok: false, erro: 'rejeitou' }));
    expect(resultados.filter((r) => r.ok)).toHaveLength(1);
    const falha = resultados.find((r) => !r.ok) as { ok: false; erro: string };
    expect(falha.erro).toMatch(/Já existe sinônimo/);
  });
});
