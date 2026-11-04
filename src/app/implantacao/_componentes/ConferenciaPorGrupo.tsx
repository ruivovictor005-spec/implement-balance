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
 * Confere o balancete de ORIGEM contra o que vai ser implantado, grupo a grupo e subgrupo a
 * subgrupo — para a pessoa não ter de comparar duas tabelas de cabeça.
 *
 * O resultado é "atenção", nunca um veredito: a diferença pode ser erro de de-para ou uma
 * reclassificação proposital, e o sistema não sabe a diferença. Quem analisa decide.
 */
export function ConferenciaPorGrupo({ conferencia }: { conferencia: Conferencia }) {
  const pedemAtencao = conferencia.grupos.filter((g) => !g.confere);
  const { foraDaConferencia, foraDoSubgrupo } = conferencia;

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
          <div className={pedemAtencao.length === 0 ? 'vazio-ok' : 'aviso-atencao'}>
            {pedemAtencao.length === 0 ? (
              <>
                <strong>Todos os grupos conferidos batem.</strong> O saldo de cada grupo na origem é
                o mesmo que vai para o Domínio.
              </>
            ) : (
              <>
                <strong>
                  {pedemAtencao.length} grupo(s) para verificar: {pedemAtencao.map((g) => g.rotulo).join(', ')}.
                </strong>{' '}
                Isto não quer dizer erro — o saldo pode ter mudado de grupo de propósito. Confira o
                motivo. Uma diferença num grupo com outra igual e de sinal trocado em outro costuma
                ser uma conta indicada para o grupo vizinho: procure no de-para uma conta desse
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
                  className={[g.nivel === 0 ? 'grupo' : '', g.confere ? '' : 'atencao']
                    .filter((c) => c !== '')
                    .join(' ') || undefined}
                >
                  <td style={{ paddingLeft: 10 + g.nivel * 20 }}>{g.rotulo}</td>
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
                      <span className="selo-ok">OK</span>
                    ) : (
                      <strong className="status-atencao">
                        <Valor valor={g.diferenca} />
                      </strong>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {foraDoSubgrupo.quantidade > 0 && (
            <p className="meta" style={{ marginTop: 10 }}>
              {foraDoSubgrupo.quantidade} linha(s), somando{' '}
              {brl(Math.abs(foraDoSubgrupo.saldo))}, foram conferidas só no grupo de topo: a
              natureza delas aceita mais de um subgrupo no Domínio, então não existe subgrupo
              esperado para comparar.
            </p>
          )}

          {foraDaConferencia.quantidade > 0 && (
            <p className="meta" style={{ marginTop: 6 }}>
              {foraDaConferencia.quantidade} linha(s), somando{' '}
              {brl(Math.abs(foraDaConferencia.saldo))}, ficaram fora desta conferência — a natureza
              da conta de origem não foi reconhecida, ou a conta indicada não está no plano. Os
              números acima não as incluem.
            </p>
          )}
        </>
      )}
    </section>
  );
}
