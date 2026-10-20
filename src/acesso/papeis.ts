// Papéis do site, locais (não vêm do Entra ID): usuário < revisor < admin.
export type Papel = 'usuario' | 'revisor' | 'admin';

const nivel: Record<Papel, number> = { usuario: 0, revisor: 1, admin: 2 };

export const podeRevisar = (u: { papel: string }): boolean =>
  (nivel[u.papel as Papel] ?? -1) >= nivel.revisor;

export const podeAdministrar = (u: { papel: string }): boolean =>
  (nivel[u.papel as Papel] ?? -1) >= nivel.admin;

/** Garante que o usuário tem pelo menos o papel exigido; senão, lança. */
export function exigirPapel(necessario: Papel, u: { papel: string }): void {
  if ((nivel[u.papel as Papel] ?? -1) < nivel[necessario]) {
    throw new Error(`Ação restrita ao papel "${necessario}"; o seu é "${u.papel}".`);
  }
}
