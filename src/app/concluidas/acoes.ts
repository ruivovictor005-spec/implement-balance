'use server';
import { db } from '../../dados/cliente.js';
import {
  exportarConcluidas as exportarNoBanco,
  listarConcluidas as listarNoBanco,
} from '../implantacao/concluir.js';

export type { ConcluidaResumo } from '../implantacao/concluir.js';

export async function listarConcluidas() {
  return listarNoBanco(db());
}

export async function exportarConcluidas(): Promise<Uint8Array> {
  return exportarNoBanco(db());
}
