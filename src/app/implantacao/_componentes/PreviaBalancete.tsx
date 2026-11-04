'use client';
import * as React from 'react';
import { useState } from 'react';
import { montarBalancete, type SaldoDaConta } from '../../../motor/arvore-balancete.js';
import type { Conferencia, GrupoConferido } from '../../../motor/conferencia-grupo.js';
import type { ContaBusca, Lancamento } from '../acoes.js';

const brl = (n: number): string => n.toLocaleString('pt-BR', { minimumFractionDigits: 2 });

type Origem = { codigo: string; nome: string; debito: number; credito: number };

type ContaComOrigens = SaldoDaConta & {
  /** As contas de origem que compõem o saldo desta conta do Domínio — um lançamento cada. */
  origens: Origem[];
};

// Uma entrada por conta do Domínio, agregando os lançamentos. Cada conta guarda as origens que a
// compõem, porque no TXT cada origem é um lançamento próprio: é por aqui que se explica de onde
// veio cada saldo.
function agregarPorConta(lancamentos: Lancamento[]): ContaComOrigens[] {
  const mapa = new Map<string, ContaComOrigens>();
  for (const l of lancamentos) {
    const codigo = l.contaDebito ?? l.contaCredito;
    if (codigo === null) continue;
    const conta = mapa.get(codigo) ?? { codigo, debito: 0, credito: 0, origens: [] };
    const debito = l.contaDebito !== null ? l.valor : 0;
    const credito = l.contaCredito !== null ? l.valor : 0;
    conta.debito += debito;
    conta.credito += credito;
    conta.origens.push({ codigo: l.origemCodigo, nome: l.origemNome, debito, credito });
    mapa.set(codigo, conta);
  }
  return [...mapa.values()];
}

const Saldo = ({ debito, credito }: { debito: number; credito: number }) => {
  const saldo = debito - credito;
  return (
    <>
      {brl(Math.abs(saldo))} {saldo >= 0 ? 'D' : 'C'}
    </>
  );
};

