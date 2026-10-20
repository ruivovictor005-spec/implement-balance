'use client';
import * as React from 'react';
import { useRef, useState } from 'react';
import type { Reconhecimento } from '../acoes.js';

export function AreaArquivo({
  nomeArquivo,
  reconhecimento,
  erro,
  onArquivo,
}: {
  nomeArquivo: string | null;
  reconhecimento: Reconhecimento | null;
  erro: string | null;
  onArquivo: (arquivo: File) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [sobre, setSobre] = useState(false);

  return (
    <section className="cartao">
      <h2>Balancete de origem</h2>
      <div
        className={`area-arquivo${sobre ? ' sobre' : ''}`}
        onClick={() => input.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setSobre(true);
        }}
        onDragLeave={() => setSobre(false)}
        onDrop={(e) => {
          e.preventDefault();
          setSobre(false);
          const f = e.dataTransfer.files[0];
          if (f) onArquivo(f);
        }}
      >
        {nomeArquivo ? <strong>{nomeArquivo}</strong> : 'Arraste o balancete aqui ou clique para escolher'}
        <div className="desabilitado-nota">.xlsx, .xlsm, .csv ou .txt</div>
      </div>
      <input
        ref={input}
        type="file"
        accept=".xlsx,.xlsm,.csv,.txt"
        style={{ display: 'none' }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onArquivo(f);
        }}
      />
      {reconhecimento && (
        <div className="reconhecido">
          Reconheci balancete {reconhecimento.perfilNome} — {reconhecimento.linhas} linhas,{' '}
          {reconhecimento.analiticas} analíticas, {reconhecimento.sinteticas} sintéticas ignoradas.
        </div>
      )}
      {erro && <div className="erro">{erro}</div>}
    </section>
  );
}
