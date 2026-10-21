'use client';
import * as React from 'react';
import type { Lancamento } from '../acoes.js';

const brl = (n: number): string => n.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
const descricao = (complemento: string): string => complemento.replace(/^\s*\|\s*/, '');

// Como o balancete fica no modelo Domínio: uma linha por lançamento (débito ou crédito), com os
// totais no fim — o que efetivamente vai no TXT de importação.
export function PreviaDominio({ lancamentos }: { lancamentos: Lancamento[] }) {
  const totalDebito = lancamentos.reduce((s, l) => (l.contaDebito !== null ? s + l.valor : s), 0);
  const totalCredito = lancamentos.reduce((s, l) => (l.contaCredito !== null ? s + l.valor : s), 0);

  return (
    <section className="cartao">
      <h2>Prévia do balancete no Domínio — {lancamentos.length} lançamento(s)</h2>
      {lancamentos.length === 0 ? (
        <p className="sub">Resolva as contas para ver a prévia.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Conta Domínio</th>
              <th>Descrição</th>
              <th style={{ textAlign: 'right' }}>Débito</th>
              <th style={{ textAlign: 'right' }}>Crédito</th>
            </tr>
          </thead>
          <tbody>
            {lancamentos.map((l, i) => (
              <tr key={`${l.contaDebito ?? l.contaCredito}-${i}`}>
                <td>
                  <strong>{l.contaDebito ?? l.contaCredito}</strong>
                </td>
                <td>{descricao(l.complemento)}</td>
                <td className="num">{l.contaDebito !== null ? brl(l.valor) : ''}</td>
                <td className="num">{l.contaCredito !== null ? brl(l.valor) : ''}</td>
              </tr>
            ))}
            <tr>
              <td />
              <td>
                <strong>Totais</strong>
              </td>
              <td className="num">
                <strong>{brl(totalDebito)}</strong>
              </td>
              <td className="num">
                <strong>{brl(totalCredito)}</strong>
              </td>
            </tr>
          </tbody>
        </table>
      )}
    </section>
  );
}
