// Entrada da pessoa pela conta Microsoft: cria ou atualiza o usuário e registra a auditoria.
// A identidade é o `oid` do Entra ID, NUNCA o e-mail (o e-mail pode mudar; o oid não). O papel
// nasce `usuario`, exceto a primeira pessoa a entrar no banco vazio, que vira `admin`.
import { eq, sql } from 'drizzle-orm';
import type { PgDatabase } from 'drizzle-orm/pg-core';
import { conferirSenha, criarHashSenha, gerarCodigoRecuperacao } from '../acesso/senha.js';
import { auditar } from '../observabilidade/auditar.js';
import { usuario } from './schema.js';

export type PerfilEntra = { oid: string; email?: string; nome?: string };
export type Usuario = typeof usuario.$inferSelect;

type Banco = PgDatabase<any, any, any>;
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const RECUPERACAO_MINUTOS = 30;

const porEmail = (banco: Banco, email: string) =>
  banco.select().from(usuario).where(sql`lower(${usuario.email}) = ${email}`).limit(1);

/** Cadastro próprio: nome completo, e-mail corporativo e senha. A 1ª conta do sistema vira admin. */
export async function cadastrarUsuario(
  banco: Banco,
  entrada: { nome: string; email: string; senha: string },
): Promise<Usuario> {
  const nome = entrada.nome.trim();
  const email = entrada.email.trim().toLowerCase();
  if (nome.length < 3 || !nome.includes(' ')) throw new Error('Informe o nome completo.');
  if (!EMAIL_RE.test(email)) throw new Error('E-mail inválido.');
  if (entrada.senha.length < 8) throw new Error('A senha precisa de ao menos 8 caracteres.');

  const [jaTem] = await porEmail(banco, email);
  if (jaTem !== undefined) throw new Error('Já existe uma conta com esse e-mail.');

  const [{ total }] = await banco.select({ total: sql<number>`count(*)::int` }).from(usuario);
  const papel: 'usuario' | 'admin' = total === 0 ? 'admin' : 'usuario';

  const [novo] = await banco
    .insert(usuario)
    .values({
      oidEntra: `cred:${email}`,
      email,
      nome,
      senhaHash: criarHashSenha(entrada.senha),
      papel,
      ultimoAcessoEm: new Date(),
    })
    .returning();
  await auditar(banco, {
    usuarioId: novo.id,
    acao: 'cadastro',
    entidade: 'usuario',
    entidadeId: String(novo.id),
    detalhes: { origem: 'cadastro-proprio', primeiroAcesso: papel === 'admin' },
  });
  return novo;
}

/** Confere e-mail + senha. Devolve o usuário ou null (nunca diz qual dos dois falhou). */
export async function autenticar(banco: Banco, email: string, senha: string): Promise<Usuario | null> {
  const [u] = await porEmail(banco, email.trim().toLowerCase());
  if (u === undefined || !u.ativo) return null;
  if (!conferirSenha(senha, u.senhaHash)) return null;
  await banco.update(usuario).set({ ultimoAcessoEm: new Date() }).where(eq(usuario.id, u.id));
  return u;
}

/**
 * Pedido de recuperação: a pessoa informa o NOME completo e o e-mail; se baterem, gera um código
 * (guardado só como hash, com validade) e o devolve para ser enviado por e-mail. Retorna null se não
 * casar — a tela mostra a mesma mensagem nos dois casos, para não revelar quem tem conta.
 */
export async function solicitarRecuperacao(
  banco: Banco,
  nome: string,
  email: string,
): Promise<{ usuario: Usuario; codigo: string } | null> {
  const [u] = await porEmail(banco, email.trim().toLowerCase());
  if (u === undefined || u.nome.trim().toLowerCase() !== nome.trim().toLowerCase()) return null;
  const codigo = gerarCodigoRecuperacao();
  await banco
    .update(usuario)
    .set({
      recuperacaoCodigoHash: criarHashSenha(codigo),
      recuperacaoExpira: new Date(Date.now() + RECUPERACAO_MINUTOS * 60_000),
    })
    .where(eq(usuario.id, u.id));
  return { usuario: u, codigo };
}

/** Redefine a senha com o código recebido por e-mail (dentro da validade). */
export async function redefinirSenha(
  banco: Banco,
  email: string,
  codigo: string,
  novaSenha: string,
): Promise<boolean> {
  const [u] = await porEmail(banco, email.trim().toLowerCase());
  if (u === undefined || u.recuperacaoCodigoHash == null || u.recuperacaoExpira == null) return false;
  if (new Date(u.recuperacaoExpira).getTime() < Date.now()) return false;
  if (!conferirSenha(codigo.trim(), u.recuperacaoCodigoHash)) return false;
  if (novaSenha.length < 8) throw new Error('A senha precisa de ao menos 8 caracteres.');
  await banco
    .update(usuario)
    .set({ senhaHash: criarHashSenha(novaSenha), recuperacaoCodigoHash: null, recuperacaoExpira: null })
    .where(eq(usuario.id, u.id));
  await auditar(banco, {
    usuarioId: u.id,
    acao: 'redefinir_senha',
    entidade: 'usuario',
    entidadeId: String(u.id),
  });
  return true;
}

export async function registrarEntrada(
  banco: PgDatabase<any, any, any>,
  perfil: PerfilEntra,
): Promise<Usuario> {
  const oid = perfil.oid?.trim() ?? '';
  if (oid === '') throw new Error('Conta sem oid: identidade do Entra ID não reconhecida.');

  const agora = new Date();
  const [existente] = await banco.select().from(usuario).where(eq(usuario.oidEntra, oid)).limit(1);

  if (existente !== undefined) {
    const [atualizado] = await banco
      .update(usuario)
      .set({
        email: perfil.email ?? existente.email,
        nome: perfil.nome ?? existente.nome,
        ultimoAcessoEm: agora,
      })
      .where(eq(usuario.id, existente.id))
      .returning();
    await auditar(banco, {
      usuarioId: atualizado.id,
      acao: 'entrada',
      entidade: 'usuario',
      entidadeId: String(atualizado.id),
      detalhes: { origem: 'microsoft-entra-id' },
    });
    return atualizado;
  }

  const [{ total }] = await banco.select({ total: sql<number>`count(*)::int` }).from(usuario);
  const papel: 'usuario' | 'admin' = total === 0 ? 'admin' : 'usuario';

  const [novo] = await banco
    .insert(usuario)
    .values({
      oidEntra: oid,
      email: perfil.email ?? '',
      nome: perfil.nome ?? '',
      papel,
      ultimoAcessoEm: agora,
    })
    .returning();
  await auditar(banco, {
    usuarioId: novo.id,
    acao: 'entrada',
    entidade: 'usuario',
    entidadeId: String(novo.id),
    detalhes: { origem: 'microsoft-entra-id', primeiroAcesso: papel === 'admin' },
  });
  return novo;
}
