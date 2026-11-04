import * as React from 'react';
import { auth } from '../../acesso/auth.js';
import { db } from '../../dados/cliente.js';
import { ehAdmin } from '../../dados/sinonimos.js';
import { PainelAdmin } from './PainelAdmin.js';

// Só o administrador vê o painel. O papel é conferido no banco a cada acesso; as ações do painel
// conferem de novo no servidor.
export default async function Pagina() {
  const sessao = await auth();
  const uid = (sessao as { uid?: number } | null)?.uid;
  const admin = uid !== undefined && uid !== null && (await ehAdmin(db(), uid));
  if (!admin) {
    return (
      <main>
        <h1>Administração</h1>
        <div className="cartao">
          <p className="sub">Esta área é restrita ao administrador.</p>
          <a href="/">← Voltar para a mesa</a>
        </div>
      </main>
    );
  }
  return <PainelAdmin />;
}
