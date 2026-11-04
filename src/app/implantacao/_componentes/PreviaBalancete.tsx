'use client';
import * as React from 'react';
import { useState } from 'react';
import type { ContaBusca, Lancamento } from '../acoes.js';

const brl = (n: number): string => n.toLocaleString('pt-BR', { minimumFractionDigits: 2 });

type Origem = { codigo: string; nome: string; debito: number; credito: number };

type LinhaPrevia = {
  codigo: string;
  classificacao: string;
  descricao: string;
  debito: number;
  credito: number;
  /** As contas de origem que compõem o saldo desta conta do Domínio — um lançamento cada. */
  origens: Origem[];
};

// Monta o balancete como ele vai ficar no Domínio: uma linha por conta do Domínio, ordenada pela
// classificação — organizada como um balancete. Cada conta guarda as origens que a compõem, porque
// no TXT cada origem é um lançamento próprio: é por aqui que se explica de onde veio cada saldo.
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
        descricao: conta?.descricao ?? '',
        debito: 0,
        credito: 0,
        origens: [],
      };
    const debito = l.contaDebito !== null ? l.valor : 0;
    const credito = l.contaCredito !== null ? l.valor : 0;
    linha.debito += debito;
    linha.credito += credito;
    linha.origens.push({ codigo: l.origemCodigo, nome: l.origemNome, debito, credito });
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
  const [verOrigens, setVerOrigens] = useState(true);
  const porCodigo = new Map(contas.map((c) => [c.codigoReduzido, c]));
  const linhas = montar(lancamentos, porCodigo);
  const totalDebito = linhas.reduce((s, l) => s + l.debito, 0);
  const totalCredito = linhas.reduce((s, l) => s + l.credito, 0);

  return (
    <section className="cartao">
      <h2>
        Prévia do balancete no Domínio — {linhas.length} conta(s), {lancamentos.length} lançamento(s)
      </h2>
      <p className="sub">
        Como o balancete fica no plano do Domínio, ordenado pela classificação. Cada conta de origem
        vira um lançamento próprio, com a origem no histórico.
      </p>
      {linhas.length === 0 ? (
        <div className="vazio">Indique as contas no de-para para ver a prévia aqui.</div>
      ) : (
        <>
          <label className="chave">
            <input type="checkbox" checked={verOrigens} onChange={(e) => setVerOrigens(e.target.checked)} />
            Mostrar a origem de cada saldo
          </label>
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
                  <React.Fragment key={l.codigo}>
                    <tr>
                      <td className="cod">{l.codigo}</td>
                      <td className="cod">{l.classificacao || '—'}</td>
                      <td>
                        {l.descricao}
                        {l.origens.length > 1 && (
                          <span className="meta"> · {l.origens.length} origens</span>
                        )}
                      </td>
                      <td className="num">{l.debito ? brl(l.debito) : ''}</td>
                      <td className="num">{l.credito ? brl(l.credito) : ''}</td>
                      <td className="num">
                        {brl(Math.abs(saldo))} {saldo >= 0 ? 'D' : 'C'}
                      </td>
                    </tr>
                    {verOrigens &&
                      l.origens.map((o, i) => (
                        <tr key={`${l.codigo}-${i}`} className="linha-origem">
                          <td />
                          <td colSpan={2}>
                            ↳ veio de <span className="cod">{o.codigo}</span> {o.nome}
                          </td>
                          <td className="num">{o.debito ? brl(o.debito) : ''}</td>
                          <td className="num">{o.credito ? brl(o.credito) : ''}</td>
                          <td />
                        </tr>
                      ))}
                  </React.Fragment>
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
                  <strong>
                    {brl(Math.abs(totalDebito - totalCredito))} {totalDebito - totalCredito >= 0 ? 'D' : 'C'}
                  </strong>
                </td>
              </tr>
            </tbody>
          </table>
        </>
      )}
    </section>
  );
}
