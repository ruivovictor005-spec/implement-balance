'use client';
import * as React from 'react';
import { useState } from 'react';

type Retorno = { ok: true; pendente: boolean; aviso?: string } | { ok: false; erro: string };

export function Busca({
  admin,
  onEnsinar,
}: {
  admin: boolean;
  onEnsinar: (nome: string, codigo: string) => Promise<Retorno>;
}) {
  const [nome, setNome] = useState('');
  const [codigo, setCodigo] = useState('');
  const [msg, setMsg] = useState<{ texto: string; ok: boolean } | null>(null);

  return (
    <section className="cartao">
      <h2>{admin ? 'Ensinar um sinônimo' : 'Propor um sinônimo'}</h2>
      <p className="sub">
        {admin
          ? 'Como administrador, o que você ensina já vale para todos.'
          : 'A proposta só passa a valer para todos depois que o administrador aprovar.'}
      </p>
      <div className="grade">
        <div>
          <label htmlFor="s-nome">Nome da conta (como vem no balancete)</label>
          <input id="s-nome" value={nome} onChange={(e) => setNome(e.target.value)} />
        </div>
        <div>
          <label htmlFor="s-cod">Código reduzido do Domínio</label>
          <input id="s-cod" value={codigo} onChange={(e) => setCodigo(e.target.value)} />
        </div>
      </div>
      <div className="linha-acoes">
        <button
          type="button"
          onClick={async () => {
            const r = await onEnsinar(nome.trim(), codigo.trim());
            if (!r.ok) {
              setMsg({ texto: r.erro, ok: false });
              return;
            }
            const base = r.pendente
              ? 'Proposta enviada. Vale para todos quando o administrador aprovar.'
              : 'Sinônimo ensinado para todos.';
            setMsg({ texto: r.aviso ? `${base} ${r.aviso}` : base, ok: true });
            setNome('');
            setCodigo('');
          }}
        >
          {admin ? 'Ensinar para todos' : 'Enviar para aprovação'}
        </button>
      </div>
      {msg && <div className={msg.ok ? 'reconhecido' : 'erro'}>{msg.texto}</div>}
    </section>
  );
}
