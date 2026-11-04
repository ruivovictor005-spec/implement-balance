'use client';
import * as React from 'react';
import { useCallback, useEffect, useState } from 'react';
import type { MinhaProposta } from '../../dados/sinonimos.js';
import {
  buscar,
  desfazer,
  ensinar,
  listarEventos,
  minhasPropostas,
  solicitar,
  souAdmin,
  type EventoRecente,
} from './acoes.js';
import { Busca } from './_componentes/Busca.js';
import { Historico } from './_componentes/Historico.js';
import { MinhasPropostas } from './_componentes/MinhasPropostas.js';
import { RegrasExistentes } from './_componentes/RegrasExistentes.js';

export default function Pagina() {
  const [propostas, setPropostas] = useState<MinhaProposta[]>([]);
  const [eventos, setEventos] = useState<EventoRecente[]>([]);
  const [admin, setAdmin] = useState(false);

  const recarregar = useCallback(async () => {
    const [p, e, a] = await Promise.all([minhasPropostas(), listarEventos(), souAdmin()]);
    setPropostas(p);
    setEventos(e);
    setAdmin(a);
  }, []);

  useEffect(() => {
    void recarregar();
  }, [recarregar]);

  return (
    <main>
      <h1>Sinônimos da base compartilhada</h1>
      <p className="sub">
        <a href="/">← Minha mesa</a>
        {admin && (
          <>
            {' · '}
            <a href="/admin">Painel do administrador</a>
          </>
        )}
      </p>

      <Busca
        admin={admin}
        onEnsinar={async (nome, codigo) => {
          const r = await ensinar(nome, codigo);
          await recarregar();
          return r;
        }}
      />

      <RegrasExistentes
        admin={admin}
        onBuscar={buscar}
        onAlterar={async (id, codigo, eventoConhecido) => {
          const r = await solicitar(id, codigo, eventoConhecido);
          await recarregar();
          return r;
        }}
      />

      <MinhasPropostas propostas={propostas} />

      <Historico
        eventos={eventos}
        podeDesfazer={admin}
        onDesfazer={async (eventoId) => {
          await desfazer(eventoId);
          await recarregar();
        }}
      />
    </main>
  );
}
