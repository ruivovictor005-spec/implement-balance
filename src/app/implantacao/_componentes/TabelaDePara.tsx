'use client';
import * as React from 'react';
import { useState } from 'react';
import type { LinhaResolvida } from '../../../motor/converter.js';
import type { ContaBusca } from '../acoes.js';
import { BuscaConta } from './BuscaConta.js';

const brl = (n: number): string => n.toLocaleString('pt-BR', { minimumFractionDigits: 2 });

/** Célula do meio: onde a pessoa INDICA a conta do Domínio (ou troca a que o motor sugeriu). */
function CelulaDominio({
  linha,
  contas,
  porCodigo,
  onIndicar,
  editavel,
}: {
  linha: LinhaResolvida;
  contas: ContaBusca[];
  porCodigo: Map<string, ContaBusca>;
  onIndicar: (codiCta: string, codigo: string) => void;
  editavel: boolean;
}) {
  const [editando, setEditando] = useState(false);
  const pendente = linha.origem === 'nao_encontrado';
  const atencao = linha.status.toLowerCase().includes('conferir');
  const conta = linha.codigo ? porCodigo.get(linha.codigo) ?? null : null;

  if (!editavel) {
    return (
      <div className={`resultado${atencao ? ' atencao' : ''}`}>
        {linha.codigo ? (
          <>
            <div className="conta-dominio">
              <strong className="cod">{linha.codigo}</strong>
              {conta ? ` ${conta.descricao}` : ''}
            </div>
            <div className="meta">
              {conta ? `class. ${conta.classificacao} · ${conta.natureza || 'sem natureza'}` : linha.status}
            </div>
          </>
        ) : (
          <span className="status-pend">{linha.status}</span>
        )}
      </div>
    );
  }

  if (pendente || editando) {
    return (
      <div className="indicar">
        <BuscaConta
          contas={contas}
          onSelecionar={(codigo) => {
            onIndicar(linha.codiCta, codigo);
            setEditando(false);
          }}
        />
        {editando && (
          <button type="button" className="secundario pequeno" onClick={() => setEditando(false)}>
            Cancelar
          </button>
        )}
      </div>
    );
  }

  return (
    <div className={`resultado${atencao ? ' atencao' : ''}`}>
      <div className="conta-dominio">
        <strong className="cod">{linha.codigo}</strong>
        {conta ? ` ${conta.descricao}` : ''}
      </div>
      <div className="meta">
        {conta ? `class. ${conta.classificacao} · ${conta.natureza || 'sem natureza'}` : linha.status}
      </div>
      {atencao && <div className="status-pend">{linha.status}</div>}
      <button type="button" className="secundario pequeno" onClick={() => setEditando(true)}>
        Trocar conta
      </button>
    </div>
  );
}

function colunaOrigem(linha: LinhaResolvida) {
  return (
    <>
      <strong>{linha.nomeCta || '(sem nome)'}</strong>
      <div className="meta">
        <span className="cod">{linha.codiCta}</span> · class. {linha.clasCta || '—'} ·{' '}
        {linha.natureza || 'sem natureza'}
      </div>
    </>
  );
}

/** Aba De-para: para cada conta de ORIGEM (esquerda), a conta do DOMÍNIO (direita) que a pessoa
 *  indica na coluna do meio. Mostra todas as contas analíticas. */
export function TabelaDePara({
  linhas,
  contas,
  onIndicar,
  editavel = true,
}: {
  linhas: LinhaResolvida[];
  contas: ContaBusca[];
  onIndicar: (codiCta: string, codigo: string) => void;
  editavel?: boolean;
}) {
  const porCodigo = new Map(contas.map((c) => [c.codigoReduzido, c]));
  return (
    <section className="cartao">
      <h2>De-para — conta de origem → conta no Domínio</h2>
      <p className="sub">
        À esquerda, a conta como veio no balancete. No meio, você indica (ou troca) a conta do Domínio.
      </p>
      <table className="depara">
        <thead>
          <tr>
            <th>Conta de origem</th>
            <th style={{ textAlign: 'right' }}>Saldo atual</th>
            <th>→ Conta no Domínio</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((l) => (
            <tr
              key={l.codiCta}
              data-codi={l.codiCta}
              className={l.origem === 'nao_encontrado' ? 'pendente' : undefined}
            >
              <td>{colunaOrigem(l)}</td>
              <td className="num">{brl(l.saldoAtual)}</td>
              <td className="col-dominio">
                <CelulaDominio linha={l} contas={contas} porCodigo={porCodigo} onIndicar={onIndicar} editavel={editavel} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

/** Aba Pendências: só as contas que ainda não têm conta no Domínio. Mesma indicação, visão enxuta. */
export function Pendencias({
  linhas,
  contas,
  onIndicar,
  editavel = true,
}: {
  linhas: LinhaResolvida[];
  contas: ContaBusca[];
  onIndicar: (codiCta: string, codigo: string) => void;
  editavel?: boolean;
}) {
  const pendentes = linhas.filter((l) => l.origem === 'nao_encontrado');
  const porCodigo = new Map(contas.map((c) => [c.codigoReduzido, c]));

  if (pendentes.length === 0) {
    return (
      <section className="cartao">
        <h2>Pendências</h2>
        <div className="vazio-ok">
          <strong>Nenhuma pendência.</strong> Todas as contas já têm conta no Domínio.
        </div>
      </section>
    );
  }

  return (
    <section className="cartao">
      <h2>Pendências — {pendentes.length} conta(s) a indicar</h2>
      <p className="sub">Contas do balancete que ainda não têm conta correspondente no Domínio.</p>
      <table className="depara">
        <thead>
          <tr>
            <th>Cód. origem</th>
            <th>Nome da conta</th>
            <th>Classificação</th>
            <th style={{ textAlign: 'right' }}>Saldo atual</th>
            <th>Indicar conta no Domínio</th>
          </tr>
        </thead>
        <tbody>
          {pendentes.map((l) => (
            <tr key={l.codiCta} data-codi={l.codiCta} className="pendente">
              <td className="cod">{l.codiCta}</td>
              <td>
                <strong>{l.nomeCta || '(sem nome)'}</strong>
                <div className="meta">{l.natureza || 'sem natureza'}</div>
              </td>
              <td className="cod">{l.clasCta || '—'}</td>
              <td className="num">{brl(l.saldoAtual)}</td>
              <td className="col-dominio">
                <CelulaDominio linha={l} contas={contas} porCodigo={porCodigo} onIndicar={onIndicar} editavel={editavel} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
