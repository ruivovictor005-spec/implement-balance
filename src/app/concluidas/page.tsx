'use client';
import * as React from 'react';
import { useEffect, useState } from 'react';
import {
  exportarConcluidas,
  listarConcluidas,
  reabrirConcluida,
  type ConcluidaNaLista,
} from './acoes.js';

const dataBR = (d: Date | null): string =>
  d === null ? '—' : new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });

export default function Pagina() {
  const [lista, setLista] = useState<ConcluidaNaLista[]>([]);
  const [confirmando, setConfirmando] = useState<number | null>(null);
  const [reabrindo, setReabrindo] = useState<number | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    void listarConcluidas().then(setLista);
  }, []);

  const baixar = async (): Promise<void> => {
    const bytes = await exportarConcluidas();
    const blob = new Blob([new Uint8Array(bytes)], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'implantacoes-concluidas.xlsx';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const reabrir = async (id: number): Promise<void> => {
    setErro(null);
    setReabrindo(id);
    const r = await reabrirConcluida(id);
    if (!r.ok) {
      setErro(r.erro);
      setReabrindo(null);
      return;
    }
    // Volta para a mesa como "em andamento": abre direto para corrigir.
    window.location.href = `/implantacao/${id}`;
  };

  return (
    <main>
      <h1>Implantações concluídas</h1>
      <p className="sub">
        <a href="/">← Início</a> · Reabra uma implantação sua para corrigir e gerar o TXT de novo.
      </p>
      <section className="cartao">
        <div className="linha-acoes">
          <button type="button" onClick={baixar} disabled={lista.length === 0}>
            Exportar para Excel
          </button>
        </div>
        {erro !== null && <div className="erro">{erro}</div>}
        {lista.length === 0 ? (
          <p className="sub">Nenhuma implantação concluída ainda.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Empresa</th>
                <th>Data do saldo</th>
                <th>Pessoa</th>
                <th>Concluída em</th>
                <th>Liberação</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {lista.map((c) => (
                <tr key={c.id}>
                  <td>{c.empresaNome ?? c.empresaCnpj ?? '—'}</td>
                  <td>{c.dataSaldo ?? '—'}</td>
                  <td>{c.pessoa}</td>
                  <td>{dataBR(c.concluidaEm)}</td>
                  <td>{c.liberacao ?? ''}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    {c.minha &&
                      (confirmando === c.id ? (
                        <span className="linha-acoes" style={{ marginTop: 0 }}>
                          <span className="meta">Reabrir para corrigir?</span>
                          <button
                            type="button"
                            className="pequeno"
                            disabled={reabrindo !== null}
                            onClick={() => void reabrir(c.id)}
                          >
                            {reabrindo === c.id ? 'Reabrindo…' : 'Sim, reabrir'}
                          </button>
                          <button
                            type="button"
                            className="secundario pequeno"
                            disabled={reabrindo !== null}
                            onClick={() => setConfirmando(null)}
                          >
                            Não
                          </button>
                        </span>
                      ) : (
                        <span className="linha-acoes" style={{ marginTop: 0 }}>
                          <a className="botao secundario pequeno" href={`/implantacao/${c.id}`}>
                            Abrir
                          </a>
                          <button
                            type="button"
                            className="secundario pequeno"
                            onClick={() => {
                              setErro(null);
                              setConfirmando(c.id);
                            }}
                          >
                            Reabrir
                          </button>
                        </span>
                      ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}
