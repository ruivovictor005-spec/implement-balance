'use client';
import * as React from 'react';
import { useCallback, useEffect, useState } from 'react';
import {
  decidirPedido,
  decidirProposta,
  listarAlteracoes,
  listarPropostas,
  type PedidoAlteracao,
  type PropostaNaFila,
} from './acoes.js';

const dataBR = (d: Date): string =>
  new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });

// Painel do administrador: nenhum sinônimo novo vale para os outros antes de passar por aqui.
export function PainelAdmin() {
  const [propostas, setPropostas] = useState<PropostaNaFila[]>([]);
  const [pedidos, setPedidos] = useState<PedidoAlteracao[]>([]);
  const [observacoes, setObservacoes] = useState<Record<string, string>>({});
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const recarregar = useCallback(async () => {
    const [p, a] = await Promise.all([listarPropostas(), listarAlteracoes()]);
    setPropostas(p);
    setPedidos(a);
  }, []);

  useEffect(() => {
    void recarregar();
  }, [recarregar]);

  const decidir = async (chave: string, acao: () => Promise<{ ok: boolean; erro?: string }>) => {
    setErro(null);
    setOcupado(chave);
    try {
      const r = await acao();
      if (!r.ok) setErro(r.erro ?? 'Não foi possível decidir.');
      setObservacoes(({ [chave]: _, ...resto }) => resto);
      await recarregar();
    } finally {
      setOcupado(null);
    }
  };

  const obs = (chave: string) => (
    <input
      type="text"
      placeholder="Observação (opcional)"
      value={observacoes[chave] ?? ''}
      onChange={(e) => setObservacoes((o) => ({ ...o, [chave]: e.target.value }))}
    />
  );

  return (
    <main>
      <h1>Administração</h1>
      <p className="sub">
        Sinônimos propostos só passam a valer para todos depois da sua aprovação. Enquanto isso, quem
        propôs resolve a própria linha com “usar só aqui”.
      </p>
      {erro && <div className="erro">{erro}</div>}

      <section className="cartao">
        <h2>Sinônimos propostos — {propostas.length}</h2>
        {propostas.length === 0 ? (
          <p className="sub">Nenhuma proposta aguardando.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Nome no balancete</th>
                <th>Conta do Domínio proposta</th>
                <th>Motivo</th>
                <th>Quem propôs</th>
                <th>Decisão</th>
              </tr>
            </thead>
            <tbody>
              {propostas.map((p) => {
                const chave = `s${p.id}`;
                return (
                  <tr key={p.id}>
                    <td>
                      <strong>{p.nomeOriginal}</strong>
                      <br />
                      <span className="meta">chave: {p.chaveNormalizada}</span>
                    </td>
                    <td>
                      <span className="cod">{p.codigo}</span> {p.contaDescricao ?? '(fora do plano vigente)'}
                      {p.contaClassificacao && <span className="meta"> · class. {p.contaClassificacao}</span>}
                      {p.codigoAtivo && (
                        <div className="status-pend">
                          Hoje vale {p.codigoAtivo} — aprovar substitui.
                        </div>
                      )}
                    </td>
                    <td>{p.motivo}</td>
                    <td>
                      {p.propostoPor}
                      <br />
                      <span className="meta">{dataBR(p.criadoEm)}</span>
                    </td>
                    <td>
                      {obs(chave)}
                      <div className="linha-acoes">
                        <button
                          type="button"
                          disabled={ocupado !== null}
                          onClick={() => decidir(chave, () => decidirProposta(p.id, true, observacoes[chave] ?? ''))}
                        >
                          Aprovar
                        </button>
                        <button
                          type="button"
                          className="secundario"
                          disabled={ocupado !== null}
                          onClick={() => decidir(chave, () => decidirProposta(p.id, false, observacoes[chave] ?? ''))}
                        >
                          Rejeitar
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      <section className="cartao">
        <h2>Pedidos de alteração — {pedidos.length}</h2>
        {pedidos.length === 0 ? (
          <p className="sub">Nada para revisar.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Conta</th>
                <th>De → Para</th>
                <th>Motivo</th>
                <th>Quem pediu</th>
                <th>Decisão</th>
              </tr>
            </thead>
            <tbody>
              {pedidos.map((p) => {
                const chave = `a${p.id}`;
                return (
                  <tr key={p.id}>
                    <td>{p.nomeOriginal}</td>
                    <td>
                      {p.codigoAtual} → <strong>{p.codigoProposto}</strong>
                    </td>
                    <td>{p.motivo}</td>
                    <td>{p.solicitadoPor ?? '—'}</td>
                    <td>
                      {obs(chave)}
                      <div className="linha-acoes">
                        <button
                          type="button"
                          disabled={ocupado !== null}
                          onClick={() => decidir(chave, () => decidirPedido(p.id, true, observacoes[chave] ?? ''))}
                        >
                          Aprovar
                        </button>
                        <button
                          type="button"
                          className="secundario"
                          disabled={ocupado !== null}
                          onClick={() => decidir(chave, () => decidirPedido(p.id, false, observacoes[chave] ?? ''))}
                        >
                          Rejeitar
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}
