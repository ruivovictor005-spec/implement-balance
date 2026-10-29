'use client';
import * as React from 'react';
import { ladoDoSaldo, ladoEsperado, saldoInvertido } from '../../../motor/lado.js';

const brl = (n: number): string => n.toLocaleString('pt-BR', { minimumFractionDigits: 2 });

/**
 * Saldo como num balancete: o VALOR em módulo e, ao lado, D ou C. O sinal sozinho não dizia o lado
 * para quem lê (ativo vinha com menos, passivo sem nada); com o D/C explícito, dá para ver de
 * relance se a conta está no lado certo — e a célula avisa quando não está.
 */
export function SaldoCelula({ saldoAtual, natureza }: { saldoAtual: number; natureza: string }) {
  const lado = ladoDoSaldo(saldoAtual);
  const invertido = saldoInvertido(saldoAtual, natureza);
  return (
    <td className="num">
      {brl(Math.abs(saldoAtual))}{' '}
      {lado === null ? (
        <span className="meta">—</span>
      ) : (
        <span className={invertido ? 'lado-invertido' : 'lado'}>{lado}</span>
      )}
      {invertido && (
        <>
          <br />
          <span
            className="status-pend"
            title={`Conta de natureza ${natureza}, que normalmente fica em ${
              ladoEsperado(natureza) === 'D' ? 'débito (D)' : 'crédito (C)'
            }. Confira o lançamento na origem.`}
          >
            saldo invertido
          </span>
        </>
      )}
    </td>
  );
}
