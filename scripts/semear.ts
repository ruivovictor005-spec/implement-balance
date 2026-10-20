// Carga inicial: lê as fixtures extraídas da planilha e grava a versão vigente do plano, as regras
// e os sinônimos no banco. Também exporta `colapsarSinonimos`, a regra de de-duplicação, para ser
// testada sem banco.
//
// Uso: npx tsx scripts/semear.ts   (usa DATABASE_URL)
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { PgDatabase } from 'drizzle-orm/pg-core';
import { criarBanco } from '../src/dados/cliente.js';
import {
  planoConta,
  planoVersao,
  regraNatureza,
  regraNormalizacao,
  sinonimo,
} from '../src/dados/schema.js';
import type {
  ContaPlano,
  RegraNatureza,
  RegraNormalizacao,
  SinonimoFixture,
} from '../src/motor/tipos.js';

const PASTA = join(process.cwd(), 'fixtures');
const ler = <T>(arquivo: string): T => JSON.parse(readFileSync(join(PASTA, arquivo), 'utf8')) as T;

/**
 * De-duplica sinônimos por chave normalizada: chave repetida com o MESMO código é colapsada (a
 * planilha tem "ISS PAGAR" duas vezes → 237); chave repetida com código DIFERENTE aborta, porque o
 * índice único do banco rejeitaria a segunda linha e a carga quebraria no meio.
 */
export function colapsarSinonimos(lista: SinonimoFixture[]): {
  inseridos: SinonimoFixture[];
  colapsados: number;
} {
  const porChave = new Map<string, string>();
  const inseridos: SinonimoFixture[] = [];
  let colapsados = 0;
  for (const s of lista) {
    const existente = porChave.get(s.chaveNormalizada);
    if (existente === undefined) {
      porChave.set(s.chaveNormalizada, s.codigoReduzido);
      inseridos.push(s);
    } else if (existente === s.codigoReduzido) {
      colapsados += 1;
      console.warn(`aviso: chave "${s.chaveNormalizada}" repetida com o mesmo código (${s.codigoReduzido}); colapsada`);
    } else {
      throw new Error(
        `chave "${s.chaveNormalizada}" aparece com códigos diferentes (${existente} e ${s.codigoReduzido}); corrija a planilha antes de carregar`,
      );
    }
  }
  return { inseridos, colapsados };
}

// Aceita tanto o driver node-postgres (produção) quanto o embutido (testes): ambos são PgDatabase.
export async function semear(banco: PgDatabase<any, any, any>): Promise<{
  contas: number;
  normalizacao: number;
  natureza: number;
  sinonimos: number;
  colapsados: number;
}> {
  const plano = ler<ContaPlano[]>('plano.json');
  const normalizacao = ler<RegraNormalizacao[]>('normalizacao.json');
  const natureza = ler<RegraNatureza[]>('natureza.json');
  const { inseridos, colapsados } = colapsarSinonimos(ler<SinonimoFixture[]>('sinonimos.json'));

  const [versao] = await banco
    .insert(planoVersao)
    .values({ nome: 'Carga inicial (planilha)', descricao: 'Extraída da planilha de integração', vigente: true })
    .returning({ id: planoVersao.id });
  const planoVersaoId = versao.id;

  await banco.insert(planoConta).values(
    plano.map((c) => ({
      planoVersaoId,
      codigoReduzido: c.codigoReduzido,
      classificacao: c.classificacao,
      descricao: c.descricao,
      tipo: c.tipo,
      descricaoNormalizada: c.descricaoNormalizada,
    })),
  );

  await banco.insert(regraNormalizacao).values(
    normalizacao.map((r) => ({ planoVersaoId, etapa: r.etapa, ordem: r.ordem, de: r.de, para: r.para })),
  );

  await banco.insert(regraNatureza).values(
    natureza.map((r) => ({
      planoVersaoId,
      ordem: r.ordem,
      prefixoClassificacao: r.prefixo,
      grupoCosif: r.grupoCosif,
      natureza: r.natureza,
      gruposDominio: r.gruposDominio,
      naoMigrar: r.naoMigrar,
    })),
  );

  await banco.insert(sinonimo).values(
    inseridos.map((s) => ({
      planoVersaoId,
      nomeOriginal: s.nomeOriginal,
      chaveNormalizada: s.chaveNormalizada,
      codigoReduzido: s.codigoReduzido,
    })),
  );

  return {
    contas: plano.length,
    normalizacao: normalizacao.length,
    natureza: natureza.length,
    sinonimos: inseridos.length,
    colapsados,
  };
}

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (url === undefined || url === '') {
    console.error('Defina DATABASE_URL (copie .env.example para .env).');
    process.exit(1);
  }
  const { banco, fechar } = criarBanco(url);
  try {
    const r = await semear(banco);
    console.log(
      `carga: ${r.contas} contas, ${r.sinonimos} sinônimos (${r.colapsados} colapsados), ${r.normalizacao} regras de normalização, ${r.natureza} de natureza`,
    );
  } finally {
    await fechar();
  }
}

if (process.argv[1] !== undefined && /semear\.(ts|js)$/.test(process.argv[1].replace(/\\/g, '/'))) {
  void main();
}
