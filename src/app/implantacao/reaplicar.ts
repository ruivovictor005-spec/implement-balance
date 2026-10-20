// Reaplica sinônimos novos nas pendências de uma implantação: só mexe em linhas que estão
// "NÃO ENCONTRADO" e sem ajuste manual. Faz um ensaio com o motor (sem gravar); se nada novo
// resolver, não grava nada. Se resolver, persiste pelo recalcular e diz quem ensinou.
import { and, eq, inArray } from 'drizzle-orm';
import type { PgDatabase } from 'drizzle-orm/pg-core';
import { converter } from '../../motor/converter.js';
import { normalizarNome } from '../../motor/normalizar.js';
import type { ContaPlano, LinhaBalancete } from '../../motor/tipos.js';
import { carregarPlanoVigente } from '../../dados/plano.js';
import { carregarRegras } from '../../dados/regras.js';
import { carregarSinonimos } from '../../dados/sinonimos.js';
import { recalcular } from '../../dados/implantacoes.js';
import { contaCriada, implantacao, implantacaoLinha, sinonimo, sinonimoEvento, usuario } from '../../dados/schema.js';

type Banco = PgDatabase<any, any, any>;

export async function reaplicarSinonimos(
  banco: Banco,
  implantacaoId: number,
  usuarioId: number,
): Promise<{ resolvidas: number; porQuem: string[] }> {
  const [imp] = await banco.select().from(implantacao).where(eq(implantacao.id, implantacaoId)).limit(1);
  if (imp === undefined) return { resolvidas: 0, porQuem: [] };

  const linhasOrigem = await banco
    .select()
    .from(implantacaoLinha)
    .where(eq(implantacaoLinha.implantacaoId, implantacaoId))
    .orderBy(implantacaoLinha.ordem);

  const pendentesAntes = new Set(
    linhasOrigem
      .filter((l) => l.origemResolucao === 'nao_encontrado' && (l.ajusteManual === null || l.ajusteManual === ''))
      .map((l) => l.codiCta ?? ''),
  );
  if (pendentesAntes.size === 0) return { resolvidas: 0, porQuem: [] };

  const regras = await carregarRegras(banco);
  const criadas = await banco.select().from(contaCriada).where(eq(contaCriada.implantacaoId, implantacaoId));
  const contasCriadas: ContaPlano[] = criadas.map((c) => ({
    codigoReduzido: c.codigoReduzido,
    classificacao: c.classificacao,
    descricao: c.descricao,
    tipo: 'A',
    descricaoNormalizada: normalizarNome(c.descricao, regras.normalizacao),
  }));
  const ajustesManuais = new Map<string, string>();
  for (const l of linhasOrigem) {
    if (l.codiCta !== null && l.ajusteManual !== null && l.ajusteManual !== '') {
      ajustesManuais.set(l.codiCta, l.ajusteManual);
    }
  }
  const balancete: LinhaBalancete[] = linhasOrigem.map((l) => ({
    codiCta: l.codiCta ?? '',
    nomeCta: l.nomeCta ?? '',
    clasCta: l.clasCta ?? '',
    tipoCta: l.tipoCta ?? '',
    saldoAnterior: Number(l.saldoAnterior ?? 0),
    totalDebito: Number(l.totalDebito ?? 0),
    totalCredito: Number(l.totalCredito ?? 0),
    saldoAtual: Number(l.saldoAtual ?? 0),
  }));

  // Ensaio: roda o motor em memória, sem gravar.
  const ensaio = converter({
    balancete,
    plano: await carregarPlanoVigente(banco),
    contasCriadas,
    sinonimos: await carregarSinonimos(banco),
    regrasNormalizacao: regras.normalizacao,
    regrasNatureza: regras.natureza,
    ajustesManuais,
    parametros: {
      dataSaldo: new Date(1970, 0, 1),
      cnpj: imp.empresaCnpj ?? '',
      codigoEmpresa: imp.empresaCodigoDominio ?? '',
      tipoLote: imp.tipoLote ?? 'V',
      codigoHistorico: imp.codigoHistorico ?? '700',
      incluirCabecalho: false,
    },
  });

  const resolvidasAgora = ensaio.linhas.filter((l) => pendentesAntes.has(l.codiCta) && l.codigo !== null);
  if (resolvidasAgora.length === 0) return { resolvidas: 0, porQuem: [] };

  // Algo novo resolveu: persiste tudo de forma consistente.
  await recalcular(banco, implantacaoId, usuarioId);

  const chaves = [...new Set(resolvidasAgora.filter((l) => l.origem === 'sinonimo').map((l) => l.nomeNormalizado))];
  let porQuem: string[] = [];
  if (chaves.length > 0) {
    const rows = await banco
      .select({ nome: usuario.nome })
      .from(sinonimo)
      .innerJoin(
        sinonimoEvento,
        and(eq(sinonimoEvento.sinonimoId, sinonimo.id), eq(sinonimoEvento.tipo, 'criado')),
      )
      .innerJoin(usuario, eq(sinonimoEvento.autorId, usuario.id))
      .where(and(eq(sinonimo.status, 'ativo'), inArray(sinonimo.chaveNormalizada, chaves)));
    porQuem = [...new Set(rows.map((r) => r.nome))];
  }

  return { resolvidas: resolvidasAgora.length, porQuem };
}
