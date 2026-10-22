'use client';
import * as React from 'react';
import type { ContaBusca, Lancamento } from '../acoes.js';

const brl = (n: number): string => n.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
const limparDescricao = (c: string): string => c.replace(/^\s*\|\s*/, '');

type LinhaPrevia = {
  codigo: string;
  classificacao: string;
  descricao: string;
  debito: number;
  credito: number;
};

// Monta o balancete como ele vai ficar no Domínio: uma linha por conta do Domínio (agregando os
// saldos), ordenada pela classificação — organizada como um balancete.
function montar(lancamentos: Lancamento[], porCodigo: Map<string, ContaBusca>): LinhaPrevia[] {
  const mapa = new Map<string, LinhaPrevia>();
  for (const l of lancamentos) {
    const codigo = l.contaDebito ?? l.contaCredito;
    if (codigo === null) continue;
    const conta = porCodigo.get(codigo);
    const linha =
      mapa.get(codigo) ??
      {
        codigo,
        classificacao: conta?.classificacao ?? '',
        descricao: conta?.descricao ?? limparDescricao(l.complemento),
        debito: 0,
        credito: 0,
      };
    if (l.contaDebito !== null) linha.debito += l.valor;
    if (l.contaCredito !== null) linha.credito += l.valor;
    mapa.set(codigo, linha);
  }
  return [...mapa.values()].sort((a, b) =>
    a.classificacao.localeCompare(b.classificacao, 'pt-BR', { numeric: true }),
  );
}

export function PreviaBalancete({
  lancamentos,
  contas,
}: {
  lancamentos: Lancamento[];
  contas: ContaBusca[];
}) {
  const porCodigo = new Map(contas.map((c) => [c.codigoReduzido, c]));
  const linhas = montar(lancamentos, porCodigo);
  const totalDebito = linhas.reduce((s, l) => s + l.debito, 0);
  const totalCredito = linhas.reduce((s, l) => s + l.credito, 0);

  return (
    <section className="cartao">
      <h2>Prévia do balancete no Domínio — {linhas.length} conta(s)</h2>
      <p className="sub">Como o balancete fica no plano do Domínio, ordenado pela classificação.</p>
      {linhas.length === 0 ? (
        <div className="vazio">Indique as contas no de-para para ver a prévia aqui.</div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Código</th>
              <th>Classificação</th>
              <th>Descrição</th>
              <th style={{ textAlign: 'right' }}>Débito</th>
              <th style={{ textAlign: 'right' }}>Crédito</th>
              <th style={{ textAlign: 'right' }}>Saldo</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => {
              const saldo = l.debito - l.credito;
              return (
                <tr key={l.codigo}>
                  <td className="cod">{l.codigo}</td>
                  <td className="cod">{l.classificacao || '—'}</td>
                  <td>{l.descricao}</td>
                  <td className="num">{l.debito ? brl(l.debito) : ''}</td>
                  <td className="num">{l.credito ? brl(l.credito) : ''}</td>
                  <td className="num">
                    {brl(Math.abs(saldo))} {saldo >= 0 ? 'D' : 'C'}
                  </td>
                </tr>
              );
            })}
            <tr className="total">
              <td colSpan={3}>
                <strong>Totais</strong>
              </td>
              <td className="num">
                <strong>{brl(totalDebito)}</strong>
              </td>
              <td className="num">
                <strong>{brl(totalCredito)}</strong>
              </td>
              <td className="num">
                <strong>{brl(Math.abs(totalDebito - totalCredito))} {totalDebito - totalCredito >= 0 ? 'D' : 'C'}</strong>
              </td>
            </tr>
          </tbody>
        </table>
      )}
    </section>
  );
}
