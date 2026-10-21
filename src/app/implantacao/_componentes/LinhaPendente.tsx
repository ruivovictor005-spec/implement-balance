'use client';
import * as React from 'react';
import type { LinhaResolvida } from '../../../motor/converter.js';
import type { ContaBusca } from '../acoes.js';
import { BuscaConta } from './BuscaConta.js';

const brl = (n: number): string => n.toLocaleString('pt-BR', { minimumFractionDigits: 2 });

export function LinhaPendente({
  linha,
  contas,
  onUsarSoAqui,
}: {
  linha: LinhaResolvida;
  contas: ContaBusca[];
  onUsarSoAqui: (codiCta: string, codigo: string) => void;
}) {
  return (
    <tr className="pendente" data-codi={linha.codiCta} data-origem={linha.origem}>
      <td>{linha.codiCta}</td>
      <td>
        <strong>{linha.nomeCta}</strong>
        <br />
        <span className="status-pend">{linha.status}</span>
        <br />
        <span className="meta">
          grupo: classif. {linha.clasCta || '—'} · {linha.natureza || 'sem natureza'}
        </span>
        <BuscaConta contas={contas} onSelecionar={(codigo) => onUsarSoAqui(linha.codiCta, codigo)} />
        <div className="linha-acoes">
          <button type="button" disabled title="Chega junto com a base compartilhada">
            Ensinar para todos
          </button>
        </div>
        <div className="desabilitado-nota">
          “Ensinar para todos” chega junto com a base compartilhada (ainda não disponível). Por
          enquanto, “usar só aqui” resolve a conta apenas nesta implantação.
        </div>
      </td>
      <td className="num">{brl(linha.saldoAtual)}</td>
    </tr>
  );
}
