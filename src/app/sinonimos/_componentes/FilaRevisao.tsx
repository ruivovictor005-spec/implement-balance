'use client';
import * as React from 'react';
import type { PedidoPendente } from '../acoes.js';

export function FilaRevisao({
  pendentes,
  onDecidir,
}: {
  pendentes: PedidoPendente[];
  onDecidir: (id: number, aprovada: boolean) => void;
}) {
  return (
    <section className="cartao">
      <h2>Pedidos de alteração pendentes</h2>
      {pendentes.length === 0 ? (
        <p className="sub">Nada para revisar.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Conta</th>
              <th>De → Para</th>
              <th>Motivo</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {pendentes.map((p) => (
              <tr key={p.id}>
                <td>{p.nomeOriginal}</td>
                <td>
                  {p.codigoAtual} → <strong>{p.codigoProposto}</strong>
                </td>
                <td>{p.motivo}</td>
                <td>
                  <div className="linha-acoes">
                    <button type="button" onClick={() => onDecidir(p.id, true)}>
                      Aprovar
                    </button>
                    <button type="button" className="secundario" onClick={() => onDecidir(p.id, false)}>
                      Rejeitar
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
