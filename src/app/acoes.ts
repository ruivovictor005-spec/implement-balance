'use server';

// Ações de servidor: recebem os bytes do arquivo e os parâmetros, rodam o leitor e o motor e
// devolvem o que o motor produziu. Sem estado no servidor — a tela manda o arquivo e os ajustes a
// cada recálculo. O motor e o leitor são puros; aqui é a borda que junta as peças e lê os dados.
import { converter, type LinhaResolvida, type Painel } from '../motor/converter.js';
import { normalizarNome } from '../motor/normalizar.js';
import { resolverNatureza } from '../motor/natureza.js';
import type { ContaPlano } from '../motor/tipos.js';
import { detectarPerfil, extrairLinhas } from '../leitores/detectar.js';
import { lerArquivo, type Celula } from '../leitores/ler-arquivo.js';
import {
  carregarPlano,
  carregarRegrasNatureza,
  carregarRegrasNormalizacao,
  carregarSinonimos,
} from '../dados/fixtures.js';

export type ParametrosEntrada = {
  dataSaldo: string; // 'YYYY-MM-DD'
  cnpj: string;
  codigoEmpresa: string;
  tipoLote: string;
  codigoHistorico: string;
  incluirCabecalho: boolean;
};

export type ContaCriadaEntrada = { codigoReduzido: string; descricao: string; classificacao: string };

export type Reconhecimento = {
  perfilId: string;
  perfilNome: string;
  linhas: number;
  analiticas: number;
  sinteticas: number;
};

export type ResultadoConversao = {
  reconhecimento: Reconhecimento;
  painel: Painel;
  linhas: LinhaResolvida[];
  txt: string[];
};

export type ContaBusca = ContaPlano & { natureza: string };

export type RespostaProcessar =
  | { ok: true; resultado: ResultadoConversao }
  | { ok: false; erro: string; previa?: Celula[][] };

/** 'YYYY-MM-DD' → Date pelos componentes locais (sem fuso), para a data do TXT sair como digitada. */
function dataLocal(iso: string): Date {
  const [ano, mes, dia] = iso.split('-').map(Number);
  return new Date(ano ?? 1970, (mes ?? 1) - 1, dia ?? 1);
}

/** Contas do plano com a natureza derivada da classificação, para a busca mostrar e evitar erro. */
export async function carregarContas(): Promise<ContaBusca[]> {
  const regras = carregarRegrasNatureza();
  return carregarPlano().map((c) => ({
    ...c,
    natureza: resolverNatureza(c.classificacao, regras)?.natureza ?? '',
  }));
}

export async function processarArquivo(entrada: {
  bytes: Uint8Array;
  nomeArquivo: string;
  parametros: ParametrosEntrada;
  ajustes: [string, string][];
  contasCriadas: ContaCriadaEntrada[];
  manual?: { linhaCabecalho: number; colunas: Record<string, number> };
}): Promise<RespostaProcessar> {
  let matriz: Celula[][];
  try {
    matriz = await lerArquivo(entrada.bytes, entrada.nomeArquivo);
  } catch (e) {
    return { ok: false, erro: (e as Error).message };
  }

  let perfilId = 'manual';
  let perfilNome = 'Mapeamento manual';
  let linhaCabecalho: number;
  let colunas: Record<string, number>;

  if (entrada.manual !== undefined) {
    ({ linhaCabecalho, colunas } = entrada.manual);
  } else {
    const deteccao = detectarPerfil(matriz);
    if (deteccao === null) {
      return {
        ok: false,
        erro: 'Layout não reconhecido. Aponte as colunas manualmente ou confira se é um balancete Domínio ou Infobank.',
        previa: matriz.slice(0, 15),
      };
    }
    perfilId = deteccao.perfil.id;
    perfilNome = deteccao.perfil.nome;
    linhaCabecalho = deteccao.linhaCabecalho;
    colunas = deteccao.colunas;
  }

  const balancete = extrairLinhas(matriz, linhaCabecalho, colunas);
  const analiticas = balancete.filter((l) => !l.tipoCta.startsWith('S')).length;

  const regrasNormalizacao = carregarRegrasNormalizacao();
  const contasCriadas: ContaPlano[] = entrada.contasCriadas.map((c) => ({
    codigoReduzido: c.codigoReduzido,
    classificacao: c.classificacao,
    descricao: c.descricao,
    tipo: 'A',
    descricaoNormalizada: normalizarNome(c.descricao, regrasNormalizacao),
  }));

  const resultado = converter({
    balancete,
    plano: carregarPlano(),
    contasCriadas,
    sinonimos: carregarSinonimos(),
    regrasNormalizacao,
    regrasNatureza: carregarRegrasNatureza(),
    ajustesManuais: new Map(entrada.ajustes),
    parametros: {
      dataSaldo: dataLocal(entrada.parametros.dataSaldo),
      cnpj: entrada.parametros.cnpj,
      codigoEmpresa: entrada.parametros.codigoEmpresa,
      tipoLote: entrada.parametros.tipoLote,
      codigoHistorico: entrada.parametros.codigoHistorico,
      incluirCabecalho: entrada.parametros.incluirCabecalho,
    },
  });

  return {
    ok: true,
    resultado: {
      reconhecimento: {
        perfilId,
        perfilNome,
        linhas: balancete.length,
        analiticas,
        sinteticas: balancete.length - analiticas,
      },
      painel: resultado.painel,
      linhas: resultado.linhas,
      txt: resultado.txt,
    },
  };
}
