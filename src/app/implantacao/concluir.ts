// Trava de geração, conclusão e lista de concluídas. Só gera TXT com zero pendências e diferença
// zero — ou com um motivo de liberação, que fica gravado. Concluir exige ter gerado antes.
import { desc, eq } from 'drizzle-orm';
import type { PgDatabase } from 'drizzle-orm/pg-core';
import ExcelJS from 'exceljs';
import { recalcular } from '../../dados/implantacoes.js';
import { implantacao, usuario } from '../../dados/schema.js';

type Banco = PgDatabase<any, any, any>;
const NOME_PADRAO = 'Importacao_Dominio.txt';

function hash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
  return String(h);
}

export async function gerarTxtDaImplantacao(
  banco: Banco,
  id: number,
  usuarioId: number,
  liberacaoMotivo?: string,
): Promise<{ ok: true; nomeArquivo: string; conteudo: string } | { ok: false; erro: string }> {
  const { painel } = await recalcular(banco, id, usuarioId);
  const liberado = liberacaoMotivo !== undefined && liberacaoMotivo.trim() !== '';
  if (painel.pendentes > 0 && !liberado) {
    return { ok: false, erro: 'Há pendências. Resolva-as ou informe um motivo de liberação.' };
  }
  if (painel.diferenca !== 0 && !liberado) {
    return { ok: false, erro: 'A diferença débito/crédito não é zero. Resolva ou informe um motivo.' };
  }

  const [imp] = await banco.select().from(implantacao).where(eq(implantacao.id, id)).limit(1);
  const guardado = imp?.txtGerado ?? '';
  const conteudo = guardado.endsWith('\r\n') ? guardado : `${guardado}\r\n`;
  const nomeArquivo = imp?.nomeArquivoTxt ?? NOME_PADRAO;

  await banco
    .update(implantacao)
    .set({
      txtHash: hash(conteudo),
      nomeArquivoTxt: nomeArquivo,
      liberacaoMotivo: liberado ? liberacaoMotivo : (imp?.liberacaoMotivo ?? null),
    })
    .where(eq(implantacao.id, id));

  return { ok: true, nomeArquivo, conteudo };
}

export async function concluirImplantacao(
  banco: Banco,
  id: number,
  usuarioId: number,
  liberacaoMotivo?: string,
): Promise<{ ok: true } | { ok: false; erro: string }> {
  const [imp] = await banco.select().from(implantacao).where(eq(implantacao.id, id)).limit(1);
  if (imp === undefined) return { ok: false, erro: 'Implantação não encontrada.' };
  if (imp.usuarioId !== usuarioId) return { ok: false, erro: 'Esta implantação é de outra pessoa.' };
  if (imp.txtHash === null) return { ok: false, erro: 'Gere o TXT antes de concluir.' };

  await banco
    .update(implantacao)
    .set({
      status: 'concluida',
      concluidaEm: new Date(),
      liberacaoMotivo:
        liberacaoMotivo !== undefined && liberacaoMotivo.trim() !== ''
          ? liberacaoMotivo
          : imp.liberacaoMotivo,
    })
    .where(eq(implantacao.id, id));
  return { ok: true };
}

export type ConcluidaResumo = {
  id: number;
  empresaNome: string | null;
  empresaCnpj: string | null;
  dataSaldo: string | null;
  pessoa: string;
  concluidaEm: Date | null;
  liberacao: string | null;
};

export async function listarConcluidas(banco: Banco): Promise<ConcluidaResumo[]> {
  const rows = await banco
    .select({
      id: implantacao.id,
      empresaNome: implantacao.empresaNome,
      empresaCnpj: implantacao.empresaCnpj,
      dataSaldo: implantacao.dataSaldo,
      pessoa: usuario.nome,
      concluidaEm: implantacao.concluidaEm,
      liberacao: implantacao.liberacaoMotivo,
    })
    .from(implantacao)
    .innerJoin(usuario, eq(implantacao.usuarioId, usuario.id))
    .where(eq(implantacao.status, 'concluida'))
    .orderBy(desc(implantacao.concluidaEm));

  return rows.map((r) => ({
    id: r.id,
    empresaNome: r.empresaNome,
    empresaCnpj: r.empresaCnpj,
    dataSaldo: r.dataSaldo,
    pessoa: r.pessoa,
    concluidaEm: r.concluidaEm,
    liberacao: r.liberacao,
  }));
}

export async function exportarConcluidas(banco: Banco): Promise<Uint8Array> {
  const lista = await listarConcluidas(banco);
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Concluídas');
  ws.addRow(['Empresa', 'CNPJ', 'Data do saldo', 'Pessoa', 'Concluída em', 'Liberação']);
  for (const c of lista) {
    ws.addRow([
      c.empresaNome ?? '',
      c.empresaCnpj ?? '',
      c.dataSaldo ?? '',
      c.pessoa,
      c.concluidaEm !== null ? c.concluidaEm.toISOString().slice(0, 10) : '',
      c.liberacao ?? '',
    ]);
  }
  const buffer = await wb.xlsx.writeBuffer();
  return new Uint8Array(buffer as ArrayBuffer);
}
