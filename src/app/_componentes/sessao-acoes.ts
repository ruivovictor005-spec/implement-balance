'use server';
import { signOut } from '../../acesso/auth.js';

export async function sair(): Promise<void> {
  await signOut({ redirectTo: '/entrar' });
}
