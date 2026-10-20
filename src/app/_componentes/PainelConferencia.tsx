'use client';
import * as React from 'react';
import type { Painel } from '../../motor/converter.js';

const brl = (n: number): string =>
  n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function PainelConferencia({
  painel,
  justificativa,
  onJustificativa,
  onGerar,
}: {
  painel: Painel;
  justificativa: string;
  onJustificativa: (v: string) => void;
  onGerar: () => void;
}) {
  const liberado = painel.pronto || justificativa.trim() !== '';

  return (
    <section className="cartao">
      <h2>Conferência</h2>
      <div className="painel">
        <div className="numero"><div className="rotulo">Contas analíticas</div><div className="valor">{painel.analiticas}</div></div>
        <div className="numero"><div className="rotulo">Mapeadas</div><div className="valor">{painel.mapeadas}</div></div>
        <div className="numero"><div className="rotulo">Pendentes</div><div className="valor">{painel.pendentes}</div></div>
        <div className="numero"><div className="rotulo">Saldo pendente</div><div className="valor">{brl(painel.saldoPendente)}</div></div>
        <div className="numero"><div className="rotulo">Total débito</div><div className="valor">{brl(painel.totalDebito)}</div></div>
        <div className="numero"><div className="rotulo">Total crédito</div><div className="valor">{brl(painel.totalCredito)}</div></div>
        <div className="numero"><div className="rotulo">Diferença D–C</div><div className="valor">{brl(painel.diferenca)}</div></div>
      </div>

      <div className={`semaforo ${painel.pronto ? 'pronto' : 'revisar'}`}>{painel.status}</div>

      {!painel.pronto && (
        <div style={{ marginTop: 12 }}>
          <label htmlFor="just">Justificativa para gerar mesmo com pendência ou diferença</label>
          <textarea
            id="just"
            rows={2}
            value={justificativa}
            onChange={(e) => onJustificativa(e.target.value)}
          />
        </div>
      )}

      <div className="linha-acoes">
        <button type="button" onClick={onGerar} disabled={!liberado}>
          Gerar TXT do Domínio
        </button>
      </div>
    </section>
  );
}
