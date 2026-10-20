'use client';
import * as React from 'react';
import { useState } from 'react';
import type { ContaBusca } from '../acoes.js';

export function BuscaConta({
  contas,
  onSelecionar,
}: {
  contas: ContaBusca[];
  onSelecionar: (codigo: string) => void;
}) {
  const [termo, setTermo] = useState('');
  const t = termo.trim().toLowerCase();
  const encontrados =
    t === ''
      ? []
      : contas
          .filter(
            (c) =>
              c.descricao.toLowerCase().includes(t) || c.codigoReduzido.toLowerCase().includes(t),
          )
          .slice(0, 30);

  return (
    <div>
      <input
        type="text"
        placeholder="Usar só aqui: buscar conta por nome ou código"
        value={termo}
        onChange={(e) => setTermo(e.target.value)}
      />
      {encontrados.length > 0 && (
        <div className="busca-resultado">
          {encontrados.map((c) => (
            <div
              key={c.codigoReduzido}
              className="busca-item"
              role="button"
              onClick={() => onSelecionar(c.codigoReduzido)}
            >
              <span>
                <strong>{c.codigoReduzido}</strong> — {c.descricao}
              </span>
              <span className="meta">
                class. {c.classificacao} · {c.natureza || 'sem natureza'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
