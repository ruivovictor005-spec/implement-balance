'use client';
import * as React from 'react';
import { useState } from 'react';
import type { Celula } from '../../../leitores/ler-arquivo.js';

// Rede de segurança (spec §7): quando o layout não é reconhecido, a pessoa aponta qual coluna é
// qual. Não é o caminho normal.
const CAMPOS: { chave: string; rotulo: string }[] = [
  { chave: 'codiCta', rotulo: 'Código da conta' },
  { chave: 'nomeCta', rotulo: 'Nome da conta' },
  { chave: 'clasCta', rotulo: 'Classificação' },
  { chave: 'tipoCta', rotulo: 'Tipo (A/S)' },
  { chave: 'saldoAnterior', rotulo: 'Saldo anterior' },
  { chave: 'totalDebito', rotulo: 'Total débito' },
  { chave: 'totalCredito', rotulo: 'Total crédito' },
  { chave: 'saldoAtual', rotulo: 'Saldo atual' },
];

export function MapeamentoColunas({
  previa,
  onConfirmar,
}: {
  previa: Celula[][];
  onConfirmar: (linhaCabecalho: number, colunas: Record<string, number>) => void;
}) {
  const [linhaCab, setLinhaCab] = useState(0);
  const [mapa, setMapa] = useState<Record<string, string>>({});
  const totalColunas = Math.max(0, ...previa.map((l) => l.length));
  const colunas = Array.from({ length: totalColunas }, (_, i) => i);
  const rotuloColuna = (i: number): string => {
    const c = previa[linhaCab]?.[i];
    return c === null || c === undefined || c === '' ? `coluna ${i + 1}` : String(c);
  };

  return (
    <section className="cartao">
      <h2>Apontar as colunas manualmente</h2>
      <p className="sub">O layout não foi reconhecido. Indique a linha do cabeçalho e qual coluna é cada campo.</p>
      <div className="grade">
        <div>
          <label htmlFor="linha-cab">Linha do cabeçalho</label>
          <select id="linha-cab" value={linhaCab} onChange={(e) => setLinhaCab(Number(e.target.value))}>
            {previa.map((_, i) => (
              <option key={i} value={i}>
                Linha {i + 1}
              </option>
            ))}
          </select>
        </div>
        {CAMPOS.map((campo) => (
          <div key={campo.chave}>
            <label htmlFor={`map-${campo.chave}`}>{campo.rotulo}</label>
            <select
              id={`map-${campo.chave}`}
              value={mapa[campo.chave] ?? ''}
              onChange={(e) => setMapa({ ...mapa, [campo.chave]: e.target.value })}
            >
              <option value="">—</option>
              {colunas.map((i) => (
                <option key={i} value={i}>
                  {rotuloColuna(i)}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>
      <div className="linha-acoes">
        <button
          type="button"
          onClick={() => {
            const colunasEscolhidas: Record<string, number> = {};
            for (const [chave, v] of Object.entries(mapa)) {
              if (v !== '') colunasEscolhidas[chave] = Number(v);
            }
            onConfirmar(linhaCab + 1, colunasEscolhidas);
          }}
        >
          Usar este mapeamento
        </button>
      </div>
    </section>
  );
}
