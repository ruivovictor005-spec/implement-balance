'use client';
import * as React from 'react';
import { useState } from 'react';
import type { ContaBusca } from '../acoes.js';

// Painel lateral para consultar o plano de contas do Domínio SEM sair do de-para.
// Filtra em memória (a tela já carregou o plano), então é instantâneo.
export function PlanoDrawer({
  contas,
  aberto,
  onFechar,
}: {
  contas: ContaBusca[];
  aberto: boolean;
  onFechar: () => void;
}) {
  const [termo, setTermo] = useState('');
  const t = termo.trim().toLowerCase();
  const encontrados =
    t === ''
      ? contas.slice(0, 80)
      : contas
          .filter(
            (c) =>
              c.descricao.toLowerCase().includes(t) ||
              c.codigoReduzido.toLowerCase().includes(t) ||
              c.classificacao.toLowerCase().includes(t),
          )
          .slice(0, 120);

  if (!aberto) return null;

  return (
    <div className="drawer-fundo" onClick={onFechar}>
      <aside className="drawer" onClick={(e) => e.stopPropagation()} aria-label="Plano de contas">
        <div className="drawer-topo">
          <h2>Plano de contas do Domínio</h2>
          <button type="button" className="secundario pequeno" onClick={onFechar}>
            Fechar ✕
          </button>
        </div>
        <input
          type="text"
          autoFocus
          placeholder="Buscar por nome, código ou classificação"
          value={termo}
          onChange={(e) => setTermo(e.target.value)}
        />
        <p className="meta" style={{ margin: '8px 0 0' }}>
          {t === '' ? `${contas.length} contas no plano` : `${encontrados.length} resultado(s)`}
        </p>
        <div className="drawer-lista">
          {encontrados.map((c) => (
            <div key={c.codigoReduzido} className="drawer-item">
              <div>
                <strong className="cod">{c.codigoReduzido}</strong> {c.descricao}
              </div>
              <div className="meta">
                class. {c.classificacao} · {c.natureza || 'sem natureza'} ·{' '}
                {c.tipo === 'S' ? 'grupo (sintética)' : 'analítica'}
              </div>
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}
