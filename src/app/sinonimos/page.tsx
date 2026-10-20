'use client';
import * as React from 'react';
import { useCallback, useEffect, useState } from 'react';
import {
  decidir,
  desfazer,
  ensinar,
  listarEventos,
  listarPendentes,
  type EventoRecente,
  type PedidoPendente,
} from './acoes.js';
import { Busca } from './_componentes/Busca.js';
import { FilaRevisao } from './_componentes/FilaRevisao.js';
import { Historico } from './_componentes/Historico.js';

export default function Pagina() {
  const [pendentes, setPendentes] = useState<PedidoPendente[]>([]);
  const [eventos, setEventos] = useState<EventoRecente[]>([]);

  const recarregar = useCallback(async () => {
    const [p, e] = await Promise.all([listarPendentes(), listarEventos()]);
    setPendentes(p);
    setEventos(e);
  }, []);

  useEffect(() => {
    void recarregar();
  }, [recarregar]);

  return (
    <main>
      <h1>Sinônimos da base compartilhada</h1>
      <p className="sub">
        <a href="/">← Minha mesa</a>
      </p>

      <Busca
        onEnsinar={async (nome, codigo, motivo) => {
          const r = await ensinar(nome, codigo, motivo);
          await recarregar();
          return r.ok ? null : r.erro;
        }}
      />

      <FilaRevisao
        pendentes={pendentes}
        onDecidir={async (id, aprovada) => {
          await decidir(id, aprovada, '');
          await recarregar();
        }}
      />

      <Historico
        eventos={eventos}
        onDesfazer={async (eventoId) => {
          await desfazer(eventoId);
          await recarregar();
        }}
      />
    </main>
  );
}
