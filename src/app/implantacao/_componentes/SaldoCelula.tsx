'use client';
import * as React from 'react';
import { ladoDoSaldo, ladoEsperadoDaConta, saldoInvertido } from '../../../motor/lado.js';

const brl = (n: number): string => n.toLocaleString('pt-BR', { minimumFractionDigits: 2 });

/**
 * Saldo como num balancete: o VALOR em módulo e, ao lado, D ou C. O sinal sozinho não dizia o lado
 * para quem lê (ativo vinha com menos, passivo sem nada); com o D/C explícito, dá para ver de
 * relance se a conta está no lado certo — e a célula avisa quando não está.
 *
 * `conferirLado` existe para a tela poder DESLIGAR esse aviso: quando o arquivo inteiro veio com a
 * convenção de sinal trocada, toda conta parece invertida, e apontar uma por uma só esconde o
 * problema de verdade, que é o arquivo. Nesse caso o aviso sai uma vez, no alto da tela.
 */
export function SaldoCelula({
  saldoAtual,
  natureza,
  nome = '',
  conferirLado = true,
}: {
  saldoAtual: number;
  natureza: string;
  /** Nome da conta na origem, para reconhecer conta redutora ("(-) Prejuízos Acumulados"). */
  nome?: string;
  conferirLado?: boolean;
}) {
  const lado = ladoDoSaldo(saldoAtual);
  const invertido = conferirLado && saldoInvertido(saldoAtual, natureza, nome);
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
            className="status-atencao"
            title={`Conta de natureza ${natureza}, que normalmente fica em ${
              ladoEsperadoDaConta(natureza, nome) === 'D' ? 'débito (D)' : 'crédito (C)'
            }. Confira o lançamento na origem — pode ser proposital.`}
          >
            conferir o lado
          </span>
        </>
      )}
    </td>
  );
}
