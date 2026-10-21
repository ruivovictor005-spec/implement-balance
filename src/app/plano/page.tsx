'use client';
import * as React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { carregarContas, type ContaBusca } from '../implantacao/acoes.js';

export default function Pagina() {
  const [contas, setContas] = useState<ContaBusca[]>([]);
  const [termo, setTermo] = useState('');
  const [natureza, setNatureza] = useState('todas');
  const [soAnaliticas, setSoAnaliticas] = useState(true);

  useEffect(() => {
    void carregarContas().then(setContas);
  }, []);

  const naturezas = useMemo(
    () => [...new Set(contas.map((c) => c.natureza).filter((n) => n !== ''))].sort(),
    [contas],
  );

  const filtradas = useMemo(() => {
    const t = termo.trim().toLowerCase();
    return contas
      .filter((c) => (soAnaliticas ? c.tipo === 'A' : true))
      .filter((c) => (natureza === 'todas' ? true : c.natureza === natureza))
      .filter(
        (c) =>
          t === '' ||
          c.descricao.toLowerCase().includes(t) ||
          c.codigoReduzido.toLowerCase().includes(t) ||
          c.classificacao.toLowerCase().includes(t),
      );
  }, [contas, termo, natureza, soAnaliticas]);

  return (
    <main>
      <h1>Plano de contas padrão (Domínio)</h1>
      <p className="sub">
        Consulte a conta que você quer referenciar, vendo o grupo (classificação e natureza) antes de
        escolher.
      </p>

      <section className="cartao">
        <div className="grade">
          <div>
            <label htmlFor="busca">Buscar por nome, código ou classificação</label>
            <input id="busca" value={termo} onChange={(e) => setTermo(e.target.value)} placeholder="ex.: contas a pagar" />
          </div>
          <div>
            <label htmlFor="nat">Natureza / grupo</label>
            <select id="nat" value={natureza} onChange={(e) => setNatureza(e.target.value)}>
              <option value="todas">Todas</option>
              {naturezas.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="ana">Mostrar</label>
            <select id="ana" value={soAnaliticas ? 'a' : 't'} onChange={(e) => setSoAnaliticas(e.target.value === 'a')}>
              <option value="a">Só analíticas (usáveis)</option>
              <option value="t">Todas (inclui grupos)</option>
            </select>
          </div>
        </div>
        <p className="sub">
          {filtradas.length} conta(s){contas.length > 0 ? ` de ${contas.length}` : ''}.
        </p>
      </section>

      <section className="cartao">
        <table>
          <thead>
            <tr>
              <th>Código</th>
              <th>Descrição</th>
              <th>Classificação</th>
              <th>Natureza / grupo</th>
              <th>Tipo</th>
            </tr>
          </thead>
          <tbody>
            {filtradas.slice(0, 300).map((c) => (
              <tr key={`${c.codigoReduzido}-${c.classificacao}`}>
                <td>
                  <strong>{c.codigoReduzido}</strong>
                </td>
                <td>{c.descricao}</td>
                <td>{c.classificacao}</td>
                <td>{c.natureza || '—'}</td>
                <td>{c.tipo === 'A' ? 'Analítica' : 'Grupo'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtradas.length > 300 && (
          <p className="sub">Mostrando as primeiras 300. Refine a busca para ver as demais.</p>
        )}
      </section>
    </main>
  );
}