export function PreviaBalancete({
  lancamentos,
  contas,
  conferencia,
}: {
  lancamentos: Lancamento[];
  contas: ContaBusca[];
  /**
   * Conferência contra o balancete de origem. Só os grupos de TOPO recebem status: abaixo deles os
   * dois planos têm subdivisões diferentes (o "Disponível" do Domínio não tem equivalente no COSIF
   * da origem), então não há com o que comparar.
   */
  conferencia?: Conferencia;
}) {
  const [verOrigens, setVerOrigens] = useState(true);
  const statusPorGrupo = new Map<string, GrupoConferido>(
    (conferencia?.grupos ?? []).map((g) => [g.chave, g]),
  );
  const porConta = agregarPorConta(lancamentos);
  const origensPorCodigo = new Map(porConta.map((c) => [c.codigo, c.origens]));
  const linhas = montarBalancete(porConta, contas);

  const analiticas = linhas.filter((l) => !l.sintetica);
  const totalDebito = analiticas.reduce((s, l) => s + l.debito, 0);
  const totalCredito = analiticas.reduce((s, l) => s + l.credito, 0);

  return (
    <section className="cartao">
      <h2>
        Prévia do balancete no Domínio — {analiticas.length} conta(s), {lancamentos.length}{' '}
        lançamento(s)
      </h2>
      <p className="sub">
        Como o balancete fica no plano do Domínio: cada conta de grupo totaliza o que está abaixo
        dela, em todos os níveis. Cada conta de origem vira um lançamento próprio, com a origem no
        histórico.
        {conferencia !== undefined && (
          <>
            {' '}
            A coluna <strong>Confere?</strong> compara o grupo com o balancete de origem — só nos
            grupos de topo, que é onde os dois planos de contas se correspondem.
          </>
        )}
      </p>
      {analiticas.length === 0 ? (
        <div className="vazio">Indique as contas no de-para para ver a prévia aqui.</div>
      ) : (
        <>
          <label className="chave">
            <input
              type="checkbox"
              checked={verOrigens}
              onChange={(e) => setVerOrigens(e.target.checked)}
            />
            Mostrar a origem de cada saldo
          </label>
          <table className="balancete">
            <thead>
              <tr>
                <th>Código</th>
                <th>Classificação</th>
                <th>Descrição</th>
                <th style={{ textAlign: 'right' }}>Débito</th>
                <th style={{ textAlign: 'right' }}>Crédito</th>
                <th style={{ textAlign: 'right' }}>Saldo</th>
                <th>Confere?</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => {
                const origens = l.sintetica ? [] : origensPorCodigo.get(l.codigo) ?? [];
                // Status só no grupo de topo — é o único nível comparável com a origem.
                const status =
                  l.sintetica && l.nivel === 0 ? statusPorGrupo.get(l.classificacao) : undefined;
                const naoBate = status !== undefined && !status.confere;
                return (
                  <React.Fragment key={`${l.sintetica ? 's' : 'a'}-${l.classificacao}-${l.codigo}`}>
                    <tr
                      className={[l.sintetica ? 'grupo' : '', naoBate ? 'nao-bate' : '']
                        .filter((c) => c !== '')
                        .join(' ') || undefined}
                      data-classificacao={l.classificacao}
                      data-sintetica={l.sintetica ? '1' : '0'}
                      data-confere={status === undefined ? undefined : status.confere ? 'ok' : 'nao'}
                    >
                      <td className="cod">{l.codigo}</td>
                      <td className="cod">{l.classificacao || '—'}</td>
                      <td style={{ paddingLeft: 10 + l.nivel * 18 }}>
                        {l.descricao || '(fora do plano)'}
                        {origens.length > 1 && (
                          <span className="meta"> · {origens.length} origens</span>
                        )}
                      </td>
                      <td className="num">{l.debito ? brl(l.debito) : ''}</td>
                      <td className="num">{l.credito ? brl(l.credito) : ''}</td>
                      <td className="num">
                        <Saldo debito={l.debito} credito={l.credito} />
                      </td>
                      <td>
                        {status === undefined ? (
                          ''
                        ) : status.confere ? (
                          <span className="selo-ok">OK</span>
                        ) : (
                          // "NÃO BATE", e não "pendente": neste app pendência é conta sem conta do
                          // Domínio indicada, que é justamente o que NÃO causa este status.
                          <span
                            className="status-pend"
                            title={`Diferença de ${brl(Math.abs(status.diferenca))} contra o balancete de origem. Alguma conta deste grupo foi indicada para outro grupo.`}
                          >
                            NÃO BATE
                          </span>
                        )}
                      </td>
                    </tr>
                    {verOrigens &&
                      origens.map((o, i) => (
                        <tr key={`${l.codigo}-${i}`} className="linha-origem">
                          <td />
                          <td colSpan={2} style={{ paddingLeft: 10 + (l.nivel + 1) * 18 }}>
                            ↳ veio de <span className="cod">{o.codigo}</span> {o.nome}
                          </td>
                          <td className="num">{o.debito ? brl(o.debito) : ''}</td>
                          <td className="num">{o.credito ? brl(o.credito) : ''}</td>
                          <td />
                          <td />
                        </tr>
                      ))}
                  </React.Fragment>
                );
              })}
              <tr className="total">
                <td colSpan={3}>
                  <strong>Totais</strong>
                </td>
                <td className="num">
                  <strong>{brl(totalDebito)}</strong>
                </td>
                <td className="num">
                  <strong>{brl(totalCredito)}</strong>
                </td>
                <td className="num">
                  <strong>
                    <Saldo debito={totalDebito} credito={totalCredito} />
                  </strong>
                </td>
                <td />
              </tr>
            </tbody>
          </table>
        </>
      )}
    </section>
  );
}
