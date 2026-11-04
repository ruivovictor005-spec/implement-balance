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
 * O que o sistema entendeu do arquivo recebido: em que plano de contas a origem está e se o sinal
 * do saldo segue a convenção esperada (débito negativo).
 *
 * As duas coisas, quando estão erradas, não estouram nada — produzem um resultado inteiro errado em
 * silêncio. Um balancete com o sinal trocado FECHA (débito e crédito trocados somam igual), então
 * nem a diferença do painel acusa.
 *
 * Por isso aqui tem AÇÃO, não explicação: o plano se indica no seletor e o sinal se conserta no
 * botão. Texto comprido mandando a pessoa editar o arquivo por fora era só trabalho empurrado.
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
      <h2>Como o arquivo foi lido</h2>

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

      {origem.convencao === 'invertida' ? (
        <div className="aviso-atencao">
          <strong>O sinal do saldo deste arquivo está trocado:</strong> o ativo está somando crédito
          e o passivo, débito. Assim, todo lançamento sai do lado contrário no TXT — e o balancete
          fecha do mesmo jeito, então a diferença do painel não acusa.
          {onInverterSinal !== undefined && (
            <div className="linha-acoes">
              <button type="button" onClick={onInverterSinal} disabled={!editavel}>
                Inverter o sinal de todos os saldos
              </button>
            </div>
          )}
        </div>
      ) : origem.convencao === 'ausente' ? (
        <div className="aviso-atencao">
          <strong>Este arquivo não diz de que lado (D/C) está cada saldo:</strong> todos os{' '}
          {origem.conferidas} saldos conferidos têm o mesmo sinal. Exporte o balancete com o lado
          junto do valor (&quot;5.574,25D&quot;) ou com uma coluna de D/C — sem isso não há como
          saber o lado de nenhum lançamento.
        </div>
      ) : null}
    </section>
  );
}
