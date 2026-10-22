'use client';
import * as React from 'react';
import { iniciarERedirecionar } from '../acoes.js';

export function Mesa({ aberta }: { aberta: number | null }) {
  return (
    <main>
      <h1><span className="marca-glow">Implement Balance</span></h1>
      <p className="sub">
        Converte o balancete de origem no arquivo de importação posicional do Domínio (leiaute 19).
      </p>
      {aberta !== null ? (
        <section className="cartao">
          <h2>Minha mesa</h2>
          <p>Você tem uma implantação em andamento.</p>
          <div className="linha-acoes">
            <a className="botao" href={`/implantacao/${aberta}`}>
              Continuar implantação
            </a>
            <form action={iniciarERedirecionar}>
              <button type="submit" className="secundario">
                Começar uma nova
              </button>
            </form>
          </div>
        </section>
      ) : (
        <section className="cartao">
          <h2>Minha mesa</h2>
          <p>Nenhuma implantação aberta.</p>
          <form action={iniciarERedirecionar}>
            <button type="submit">Iniciar nova implantação</button>
          </form>
        </section>
      )}
    </main>
  );
}
