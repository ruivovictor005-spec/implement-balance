import { readFileSync } from 'node:fs';
import { eq } from 'drizzle-orm';
import type { PgliteDatabase } from 'drizzle-orm/pglite';
import ExcelJS from 'exceljs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { semear } from '../../scripts/semear.js';
import {
  concluirImplantacao,
  exportarConcluidas,
  gerarTxtDaImplantacao,
} from '../../src/app/implantacao/concluir.js';
import { anexarBalancete, iniciarImplantacao } from '../../src/dados/implantacoes.js';
import * as schema from '../../src/dados/schema.js';
import { criarBancoTeste } from '../apoio/banco.js';

const BALANCETE = new Uint8Array(
  readFileSync(new URL('../../fixtures/arquivos/balancete-dominio.xlsx', import.meta.url)),
);

describe('conclusão e lista de concluídas', () => {
  let banco: PgliteDatabase<typeof schema>;
  let fechar: () => Promise<void>;
  let usuarioId: number;
  let id: number;

  const imp = async () => {
    const [i] = await banco.select().from(schema.implantacao).where(eq(schema.implantacao.id, id));
    return i;
  };

  beforeEach(async () => {
    ({ banco, fechar } = await criarBancoTeste());
    await semear(banco);
    const [u] = await banco
      .insert(schema.usuario)
      .values({ oidEntra: 'u1', email: 'u@x', nome: 'Ana' })
      .returning({ id: schema.usuario.id });
    usuarioId = u.id;
    id = await iniciarImplantacao(banco, usuarioId);
    await anexarBalancete(banco, id, usuarioId, { bytes: BALANCETE, nomeArquivo: 'b.xlsx' });
  });
  afterEach(async () => {
    await fechar();
  });

  it('não gera TXT com pendência sem motivo', async () => {
    const r = await gerarTxtDaImplantacao(banco, id, usuarioId);
    expect(r.ok).toBe(false);
  });

  it('gera com motivo de liberação, e o motivo fica gravado', async () => {
    const r = await gerarTxtDaImplantacao(banco, id, usuarioId, 'liberado pelo gestor');
    expect(r.ok).toBe(true);
    expect((await imp()).liberacaoMotivo).toBe('liberado pelo gestor');
  });

  it('TXT gerado fica guardado na implantação, com hash', async () => {
    await gerarTxtDaImplantacao(banco, id, usuarioId, 'x');
    const i = await imp();
    expect(i.txtGerado).toBeTruthy();
    expect(i.txtHash).toBeTruthy();
  });

  it('download entrega o nome padrão e TXT com CRLF sem linha em branco no fim', async () => {
    const r = await gerarTxtDaImplantacao(banco, id, usuarioId, 'x');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.nomeArquivo).toBe('Importacao_Dominio.txt');
      expect(r.conteudo.includes('\r\n')).toBe(true);
      expect(r.conteudo.endsWith('\r\n')).toBe(true);
      expect(r.conteudo.endsWith('\r\n\r\n')).toBe(false);
    }
  });

  it('não conclui sem gerar nada antes', async () => {
    const r = await concluirImplantacao(banco, id, usuarioId);
    expect(r.ok).toBe(false);
  });

  it('concluir move para concluída e preenche a data de conclusão', async () => {
    await gerarTxtDaImplantacao(banco, id, usuarioId, 'x');
    const r = await concluirImplantacao(banco, id, usuarioId);
    expect(r.ok).toBe(true);
    const i = await imp();
    expect(i.status).toBe('concluida');
    expect(i.concluidaEm).not.toBeNull();
  });

  it('exportação traz empresa, data, pessoa, conclusão e liberação (sem tempos)', async () => {
    await gerarTxtDaImplantacao(banco, id, usuarioId, 'liberado');
    await concluirImplantacao(banco, id, usuarioId);
    const bytes = await exportarConcluidas(banco);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(bytes.buffer as ArrayBuffer);
    const ws = wb.worksheets[0];
    const header = (ws.getRow(1).values as unknown[]).map((v) => String(v)).join('|');
    for (const col of ['Empresa', 'Data do saldo', 'Pessoa', 'Concluída em', 'Liberação']) {
      expect(header).toContain(col);
    }
    expect(header).not.toContain('Tempo');
    expect(ws.rowCount).toBeGreaterThanOrEqual(2);
  });
});
