'use client';
import * as React from 'react';
import type { Conferencia } from '../../../motor/conferencia-grupo.js';
import { ladoDoSaldo } from '../../../motor/lado.js';

const brl = (n: number): string => n.toLocaleString('pt-BR', { minimumFractionDigits: 2 });

/** Valor em módulo com o lado (D/C), como num balancete. Zero sai sem lado. */
function Valor({ valor }: { valor: number }) {
  const lado = ladoDoSaldo(valor);
  return (
    <>
      {brl(Math.abs(valor))}
      {lado !== null && <span className="lado">{lado}</span>}
    </>
  );
}

/**
 * Confere o balancete de ORIGEM contra o que vai ser implantado, grupo a grupo — o jeito de achar
 * a conta que foi indicada para o grupo errado sem comparar duas tabelas de cabeça.
 */
export function ConferenciaPorGrupo({ conferencia }: { conferencia: Conferencia }) {
  const divergentes = conferencia.grupos.filter((g) => !g.confere);

  return (
    <section className="cartao">
      <h2>Conferência por grupo — origem × Domínio</h2>
      <p className="sub">
        Compara o saldo de cada grupo no balancete que você recebeu com o que vai ser implantado. O
        que ainda está pendente sai da conta, porque legitimamente ainda não foi para o Domínio.
      </p>

      {conferencia.grupos.length === 0 ? (
        <div className="vazio">Indique as contas no de-para para conferir os grupos.</div>
      ) : (
        <>
          <div className={divergentes.length === 0 ? 'vazio-ok' : 'erro'} style={{ marginTop: 0 }}>
            {divergentes.length === 0 ? (
              <>
                <strong>Todos os grupos conferem.</strong> O saldo de cada grupo na origem é o mesmo
                que vai para o Domínio.
              </>
            ) : (
              <>
                <strong>
                  {divergentes.length} grupo(s) com diferença: {divergentes.map((g) => g.rotulo).join(', ')}.
                </strong>{' '}
                Uma diferença num grupo com outra igual e de sinal trocado em outro quer dizer que
                alguma conta foi indicada para o grupo errado — procure no de-para uma conta desse
                valor.
              </>
            )}
          </div>

          <table>
            <thead>
              <tr>
                <th>Grupo</th>
                <th style={{ textAlign: 'right' }}>No balancete de origem</th>
                <th style={{ textAlign: 'right' }}>Ainda pendente</th>
                <th style={{ textAlign: 'right' }}>Já no Domínio</th>
                <th style={{ textAlign: 'right' }}>Diferença</th>
              </tr>
            </thead>
            <tbody>
              {conferencia.grupos.map((g) => (
                <tr
                  key={g.chave}
                  data-grupo={g.chave}
                  className={g.confere ? undefined : 'pendente'}
                >
                  <td>{g.rotulo}</td>
                  <td className="num">
                    <Valor valor={g.origem} />
                  </td>
                  <td className="num">
                    {g.pendente === 0 ? <span className="meta">—</span> : <Valor valor={g.pendente} />}
                  </td>
                  <td className="num">
                    <Valor valor={g.dominio} />
                  </td>
                  <td className="num">
                    {g.confere ? (
                      <span className="meta">confere</span>
                    ) : (
                      <strong className="status-pend">
                        <Valor valor={g.diferenca} />
                      </strong>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {conferencia.foraDaConferencia.quantidade > 0 && (
            <p className="meta" style={{ marginTop: 10 }}>
              {conferencia.foraDaConferencia.quantidade} linha(s), somando{' '}
              {brl(Math.abs(conferencia.foraDaConferencia.saldo))}, ficaram fora desta conferência —
              a natureza da conta de origem não foi reconhecida, ou a conta indicada não está no
              plano. Os números acima não as incluem.
            </p>
          )}
        </>
      )}
    </section>
  );
}
