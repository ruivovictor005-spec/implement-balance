'use client';
import * as React from 'react';
import type { ParametrosEntrada } from '../acoes.js';

export const soDigitos = (s: string): string => s.replace(/\D/g, '');
export const cnpjValido = (cnpj: string): boolean => soDigitos(cnpj).length === 14;

export function DadosEmpresa({
  valor,
  onChange,
}: {
  valor: ParametrosEntrada;
  onChange: (v: ParametrosEntrada) => void;
}) {
  const set = (campo: keyof ParametrosEntrada, v: string | boolean): void =>
    onChange({ ...valor, [campo]: v });
  const cnpjErrado = valor.cnpj.trim() !== '' && !cnpjValido(valor.cnpj);

  return (
    <section className="cartao">
      <h2>Dados da empresa e do lote</h2>
      <div className="grade">
        <div>
          <label htmlFor="data">Data do saldo</label>
          <input id="data" type="date" value={valor.dataSaldo} onChange={(e) => set('dataSaldo', e.target.value)} />
        </div>
        <div>
          <label htmlFor="cnpj">CNPJ</label>
          <input
            id="cnpj"
            type="text"
            value={valor.cnpj}
            placeholder="00.000.000/0001-00"
            onChange={(e) => set('cnpj', e.target.value)}
          />
          {cnpjErrado && (
            <div className="erro-campo">
              CNPJ precisa de 14 dígitos (tem {soDigitos(valor.cnpj).length}).
            </div>
          )}
        </div>
        <div>
          <label htmlFor="empresa">Código da empresa no Domínio</label>
          <input
            id="empresa"
            type="text"
            value={valor.codigoEmpresa}
            onChange={(e) => set('codigoEmpresa', e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="lote">Tipo do lote</label>
          <input id="lote" type="text" value={valor.tipoLote} onChange={(e) => set('tipoLote', e.target.value)} />
        </div>
        <div>
          <label htmlFor="hist">Código do histórico</label>
          <input
            id="hist"
            type="text"
            value={valor.codigoHistorico}
            onChange={(e) => set('codigoHistorico', e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="cab">Incluir cabeçalho (registro 01)</label>
          <select
            id="cab"
            value={valor.incluirCabecalho ? 'S' : 'N'}
            onChange={(e) => set('incluirCabecalho', e.target.value === 'S')}
          >
            <option value="N">Não</option>
            <option value="S">Sim</option>
          </select>
        </div>
      </div>
    </section>
  );
}
