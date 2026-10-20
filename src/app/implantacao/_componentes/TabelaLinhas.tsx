'use client';
import * as React from 'react';
import { useState } from 'react';
import type { LinhaResolvida } from '../../../motor/converter.js';
import type { ContaBusca } from '../acoes.js';
import { LinhaPendente } from './LinhaPendente.js';

const brl = (n: number): string => n.toLocaleString('pt-BR', { minimumFractionDigits: 2 });

export function TabelaLinhas({
  linhas,
  contas,
  onUsarSoAqui,
}: {
  linhas: LinhaResolvida[];
  contas: ContaBusca[];
  onUsarSoAqui: (codiCta: string, codigo: string) => void;
}) {
  const [filtro, setFiltro] = useState('todos');
  const statuses = Array.from(new Set(linhas.map((l) => l.status)));
  const passa = (l: LinhaResolvida): boolean => filtro === 'todos' || l.status === filtro;

  // Pendentes primeiro (o que precisa de decisão), depois as já resolvidas.
  const pendentes = linhas.filter((l) => l.origem === 'nao_encontrado').filter(passa);
  const resolvidas = linhas.filter((l) => l.origem !== 'nao_encontrado').filter(passa);

  return (
    <section className="cartao">
      <h2>Linhas do balancete</h2>
      <div className="filtro">
        <label htmlFor="filtro" style={{ margin: 0 }}>
          Filtrar por status
        </label>
        <select id="filtro" value={filtro} onChange={(e) => setFiltro(e.target.value)}>
          <option value="todos">Todos</option>
          {statuses.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
      <table>
        <thead>
          <tr>
            <th>Cód. origem</th>
            <th>Conta</th>
            <th style={{ textAlign: 'right' }}>Saldo atual</th>
          </tr>
        </thead>
        <tbody>
          {pendentes.map((l) => (
            <LinhaPendente key={`p-${l.codiCta}`} linha={l} contas={contas} onUsarSoAqui={onUsarSoAqui} />
          ))}
          {resolvidas.map((l) => (
            <tr key={`r-${l.codiCta}`} data-codi={l.codiCta} data-origem={l.origem}>
              <td>{l.codiCta}</td>
              <td>
                {l.nomeCta}
                <br />
                <span className="meta">
                  {l.codigo ? `→ ${l.codigo} · ` : ''}
                  {l.status}
                </span>
              </td>
              <td className="num">{brl(l.saldoAtual)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
