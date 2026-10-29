'use client';
import * as React from 'react';
import { useEffect, useState } from 'react';
import { excluirImplantacao, iniciarERedirecionar, type ImplantacaoAberta } from '../acoes.js';

const dataBR = (d: Date | string): string =>
  new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });

export function Mesa({ abertas }: { abertas: ImplantacaoAberta[] }) {
  const [lista, setLista] = useState<ImplantacaoAberta[]>(abertas);
  const [confirmando, setConfirmando] = useState<number | null>(null);
  const [excluindo, setExcluindo] = useState<number | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  // O servidor é a verdade: quando a página é renderizada de novo, a lista local volta a segui-lo.
  useEffect(() => {
    setLista(abertas);
  }, [abertas]);

  const excluir = async (id: number): Promise<void> => {
    setExcluindo(id);
    setErro(null);
    try {
      const r = await excluirImplantacao(id);
      if (!r.ok) {
        setErro(r.erro);
        setExcluindo(null);
        return;
      }
    } catch {
      setErro('Não consegui excluir agora. Confira a conexão e tente de novo.');
      setExcluindo(null);
      return;
    }
    setLista((atual) => atual.filter((a) => a.id !== id));
    setConfirmando(null);
    setExcluindo(null);
  };

  return (
    <main className="home">
      <h1>
        <span className="marca-glow">Implement Balance</span>
      </h1>
      <p className="sub">
        Converte o balancete de origem no arquivo de importação posicional do Domínio (leiaute 19).
      </p>

      <section className="cartao">
        <h2>Suas implantações em andamento</h2>
        {lista.length === 0 ? (
          <p className="sub" style={{ margin: '0 0 4px' }}>
            Nenhuma implantação aberta. Comece uma nova para implantar os saldos de uma empresa.
          </p>
        ) : (
          <ul className="lista-abertas">
            {lista.map((a) => (
              <li key={a.id} className="item-linha">
                <a className="item-aberta" href={`/implantacao/${a.id}`}>
                  <span className="item-nome">
                    {a.empresaNome && a.empresaNome.trim() !== ''
                      ? a.empresaNome
                      : 'Empresa sem nome'}
                  </span>
                  <span className="meta">
                    {a.empresaCnpj && a.empresaCnpj.trim() !== '' ? `${a.empresaCnpj} · ` : ''}
                    {a.guardadaEm !== null ? (
                      `salva em ${dataBR(a.guardadaEm)} para continuar`
                    ) : (
                      <>
                        aberta em {dataBR(a.iniciadaEm)} ·{' '}
                        <span className="status-pend">não salva</span>
                      </>
                    )}
                  </span>
                  <span className="item-seta" aria-hidden="true">
                    Continuar →
                  </span>
                </a>
                {confirmando === a.id ? (
                  <div className="item-confirma">
                    <span className="meta">Excluir esta implantação?</span>
                    <button
                      type="button"
                      className="perigo pequeno"
                      disabled={excluindo !== null}
                      onClick={() => void excluir(a.id)}
                    >
                      {excluindo === a.id ? 'Excluindo…' : 'Sim, excluir'}
                    </button>
                    <button
                      type="button"
                      className="secundario pequeno"
                      disabled={excluindo !== null}
                      onClick={() => setConfirmando(null)}
                    >
                      Não
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="secundario pequeno item-excluir"
                    aria-label={`Excluir implantação ${
                      a.empresaNome && a.empresaNome.trim() !== '' ? a.empresaNome : 'sem nome'
                    }`}
                    onClick={() => {
                      setErro(null);
                      setConfirmando(a.id);
                    }}
                  >
                    Excluir
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}

        {erro !== null && <div className="erro">{erro}</div>}

        <form action={iniciarERedirecionar} style={{ marginTop: 14 }}>
          <button type="submit" className={lista.length === 0 ? undefined : 'secundario'}>
            + Começar uma nova
          </button>
        </form>
      </section>
    </main>
  );
}
