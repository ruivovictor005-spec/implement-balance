'use server';

// Ações das regras globais (natureza e normalização). Todas conferem administrador na camada de
// dados, mesmo que alguém chame a ação direto — a tela só esconde os botões.
import { auth } from '../../acesso/auth.js';
import { db } from '../../dados/cliente.js';
import {
  alterarRegraNatureza,
  alterarRegraNormalizacao,
  listarRegrasNatureza,
  listarRegrasNormalizacao,
  type RegraNaturezaEditavel,
  type RegraNormalizacaoEditavel,
  type ResultadoRegra,
} from '../../dados/regras.js';
import { ehAdmin } from '../../dados/sinonimos.js';

async function usuarioAtualId(): Promise<number> {
  const sessao = await auth();
  const uid = (sessao as { uid?: number } | null)?.uid;
  if (uid === undefined || uid === null) throw new Error('Não autenticado.');
  return uid;
}

export async function souAdmin(): Promise<boolean> {
  return ehAdmin(db(), await usuarioAtualId());
}

export async function listarNatureza(): Promise<RegraNaturezaEditavel[]> {
  await usuarioAtualId();
  return listarRegrasNatureza(db());
}

export async function listarNormalizacao(): Promise<RegraNormalizacaoEditavel[]> {
  await usuarioAtualId();
  return listarRegrasNormalizacao(db());
}

export async function mudarNatureza(
  id: number,
  natureza: string,
  gruposDominio: string[],
  naoMigrar: boolean,
): Promise<ResultadoRegra> {
  return alterarRegraNatureza(db(), await usuarioAtualId(), id, {
    natureza,
    gruposDominio,
    naoMigrar,
  });
}

export async function mudarNormalizacao(
  id: number,
  de: string,
  para: string,
  ativo: boolean,
): Promise<ResultadoRegra> {
  return alterarRegraNormalizacao(db(), await usuarioAtualId(), id, { de, para, ativo });
}
