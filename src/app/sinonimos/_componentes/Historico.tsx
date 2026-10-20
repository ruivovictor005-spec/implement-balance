'use client';
import * as React from 'react';
import type { EventoRecente } from '../acoes.js';

export function Historico({
  eventos,
  onDesfazer,
}: {
  eventos: EventoRecente[];
  onDesfazer: (eventoId: number) => void;
}) {
  return (
    <section className="cartao">
      <h2>Histórico</h2>
      {eventos.length === 0 ? (
        <p className="sub">Sem eventos ainda.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Conta</th>
              <th>O quê</th>
              <th>De → Para</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {eventos.map((e) => (
              <tr key={e.id}>
                <td>{e.nomeOriginal}</td>
                <td>{e.tipo}</td>
                <td>
                  {e.codigoDe ?? '—'} → {e.codigoPara ?? '—'}
                </td>
                <td>
                  {e.codigoDe ? (
                    <button type="button" className="secundario" onClick={() => onDesfazer(e.id)}>
                      Desfazer
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
