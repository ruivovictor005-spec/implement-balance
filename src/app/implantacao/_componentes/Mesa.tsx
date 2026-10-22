'use client';
import * as React from 'react';
import { iniciarERedirecionar, type ImplantacaoAberta } from '../acoes.js';

const dataBR = (d: Date | string): string =>
  new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });

export function Mesa({ abertas }: { abertas: ImplantacaoAberta[] }) {
  return (
    <main className="home">
      <h1>
        <span className="marca-glow">Implement Balance</span>
      </h1>
      <p className="sub">
        Converte o balancete de origem no arquivo de importação posicional do Domínio (leiaute 19).
      </p>

      <section className="cartao">
        <h2>Suas implantações em andamento</h2>
        {abertas.length === 0 ? (
          <p className="sub" style={{ margin: '0 0 4px' }}>
            Nenhuma implantação aberta. Comece uma nova para implantar os saldos de uma empresa.
          </p>
        ) : (
          <ul className="lista-abertas">
            {abertas.map((a) => (
              <li key={a.id}>
                <a className="item-aberta" href={`/implantacao/${a.id}`}>
                  <span className="item-nome">
                    {a.empresaNome && a.empresaNome.trim() !== ''
                      ? a.empresaNome
                      : 'Empresa sem nome'}
                  </span>
                  <span className="meta">
                    {a.empresaCnpj && a.empresaCnpj.trim() !== '' ? `${a.empresaCnpj} · ` : ''}
                    aberta em {dataBR(a.iniciadaEm)}
                  </span>
                  <span className="item-seta" aria-hidden="true">
                    Continuar →
                  </span>
                </a>
              </li>
            ))}
          </ul>
        )}
        <form action={iniciarERedirecionar} style={{ marginTop: 14 }}>
          <button type="submit" className={abertas.length === 0 ? undefined : 'secundario'}>
            + Começar uma nova
          </button>
        </form>
      </section>
    </main>
  );
}
