// Entrada da pessoa pela conta Microsoft: cria ou atualiza o usuário e registra a auditoria.
// A identidade é o `oid` do Entra ID, NUNCA o e-mail (o e-mail pode mudar; o oid não). O papel
// nasce `usuario`, exceto a primeira pessoa a entrar no banco vazio, que vira `admin`.
import { eq, sql } from 'drizzle-orm';
import type { PgDatabase } from 'drizzle-orm/pg-core';
import { auditar } from '../observabilidade/auditar.js';
import { usuario } from './schema.js';

export type PerfilEntra = { oid: string; email?: string; nome?: string };
export type Usuario = typeof usuario.$inferSelect;

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
