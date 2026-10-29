'use client';
import * as React from 'react';
import type { LinhaResolvida } from '../../../motor/converter.js';
import { ladoDoSaldo } from '../../../motor/lado.js';
import { resumirBalancete, type LinhaResumo } from '../../../motor/resumo-balancete.js';

const brl = (n: number): string => n.toLocaleString('pt-BR', { minimumFractionDigits: 2 });

/** Saldo como no relatório: valor em módulo colado no D/C. Zero não tem lado. */
function Saldo({ valor }: { valor: number }) {
  const lado = ladoDoSaldo(valor);
  return (
    <>
      {brl(Math.abs(valor))}
      {lado !== null && <span className="lado">{lado}</span>}
    </>
  );
}

function Linha({ linha, forte }: { linha: LinhaResumo; forte?: boolean }) {
  const texto = forte ? <strong>{linha.rotulo}</strong> : linha.rotulo;
  return (
    <tr data-linha={linha.id}>
      <td>{texto}</td>
      <td className="num">
        <Saldo valor={linha.saldoAnterior} />
      </td>
      <td className="num">{brl(linha.totalDebito)}</td>
      <td className="num">{brl(linha.totalCredito)}</td>
      <td className="num">
        <Saldo valor={linha.saldoAtual} />
      </td>
    </tr>
  );
}

const VAZIA = (
  <tr className="resumo-espaco">
    <td colSpan={5} />
  </tr>
);

/**
 * O RESUMO DO BALANCETE que o Domínio imprime, calculado aqui a partir das linhas de ORIGEM — que
 * são as únicas que têm saldo anterior e movimento (os lançamentos da prévia já vêm agregados por
 * conta do Domínio). Serve para conferir os totais sem precisar importar para o Domínio primeiro.
 */
export function ResumoBalancete({ linhas }: { linhas: LinhaResolvida[] }) {
  const resumo = resumirBalancete(linhas);

  return (
    <section className="cartao">
      <h2>Resumo do balancete</h2>
      <p className="sub">
        Totais por grupo, contas devedoras e credoras e o resultado — conferidos a partir do arquivo
        de origem, sem precisar importar para o Domínio.
      </p>
      <table className="resumo-balancete">
        <thead>
          <tr>
            <th>Grupo</th>
            <th style={{ textAlign: 'right' }}>Saldo anterior</th>
            <th style={{ textAlign: 'right' }}>Débito</th>
            <th style={{ textAlign: 'right' }}>Crédito</th>
            <th style={{ textAlign: 'right' }}>Saldo atual</th>
          </tr>
        </thead>
        <tbody>
          {resumo.grupos.map((g) => (
            <Linha key={g.id} linha={g} />
          ))}
          {VAZIA}
          <Linha linha={resumo.devedoras} forte />
          <Linha linha={resumo.credoras} forte />
          {VAZIA}
          <Linha linha={resumo.resultadoDoMes} forte />
          <Linha linha={resumo.resultadoDoExercicio} forte />
        </tbody>
      </table>

      {resumo.foraDoResumo > 0 && (
        <div className="erro">
          {resumo.foraDoResumo} linha(s) ficaram fora do resumo porque a classificação delas não caiu
          em nenhuma natureza conhecida. Os totais acima não incluem essas linhas.
        </div>
      )}
    </section>
  );
}
