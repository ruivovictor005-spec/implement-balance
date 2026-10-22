'use client';
import * as React from 'react';

export type AbaId = 'config' | 'depara' | 'previa' | 'pendencias';

const ITENS: { id: AbaId; rotulo: string }[] = [
  { id: 'config', rotulo: 'Configuração' },
  { id: 'depara', rotulo: 'De-para' },
  { id: 'previa', rotulo: 'Prévia Domínio' },
  { id: 'pendencias', rotulo: 'Pendências' },
];

// Navegação por abas da tela de implantação: um clique troca a visão, sem rolar a página.
export function Abas({
  aba,
  onAba,
  pendentes,
  total,
}: {
  aba: AbaId;
  onAba: (a: AbaId) => void;
  pendentes: number;
  total: number;
}) {
  const badge = (id: AbaId): number | null => {
    if (id === 'pendencias') return pendentes;
    if (id === 'depara') return total;
    return null;
  };
  return (
    <div className="abas" role="tablist" aria-label="Seções da implantação">
      {ITENS.map((it) => {
        const n = badge(it.id);
        const alerta = it.id === 'pendencias' && pendentes > 0;
        return (
          <button
            key={it.id}
            role="tab"
            type="button"
            aria-selected={aba === it.id}
            className={`aba${aba === it.id ? ' ativa' : ''}`}
            onClick={() => onAba(it.id)}
          >
            {it.rotulo}
            {n !== null && n > 0 && <span className={`aba-badge${alerta ? ' alerta' : ''}`}>{n}</span>}
          </button>
        );
      })}
    </div>
  );
}
