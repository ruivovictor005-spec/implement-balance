'use client';
import * as React from 'react';
import { useState } from 'react';
import type { ContaCriadaEntrada } from '../acoes.js';

export function RegistrarContaCriada({
  onRegistrar,
}: {
  onRegistrar: (conta: ContaCriadaEntrada) => void;
}) {
  const [codigoReduzido, setCod] = useState('');
  const [descricao, setDesc] = useState('');
  const [classificacao, setClas] = useState('');
  const valido = codigoReduzido.trim() !== '' && descricao.trim() !== '' && classificacao.trim() !== '';

  return (
    <section className="cartao">
      <h2>Registrar conta criada (vale nesta sessão)</h2>
      <div className="grade">
        <div>
          <label htmlFor="cc-cod">Código reduzido</label>
          <input id="cc-cod" type="text" value={codigoReduzido} onChange={(e) => setCod(e.target.value)} />
        </div>
        <div>
          <label htmlFor="cc-desc">Descrição</label>
          <input id="cc-desc" type="text" value={descricao} onChange={(e) => setDesc(e.target.value)} />
        </div>
        <div>
          <label htmlFor="cc-clas">Classificação</label>
          <input id="cc-clas" type="text" value={classificacao} onChange={(e) => setClas(e.target.value)} />
        </div>
      </div>
      <div className="linha-acoes">
        <button
          type="button"
          className="secundario"
          disabled={!valido}
          onClick={() => {
            onRegistrar({
              codigoReduzido: codigoReduzido.trim(),
              descricao: descricao.trim(),
              classificacao: classificacao.trim(),
            });
            setCod('');
            setDesc('');
            setClas('');
          }}
        >
          Adicionar conta
        </button>
      </div>
    </section>
  );
}
