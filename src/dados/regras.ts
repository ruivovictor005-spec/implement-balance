// Leitura e EDIÇÃO das regras de normalização e natureza da versão vigente.
//
// As duas tabelas são globais: valem para as implantações de todo mundo, como os sinônimos. Por
// isso mexer nelas é só do administrador — e, diferente dos sinônimos, sem fila de proposta: são
// poucas regras, estruturais, e quem as entende é quem administra.
import { and, eq, sql } from 'drizzle-orm';
import type { PgDatabase } from 'drizzle-orm/pg-core';
import { normalizarNome } from '../motor/normalizar.js';
import type { RegraNatureza, RegraNormalizacao } from '../motor/tipos.js';
import { podeAdministrar } from '../acesso/papeis.js';
import { db } from './cliente.js';
import {
  planoConta,
  planoVersao,
  regraNatureza,
  regraNormalizacao,
  sinonimo,
  usuario,
} from './schema.js';

type Banco = PgDatabase<any, any, any>;

async function idVigente(banco: Banco): Promise<number> {
  const [v] = await banco
    .select({ id: planoVersao.id })
    .from(planoVersao)
    .where(eq(planoVersao.vigente, true))
    .limit(1);
  if (v === undefined) throw new Error('Nenhuma versão de plano vigente.');
  return v.id;
}

/**
 * Regras da versão vigente. `natureza` é a tabela COSIF (conta de ORIGEM); `naturezaDominio` é a
 * tabela do plano Domínio (conta de DESTINO). Ver src/motor/natureza.ts.
 */
export async function carregarRegras(banco: Banco = db()): Promise<{
  normalizacao: RegraNormalizacao[];
  natureza: RegraNatureza[];
  naturezaDominio: RegraNatureza[];
}> {
  const vid = await idVigente(banco);
  // `ativo` existia na tabela e NÃO era consultado: uma regra desligada seguia valendo. Agora é
  // filtrada aqui, que é o único lugar por onde o motor recebe as regras.
  const norm = await banco
    .select()
    .from(regraNormalizacao)
    .where(and(eq(regraNormalizacao.planoVersaoId, vid), eq(regraNormalizacao.ativo, true)));
  const nat = await banco.select().from(regraNatureza).where(eq(regraNatureza.planoVersaoId, vid));
  const paraMotor = (r: (typeof nat)[number]): RegraNatureza => ({
    ordem: r.ordem,
    prefixo: r.prefixoClassificacao,
    grupoCosif: r.grupoCosif,
    natureza: r.natureza,
    gruposDominio: r.gruposDominio,
    naoMigrar: r.naoMigrar,
    conjunto: r.conjunto === 'dominio' ? 'dominio' : 'cosif',
  });
  return {
    normalizacao: norm.map((r) => ({
      etapa: r.etapa as 1 | 2,
      ordem: r.ordem,
      de: r.de,
      para: r.para,
    })),
    natureza: nat.filter((r) => r.conjunto !== 'dominio').map(paraMotor),
    naturezaDominio: nat.filter((r) => r.conjunto === 'dominio').map(paraMotor),
  };
}

// ---------------------------------------------------------------------------------------------
// Edição das regras. Só administrador.
// ---------------------------------------------------------------------------------------------

export type ResultadoRegra = { ok: true; aviso?: string } | { ok: false; erro: string };

const SO_ADMIN: ResultadoRegra = { ok: false, erro: 'Apenas o administrador pode mudar regras.' };

async function ehAdmin(banco: Banco, usuarioId: number): Promise<boolean> {
  const [u] = await banco
    .select({ papel: usuario.papel })
    .from(usuario)
    .where(eq(usuario.id, usuarioId))
    .limit(1);
  return u !== undefined && podeAdministrar(u);
}

export type RegraNaturezaEditavel = {
  id: number;
  ordem: number;
  prefixo: string;
  grupoCosif: string;
  natureza: string;
  gruposDominio: string[];
  naoMigrar: boolean;
  conjunto: 'cosif' | 'dominio';
};

