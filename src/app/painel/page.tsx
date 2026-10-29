'use client';
import * as React from 'react';
import { useEffect, useMemo, useState } from 'react';
import type { ConcluidaResumo } from '../implantacao/concluir.js';
import { dadosPainel } from './acoes.js';
import { filtrarPorPeriodo, resumirPorPessoa, type Periodo } from './resumo.js';

const dataBR = (d: Date | null): string =>
  d === null ? '—' : new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });

export default function Pagina() {
  const [autorizado, setAutorizado] = useState<boolean | null>(null);
  const [lista, setLista] = useState<ConcluidaResumo[]>([]);
  const [periodo, setPeriodo] = useState<Periodo>('30');

  useEffect(() => {
    void dadosPainel().then((r) => {
      setAutorizado(r.autorizado);
      setLista(r.lista);
    });
  }, []);

  const filtrada = useMemo(() => filtrarPorPeriodo(lista, periodo), [lista, periodo]);
  const porPessoa = useMemo(() => resumirPorPessoa(filtrada), [filtrada]);

  const totalQtd = filtrada.length;

  if (autorizado === null) {
    return (
      <main>
        <h1>Painel de supervisão</h1>
        <p className="sub">Carregando…</p>
      </main>
    );
  }

  if (!autorizado) {
    return (
      <main>
        <h1>Painel de supervisão</h1>
        <div className="erro" style={{ marginTop: 16 }}>
          Esta área é restrita a supervisores (perfil revisor ou admin). Fale com um administrador se
          precisar de acesso.
        </div>
      </main>
    );
  }

  return (
    <main>
      <header className="cab-impl">
        <div>
          <h1>Painel de supervisão</h1>
          <p className="sub" style={{ margin: 0 }}>Acompanhe quem fez o quê e quantas implantações concluiu.</p>
        </div>
        <div className="filtro" style={{ margin: 0 }}>
          <label htmlFor="periodo" style={{ margin: 0 }}>Período</label>
          <select id="periodo" value={periodo} onChange={(e) => setPeriodo(e.target.value as Periodo)}>
            <option value="7">Últimos 7 dias</option>
            <option value="30">Últimos 30 dias</option>
            <option value="tudo">Tudo</option>
          </select>
        </div>
      </header>

      <section className="cartao">
        <div className="painel">
          <div className="numero">
            <div className="rotulo">Implantações concluídas</div>
            <div className="valor">{totalQtd}</div>
          </div>
          <div className="numero">
            <div className="rotulo">Pessoas</div>
            <div className="valor">{porPessoa.length}</div>
          </div>
        </div>
      </section>

      <section className="cartao">
        <h2>Por pessoa</h2>
        {porPessoa.length === 0 ? (
          <p className="sub">Nenhuma implantação concluída no período.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Pessoa</th>
                <th style={{ textAlign: 'right' }}>Concluídas</th>
                <th>Última conclusão</th>
              </tr>
            </thead>
            <tbody>
              {porPessoa.map((a) => (
                <tr key={a.pessoa}>
                  <td>{a.pessoa}</td>
                  <td className="num">{a.qtd}</td>
                  <td>{dataBR(a.ultimaConclusao)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="cartao">
        <h2>Implantações concluídas</h2>
        {filtrada.length === 0 ? (
          <p className="sub">Nada no período.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Empresa</th>
                <th>Pessoa</th>
                <th>Concluída em</th>
                <th>Liberação</th>
              </tr>
            </thead>
            <tbody>
              {filtrada.map((c) => (
                <tr key={c.id}>
                  <td>{c.empresaNome && c.empresaNome.trim() !== '' ? c.empresaNome : '(sem nome)'}</td>
                  <td>{c.pessoa}</td>
                  <td>{dataBR(c.concluidaEm)}</td>
                  <td>{c.liberacao ? <span className="status-pend">com justificativa</span> : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}
