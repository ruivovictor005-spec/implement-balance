'use client';
import * as React from 'react';
import { useState } from 'react';

export function Busca({
  onEnsinar,
}: {
  onEnsinar: (nome: string, codigo: string, motivo: string) => Promise<string | null>;
}) {
  const [nome, setNome] = useState('');
  const [codigo, setCodigo] = useState('');
  const [motivo, setMotivo] = useState('');
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <section className="cartao">
      <h2>Ensinar um sinônimo</h2>
      <div className="grade">
        <div>
          <label htmlFor="s-nome">Nome da conta (como vem no balancete)</label>
          <input id="s-nome" value={nome} onChange={(e) => setNome(e.target.value)} />
        </div>
        <div>
          <label htmlFor="s-cod">Código reduzido do Domínio</label>
          <input id="s-cod" value={codigo} onChange={(e) => setCodigo(e.target.value)} />
        </div>
        <div>
          <label htmlFor="s-mot">Motivo</label>
          <input id="s-mot" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
        </div>
      </div>
      <div className="linha-acoes">
        <button
          type="button"
          onClick={async () => {
            const erro = await onEnsinar(nome.trim(), codigo.trim(), motivo.trim());
            setMsg(erro ?? 'Sinônimo ensinado para todos.');
            if (erro === null) {
              setNome('');
              setCodigo('');
              setMotivo('');
            }
          }}
        >
          Ensinar para todos
        </button>
      </div>
      {msg && <div className={msg.includes('ensinado') ? 'reconhecido' : 'erro'}>{msg}</div>}
    </section>
  );
}