/** As regras de natureza da versão vigente, na ordem em que o motor as consulta. */
export async function listarRegrasNatureza(banco: Banco = db()): Promise<RegraNaturezaEditavel[]> {
  const vid = await idVigente(banco);
  const linhas = await banco
    .select()
    .from(regraNatureza)
    .where(eq(regraNatureza.planoVersaoId, vid))
    .orderBy(regraNatureza.ordem);
  return linhas.map((r) => ({
    id: r.id,
    ordem: r.ordem,
    prefixo: r.prefixoClassificacao,
    grupoCosif: r.grupoCosif,
    natureza: r.natureza,
    gruposDominio: r.gruposDominio,
    naoMigrar: r.naoMigrar,
    conjunto: r.conjunto === 'dominio' ? 'dominio' : 'cosif',
  }));
}

/** Grupo do Domínio aceito numa regra: um ou dois dígitos ("4", "42"). */
const GRUPO_VALIDO = /^\d{1,2}$/;

/**
 * Muda o que uma regra de natureza responde: o nome da natureza, os grupos do Domínio que ela
 * aceita e se a conta não deve migrar. Prefixo e ordem ficam como estão — mexer neles é remontar a
 * cascata, não corrigir uma regra.
 *
 * Não mexe em nada gravado: natureza é recalculada a cada `recalcular`, então a mudança aparece na
 * próxima vez que a implantação for aberta.
 */
export async function alterarRegraNatureza(
  banco: Banco,
  usuarioId: number,
  id: number,
  campos: { natureza: string; gruposDominio: string[]; naoMigrar: boolean },
): Promise<ResultadoRegra> {
  if (!(await ehAdmin(banco, usuarioId))) return SO_ADMIN;

  const natureza = campos.natureza.trim();
  if (natureza === '') return { ok: false, erro: 'A natureza não pode ficar vazia.' };

  const grupos = campos.gruposDominio.map((g) => g.trim()).filter((g) => g !== '');
  const invalido = grupos.find((g) => !GRUPO_VALIDO.test(g));
  if (invalido !== undefined) {
    return { ok: false, erro: `"${invalido}" não é um grupo do Domínio (use 1 ou 2 dígitos).` };
  }
  if (!campos.naoMigrar && grupos.length === 0) {
    return {
      ok: false,
      erro: 'Sem grupos do Domínio, nenhuma conta casa com esta regra. Marque "não migrar" ou informe os grupos.',
    };
  }

  const vid = await idVigente(banco);
  const alterada = await banco
    .update(regraNatureza)
    .set({ natureza, gruposDominio: campos.naoMigrar ? [] : grupos, naoMigrar: campos.naoMigrar })
    .where(and(eq(regraNatureza.id, id), eq(regraNatureza.planoVersaoId, vid)))
    .returning({ id: regraNatureza.id });
  if (alterada.length === 0) return { ok: false, erro: 'Regra não encontrada na versão vigente.' };
  return { ok: true };
}

export type RegraNormalizacaoEditavel = {
  id: number;
  etapa: number;
  ordem: number;
  de: string;
  para: string;
  ativo: boolean;
};

/** As regras de normalização da versão vigente, na ordem em que são aplicadas. */
export async function listarRegrasNormalizacao(
  banco: Banco = db(),
): Promise<RegraNormalizacaoEditavel[]> {
  const vid = await idVigente(banco);
  return banco
    .select({
      id: regraNormalizacao.id,
      etapa: regraNormalizacao.etapa,
      ordem: regraNormalizacao.ordem,
      de: regraNormalizacao.de,
      para: regraNormalizacao.para,
      ativo: regraNormalizacao.ativo,
    })
    .from(regraNormalizacao)
    .where(eq(regraNormalizacao.planoVersaoId, vid))
    .orderBy(regraNormalizacao.etapa, regraNormalizacao.ordem);
}

/** Abortar a transação de dentro do recálculo, levando a mensagem para quem chamou. */
class ChaveDuplicada extends Error {}

