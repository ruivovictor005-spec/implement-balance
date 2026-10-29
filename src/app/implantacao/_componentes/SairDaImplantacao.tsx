'use client';
import * as React from 'react';

// Perguntado quando a pessoa sai de uma implantação que ela ainda não guardou. As três saídas são
// explícitas de propósito: nada é descartado por engano, e nada fica na mesa sem a pessoa querer.
export function SairDaImplantacao({
  onSalvar,
  onExcluir,
  onCancelar,
  ocupado,
  erro,
}: {
  onSalvar: () => void;
  onExcluir: () => void;
  onCancelar: () => void;
  /** Qual botão está esperando o servidor, para travar os outros. */
  ocupado: 'salvar' | 'excluir' | null;
  erro: string | null;
}) {
  return (
    <div className="modal-fundo" onClick={ocupado === null ? onCancelar : undefined}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sair-titulo"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="sair-titulo">Antes de sair</h2>
        <p className="sub">
          Esta implantação ainda não foi salva para continuar depois. O que você quer fazer com ela?
        </p>

        {erro !== null && <div className="erro">{erro}</div>}

        <div className="linha-acoes">
          <button type="button" autoFocus disabled={ocupado !== null} onClick={onSalvar}>
            {ocupado === 'salvar' ? 'Salvando…' : 'Salvar e continuar depois'}
          </button>
          <button
            type="button"
            className="perigo"
            disabled={ocupado !== null}
            onClick={onExcluir}
          >
            {ocupado === 'excluir' ? 'Excluindo…' : 'Excluir'}
          </button>
          <button
            type="button"
            className="secundario"
            disabled={ocupado !== null}
            onClick={onCancelar}
          >
            Cancelar
          </button>
        </div>
        <p className="meta" style={{ margin: '10px 0 0' }}>
          Salvar deixa a implantação na sua lista de início, do jeito que está. Excluir tira ela da
          lista — o histórico fica guardado para consulta, mas ela não volta para a sua mesa.
        </p>
      </div>
    </div>
  );
}
