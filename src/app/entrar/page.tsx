import * as React from 'react';
import { signIn } from '../../acesso/auth.js';

export default function Entrar() {
  return (
    <main>
      <h1>Implantação de Saldos</h1>
      <p className="sub">Entre com sua conta Microsoft para continuar.</p>
      <section className="cartao">
        <form
          action={async () => {
            'use server';
            await signIn('microsoft-entra-id', { redirectTo: '/' });
          }}
        >
          <button type="submit">Entrar com a conta Microsoft</button>
        </form>
      </section>
    </main>
  );
}
