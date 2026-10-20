import { readFileSync } from 'node:fs';
import { and, eq } from 'drizzle-orm';
import type { PgliteDatabase } from 'drizzle-orm/pglite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { semear } from '../../scripts/semear.js';
import { reaplicarSinonimos } from '../../src/app/implantacao/reaplicar.js';
import {
  anexarBalancete,
  definirAjusteManual,
  iniciarImplantacao,
} from '../../src/dados/implantacoes.js';
import { ensinarSinonimo } from '../../src/dados/sinonimos.js';
import * as schema from '../../src/dados/schema.js';
import { criarBancoTeste } from '../apoio/banco.js';

const BALANCETE = new Uint8Array(
  readFileSync(new URL('../../fixtures/arquivos/balancete-dominio.xlsx', import.meta.url)),
);

describe('reaplicação de sinônimos nas pendências', () => {
  let banco: PgliteDatabase<typeof schema>;
  let fechar: () => Promise<void>;
  let usuarioId: number;
  let id: number;

  const linha = async (codiCta: string) => {
    const [l] = await banco
      .select()
      .from(schema.implantacaoLinha)
      .where(and(eq(schema.implantacaoLinha.implantacaoId, id), eq(schema.implantacaoLinha.codiCta, codiCta)));
    return l;
  };

  beforeEach(async () => {
    ({ banco, fechar } = await criarBancoTeste());
    await semear(banco);
    const [u] = await banco
      .insert(schema.usuario)
      .values({ oidEntra: 'u1', email: 'u@x', nome: 'Karen' })
      .returning({ id: schema.usuario.id });
    usuarioId = u.id;
    id = await iniciarImplantacao(banco, usuarioId);
    await anexarBalancete(banco, id, usuarioId, { bytes: BALANCETE, nomeArquivo: 'b.xlsx' });
  });
  afterEach(async () => {
    await fechar();
  });

  it('pendência vira resolvida quando alguém ensina o sinônimo, e devolve contagem e quem ensinou', async () => {
    const pend = await linha('032630-5');
    expect(pend.origemResolucao).toBe('nao_encontrado');
    await ensinarSinonimo(banco, {
      nomeOriginal: pend.nomeCta ?? '',
      codigo: '485',
      motivo: 'teste',
      usuarioId,
    });
    const r = await reaplicarSinonimos(banco, id, usuarioId);
    expect(r.resolvidas).toBeGreaterThanOrEqual(1);
    expect(r.porQuem).toContain('Karen');
    const agora = await linha('032630-5');
    expect(agora.codigoResolvido).toBe('485');
    expect(agora.origemResolucao).toBe('sinonimo');
  });

  it('linha com ajuste manual não é tocada', async () => {
    await definirAjusteManual(banco, id, usuarioId, '002171-7', '485');
    const { recalcular } = await import('../../src/dados/implantacoes.js');
    await recalcular(banco, id, usuarioId);
    await reaplicarSinonimos(banco, id, usuarioId);
    const l = await linha('002171-7');
    expect(l.origemResolucao).toBe('manual');
    expect(l.codigoResolvido).toBe('485');
  });

  it('linha já resolvida por nome não é tocada', async () => {
    // uma linha que não é pendência: pega a primeira com código resolvido
    const [resolvida] = await banco
      .select()
      .from(schema.implantacaoLinha)
      .where(eq(schema.implantacaoLinha.implantacaoId, id));
    const alvo = resolvida.codigoResolvido;
    await reaplicarSinonimos(banco, id, usuarioId);
    const [depois] = await banco
      .select()
      .from(schema.implantacaoLinha)
      .where(eq(schema.implantacaoLinha.id, resolvida.id));
    expect(depois.codigoResolvido).toBe(alvo);
  });

  it('sem sinônimo novo, não faz nada e não grava nada', async () => {
    const antes = await banco
      .select()
      .from(schema.auditoria)
      .where(eq(schema.auditoria.acao, 'recalcular'));
    const r = await reaplicarSinonimos(banco, id, usuarioId);
    expect(r.resolvidas).toBe(0);
    expect(r.porQuem).toEqual([]);
    const depois = await banco
      .select()
      .from(schema.auditoria)
      .where(eq(schema.auditoria.acao, 'recalcular'));
    expect(depois.length).toBe(antes.length); // nenhum recalcular novo
  });
});
