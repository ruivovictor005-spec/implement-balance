'use client';
import * as React from 'react';
import type { AuditoriaOrigem, PlanoIndicado } from '../../../motor/origem.js';

const NOME_DO_PLANO: Record<AuditoriaOrigem['plano'], string> = {
  cosif: 'COSIF (Infobank)',
  dominio: 'plano do Domínio',
  indefinido: 'não identificado',
};

/** O valor do seletor: '' é "deduzir", que é o padrão. */
type Escolha = '' | PlanoIndicado;

const escolhaValida = (v: string): Escolha => (v === 'cosif' || v === 'dominio' ? v : '');

/**
 * Os dois ajustes do arquivo de origem: em que plano de contas ele está e de que lado estão os
 * saldos. São controles, não avisos — a pedido de quem usa, o sistema não opina mais sobre o sinal.
 *
 * O que isso custa está dito em voz alta aqui porque some da tela: um balancete com o sinal trocado
 * gera um TXT com TODOS os lançamentos do lado contrário, e ele fecha do mesmo jeito (débito e
 * crédito trocados somam igual), então nenhuma outra conferência do sistema pega. Quem decide se o
 * sinal está certo é quem olha o balancete — e o botão aqui é como consertar quando não está.
 */
export function AvisoOrigem({
  origem,
  onIndicarPlano,
  onInverterSinal,
  editavel = true,
}: {
  origem: AuditoriaOrigem;
  /** Chamada quando a pessoa indica o plano (ou volta para "deduzir", com null). */
  onIndicarPlano?: (plano: PlanoIndicado | null) => void;
  /** Chamada para inverter o sinal de todos os saldos de uma vez. */
  onInverterSinal?: () => void;
  editavel?: boolean;
}) {
  const escolha: Escolha = origem.indicado && origem.plano !== 'indefinido' ? origem.plano : '';
  const deducaoDiscorda =
    origem.indicado && origem.detectado !== 'indefinido' && origem.detectado !== origem.plano;

  return (
    <section className="cartao">
      <h2>Arquivo de origem</h2>

      {onIndicarPlano !== undefined && (
        <label className="chave">
          Plano do balancete recebido{' '}
          <select
            value={escolha}
            disabled={!editavel}
            onChange={(e) => onIndicarPlano(escolhaValida(e.target.value) || null)}
          >
            <option value="">Deduzir pelo arquivo (hoje: {NOME_DO_PLANO[origem.detectado]})</option>
            <option value="cosif">COSIF — Infobank</option>
            <option value="dominio">Domínio</option>
          </select>
        </label>
      )}

      {deducaoDiscorda && (
        <p className="meta">
          A dedução pelos grupos diria <strong>{NOME_DO_PLANO[origem.detectado]}</strong>. Vale a sua
          indicação.
        </p>
      )}

      {!origem.indicado && origem.detectado === 'indefinido' && (
        <p className="meta">
          Não deu para deduzir o plano pelos grupos deste arquivo; foi lido como COSIF. Indique
          acima.
        </p>
      )}

      {onInverterSinal !== undefined && (
        <div className="linha-acoes">
          <button
            type="button"
            className="secundario"
            onClick={onInverterSinal}
            disabled={!editavel}
          >
            Inverter o sinal de todos os saldos
          </button>
          <span className="meta">
            Para arquivo que vem com débito positivo. Apertar de novo desfaz.
          </span>
        </div>
      )}
    </section>
  );
}
