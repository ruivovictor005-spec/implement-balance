'use server';

// Ações de servidor da implantação: resolvem quem está logado (pela sessão do Entra) e delegam para
// a camada de dados, que faz o trabalho e a auditoria. A tela (Task 11) chama estas funções.
import { eq } from 'drizzle-orm';
import { auth } from '../../acesso/auth.js';
import { db } from '../../dados/cliente.js';
import {
  anexarBalancete as anexarNoBanco,
  definirAjusteManual as definirNoBanco,
  iniciarImplantacao as iniciarNoBanco,
  recalcular as recalcularNoBanco,
  registrarContaCriada as registrarContaNoBanco,
  salvarDadosEmpresa as salvarDadosNoBanco,
  type ContaCriadaEntrada,
  type DadosEmpresa,
} from '../../dados/implantacoes.js';
import { registrarEntrada } from '../../dados/usuarios.js';
import { usuario } from '../../dados/schema.js';

async function usuarioAtualId(): Promise<number> {
  const sessao = await auth();
  const oid = (sessao as { oid?: string } | null)?.oid;
  if (sessao?.user === undefined || oid === undefined || oid === '') {
    throw new Error('Não autenticado.');
  }
  const [existente] = await db()
    .select({ id: usuario.id })
    .from(usuario)
    .where(eq(usuario.oidEntra, oid))
    .limit(1);
  if (existente !== undefined) return existente.id;
  const novo = await registrarEntrada(db(), {
    oid,
    email: sessao.user.email ?? undefined,
    nome: sessao.user.name ?? undefined,
  });
  return novo.id;
}

export async function iniciarImplantacao(): Promise<number> {
  return iniciarNoBanco(db(), await usuarioAtualId());
}

export async function salvarDadosEmpresa(id: number, dados: DadosEmpresa): Promise<void> {
  return salvarDadosNoBanco(db(), id, await usuarioAtualId(), dados);
}

export async function anexarBalancete(
  id: number,
  arquivo: { bytes: Uint8Array; nomeArquivo: string },
) {
  return anexarNoBanco(db(), id, await usuarioAtualId(), arquivo);
}

export async function definirAjusteManual(id: number, codiCta: string, codigo: string | null) {
  return definirNoBanco(db(), id, await usuarioAtualId(), codiCta, codigo);
}

export async function registrarContaCriada(id: number, conta: ContaCriadaEntrada) {
  return registrarContaNoBanco(db(), id, await usuarioAtualId(), conta);
}

export async function recalcular(id: number) {
  return recalcularNoBanco(db(), id, await usuarioAtualId());
}
