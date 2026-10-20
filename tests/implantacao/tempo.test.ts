import type { PgliteDatabase } from 'drizzle-orm/pglite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { tempoAtivoSegundos, tempoTotalSegundos } from '../../src/dados/tempo.js';
import * as schema from '../../src/dados/schema.js';
import { criarBancoTeste } from '../apoio/banco.js';

describe('cronômetro', () => {
  let banco: PgliteDatabase<typeof schema>;
  let fechar: () => Promise<void>;

  beforeEach(async () => {
    ({ banco, fechar } = await criarBancoTeste());
  });
  afterEach(async () => {
    await fechar();
  });

  const eventos = async (idStr: string, segundos: number[]) => {
    const t0 = new Date('2026-01-01T10:00:00Z');
    await banco.insert(schema.auditoria).values(
      segundos.map((s) => ({
        acao: 'acao',
        entidade: 'implantacao',
        entidadeId: idStr,
        criadoEm: new Date(t0.getTime() + s * 1000),
      })),
    );
  };

  it('tempo total é conclusão menos início', () => {
    expect(tempoTotalSegundos(new Date(0), new Date(3_600_000))).toBe(3600);
  });

  it('tempo ativo desconta intervalo maior que 10 minutos sem ação', async () => {
    await eventos('1', [0, 60, 60 + 1200, 60 + 1200 + 60]); // 60 + (1200 ignorado) + 60
    expect(await tempoAtivoSegundos(banco, 1)).toBe(120);
  });

  it('tempo ativo de implantação sem pausa é igual ao total', async () => {
    await eventos('2', [0, 60, 120]);
    const t0 = new Date('2026-01-01T10:00:00Z');
    const total = tempoTotalSegundos(t0, new Date(t0.getTime() + 120 * 1000));
    expect(await tempoAtivoSegundos(banco, 2)).toBe(total);
  });
});
