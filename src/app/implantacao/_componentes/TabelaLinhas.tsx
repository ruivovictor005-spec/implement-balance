'use client';
import * as React from 'react';
import { useState } from 'react';
import type { LinhaResolvida } from '../../../motor/converter.js';
import type { ContaBusca } from '../acoes.js';
import { BuscaConta } from './BuscaConta.js';
import { LinhaPendente } from './LinhaPendente.js';
import { SaldoCelula } from './SaldoCelula.js';

// Linha já resolvida: mostra o grupo (classificação + natureza) e deixa ALTERAR a conta a qualquer
// momento — inclusive para corrigir uma classificação que o motor resolveu para outra natureza.
function LinhaResolvidaRow({
  linha,
  contas,
  onUsarSoAqui,
}: {
  linha: LinhaResolvida;
  contas: ContaBusca[];
  onUsarSoAqui: (codiCta: string, codigo: string) => void;
}) {
  const [editando, setEditando] = useState(false);
  const atencao = linha.status.toLowerCase().includes('conferir');
  return (
    <tr data-codi={linha.codiCta} data-origem={linha.origem}>
      <td>{linha.codiCta}</td>
      <td>
        {linha.nomeCta}
        <br />
        <span className={atencao ? 'status-pend' : 'meta'}>
          {linha.codigo ? `→ ${linha.codigo} · ` : ''}
          {linha.status}
        </span>
        <br />
        <span className="meta">
          grupo: classif. {linha.clasCta || '—'} · {linha.natureza || 'sem natureza'}
        </span>
        <div className="linha-acoes">
          <button type="button" className="secundario" onClick={() => setEditando((e) => !e)}>
            {editando ? 'Cancelar' : 'Alterar conta'}
          </button>
        </div>
        {editando && (
          <BuscaConta
            contas={contas}
            onSelecionar={(codigo) => {
              onUsarSoAqui(linha.codiCta, codigo);
              setEditando(false);
            }}
          />
        )}
      </td>
      <SaldoCelula saldoAtual={linha.saldoAtual} natureza={linha.natureza} />
    </tr>
  );
}

export function TabelaLinhas({
  linhas,
  contas,
  onUsarSoAqui,
}: {
  linhas: LinhaResolvida[];
  contas: ContaBusca[];
  onUsarSoAqui: (codiCta: string, codigo: string) => void;
}) {
  // Pendentes primeiro (o que precisa de decisão), depois as já resolvidas. Todas aparecem juntas,
  // sem obrigar a filtrar.
  const pendentes = linhas.filter((l) => l.origem === 'nao_encontrado');
  const resolvidas = linhas.filter((l) => l.origem !== 'nao_encontrado');

  return (
    <section className="cartao">
      <h2>
        Linhas do balancete — {pendentes.length} pendente(s), {resolvidas.length} resolvida(s)
      </h2>
      <table>
        <thead>
          <tr>
            <th>Cód. origem</th>
            <th>Conta / grupo</th>
            <th style={{ textAlign: 'right' }}>Saldo atual (D/C)</th>
          </tr>
        </thead>
        <tbody>
          {pendentes.map((l) => (
            <LinhaPendente key={`p-${l.codiCta}`} linha={l} contas={contas} onUsarSoAqui={onUsarSoAqui} />
          ))}
          {resolvidas.map((l) => (
            <LinhaResolvidaRow key={`r-${l.codiCta}`} linha={l} contas={contas} onUsarSoAqui={onUsarSoAqui} />
          ))}
        </tbody>
      </table>
    </section>
  );
}
