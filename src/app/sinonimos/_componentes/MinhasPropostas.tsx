'use client';
import * as React from 'react';
import type { MinhaProposta } from '../../../dados/sinonimos.js';

const ROTULO: Record<MinhaProposta['status'], string> = {
  pendente: 'Aguardando aprovação',
  ativo: 'Aprovado — vale para todos',
  rejeitado: 'Rejeitado',
  arquivado: 'Substituído',
};

export function MinhasPropostas({ propostas }: { propostas: MinhaProposta[] }) {
  return (
    <section className="cartao">
      <h2>Minhas propostas</h2>
      {propostas.length === 0 ? (
        <p className="sub">Você ainda não propôs sinônimos.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Nome no balancete</th>
              <th>Código</th>
              <th>Situação</th>
              <th>Observação do administrador</th>
            </tr>
          </thead>
          <tbody>
            {propostas.map((p) => (
              <tr key={p.id}>
                <td>{p.nomeOriginal}</td>
                <td className="cod">{p.codigo}</td>
                <td className={p.status === 'pendente' ? 'status-pend' : undefined}>{ROTULO[p.status]}</td>
                <td>{p.observacaoDecisao ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
