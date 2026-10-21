'use client';
import * as React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { listarConcluidas, type ConcluidaResumo } from '../concluidas/acoes.js';

const min = (s: number): string => `${Math.round(s / 60)} min`;

export default function Pagina() {
  const [lista, setLista] = useState<ConcluidaResumo[]>([]);

  useEffect(() => {
    void listarConcluidas().then(setLista);
  }, []);

  const porPessoa = useMemo(() => {
    const m = new Map<string, { qtd: number; total: number; ativo: number }>();
    for (const c of lista) {
      const a = m.get(c.pessoa) ?? { qtd: 0, total: 0, ativo: 0 };
      a.qtd += 1;
      a.total += c.tempoTotal;
      a.ativo += c.tempoAtivo;
      m.set(c.pessoa, a);
    }
    return [...m.entries()];
  }, [lista]);

  const totalQtd = lista.length;
  const mediaAtivo = totalQtd > 0 ? lista.reduce((s, c) => s + c.tempoAtivo, 0) / totalQtd : 0;

  return (
    <main>
      <h1>Painel de acompanhamento</h1>
      <p className="sub">Como está o andamento das implantações concluídas (dados de supervisão).</p>

      <section className="cartao">
        <div className="painel">
          <div className="numero">
            <div className="rotulo">Implantações concluídas</div>
            <div className="valor">{totalQtd}</div>
          </div>
          <div className="numero">
            <div className="rotulo">Pessoas ativas</div>
            <div className="valor">{porPessoa.length}</div>
          </div>
          <div className="numero">
            <div className="rotulo">Tempo ativo médio</div>
            <div className="valor">{min(mediaAtivo)}</div>
          </div>
        </div>
      </section>

      <section className="cartao">
        <h2>Por pessoa</h2>
        {porPessoa.length === 0 ? (
          <p className="sub">Ainda não há implantações concluídas.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Pessoa</th>
                <th>Concluídas</th>
                <th>Tempo total</th>
                <th>Tempo ativo</th>
                <th>Ativo médio</th>
              </tr>
            </thead>
            <tbody>
              {porPessoa.map(([pessoa, a]) => (
                <tr key={pessoa}>
                  <td>{pessoa}</td>
                  <td>{a.qtd}</td>
                  <td>{min(a.total)}</td>
                  <td>{min(a.ativo)}</td>
                  <td>{min(a.ativo / a.qtd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}
