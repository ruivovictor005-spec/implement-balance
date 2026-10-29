'use client';
import * as React from 'react';
import { useEffect, useState } from 'react';
import { exportarConcluidas, listarConcluidas, type ConcluidaResumo } from './acoes.js';

const dataBR = (d: Date | null): string =>
  d === null ? '—' : new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });

export default function Pagina() {
  const [lista, setLista] = useState<ConcluidaResumo[]>([]);

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

  return (
    <main>
      <h1>Implantações concluídas</h1>
      <p className="sub">
        <a href="/">← Minha mesa</a>
      </p>
      <section className="cartao">
        <div className="linha-acoes">
          <button type="button" onClick={baixar} disabled={lista.length === 0}>
            Exportar para Excel
          </button>
        </div>
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
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}