/**
 * Recalcula tudo que guarda nome NORMALIZADO, com as regras que estiverem valendo agora.
 *
 * É obrigatório depois de mexer numa regra de normalização, e é a razão de essa edição existir
 * numa transação. Duas tabelas guardam a forma normalizada de um nome:
 *  - `sinonimo.chave_normalizada`, calculada quando o sinônimo foi ensinado;
 *  - `plano_conta.descricao_normalizada`, calculada quando o plano foi importado.
 *
 * O motor normaliza o nome do balancete NA HORA, com as regras vigentes, e compara com essas duas.
 * Se a regra muda e elas não, as duas pontas deixam de se encontrar e todos os sinônimos param de
 * casar — em silêncio, que é o pior jeito de quebrar.
 *
 * Colisão entre dois sinônimos ATIVOS aborta tudo: a regra nova faria dois nomes diferentes virarem
 * a mesma chave, e o índice único só deixaria um sobreviver. Melhor recusar e dizer quais são.
 */
async function renormalizarVersao(banco: Banco, vid: number): Promise<void> {
  const regras = await carregarRegras(banco);

  const sins = await banco
    .select({ id: sinonimo.id, nome: sinonimo.nomeOriginal, status: sinonimo.status })
    .from(sinonimo)
    .where(eq(sinonimo.planoVersaoId, vid));

  const novas = sins.map((s) => ({
    id: s.id,
    status: s.status,
    chave: normalizarNome(s.nome, regras.normalizacao),
    nome: s.nome,
  }));

  const porChave = new Map<string, string>();
  for (const s of novas) {
    if (s.status !== 'ativo') continue;
    const anterior = porChave.get(s.chave);
    if (anterior !== undefined) {
      throw new ChaveDuplicada(
        `Com esta regra, "${anterior}" e "${s.nome}" viram a mesma chave (${s.chave}) e um dos dois sinônimos se perderia. Ajuste um deles antes.`,
      );
    }
    porChave.set(s.chave, s.nome);
  }

  if (novas.length > 0) {
    const lote = JSON.stringify(novas.map((s) => ({ id: s.id, chave: s.chave })));
    await banco.execute(sql`
      UPDATE ${sinonimo} AS s
         SET chave_normalizada = v.chave
        FROM jsonb_to_recordset(${lote}::jsonb) AS v(id integer, chave text)
       WHERE s.id = v.id`);
  }

  const contas = await banco
    .select({ id: planoConta.id, descricao: planoConta.descricao })
    .from(planoConta)
    .where(eq(planoConta.planoVersaoId, vid));
  if (contas.length > 0) {
    const lote = JSON.stringify(
      contas.map((c) => ({ id: c.id, norm: normalizarNome(c.descricao, regras.normalizacao) })),
    );
    await banco.execute(sql`
      UPDATE ${planoConta} AS p
         SET descricao_normalizada = v.norm
        FROM jsonb_to_recordset(${lote}::jsonb) AS v(id integer, norm text)
       WHERE p.id = v.id`);
  }
}

/**
 * Muda uma regra de normalização — o trecho procurado, o que entra no lugar, ou desliga a regra —
 * e recalcula todas as chaves na mesma transação. Ou tudo muda junto, ou nada muda.
 */
export async function alterarRegraNormalizacao(
  banco: Banco,
  usuarioId: number,
  id: number,
  campos: { de: string; para: string; ativo: boolean },
): Promise<ResultadoRegra> {
  if (!(await ehAdmin(banco, usuarioId))) return SO_ADMIN;
  if (campos.de === '') {
    return { ok: false, erro: 'O trecho procurado não pode ficar vazio; para desligar, use "ativa".' };
  }

  const vid = await idVigente(banco);
  try {
    return await banco.transaction(async (tx) => {
      const alterada = await tx
        .update(regraNormalizacao)
        .set({ de: campos.de, para: campos.para, ativo: campos.ativo })
        .where(and(eq(regraNormalizacao.id, id), eq(regraNormalizacao.planoVersaoId, vid)))
        .returning({ id: regraNormalizacao.id });
      if (alterada.length === 0) {
        return { ok: false, erro: 'Regra não encontrada na versão vigente.' } as ResultadoRegra;
      }
      await renormalizarVersao(tx as unknown as Banco, vid);
      return {
        ok: true,
        aviso: 'As chaves dos sinônimos e do plano foram recalculadas com a regra nova.',
      } as ResultadoRegra;
    });
  } catch (e) {
    if (e instanceof ChaveDuplicada) return { ok: false, erro: e.message };
    throw e;
  }
}
