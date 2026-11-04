'use client';
import * as React from 'react';
import { useCallback, useEffect, useState } from 'react';
import type {
  RegraNaturezaEditavel,
  RegraNormalizacaoEditavel,
  ResultadoRegra,
} from '../../dados/regras.js';
import {
  listarNatureza,
  listarNormalizacao,
  mudarNatureza,
  mudarNormalizacao,
} from './acoes.js';

/** Espaço vira "·" para a pessoa ver que a regra casa palavra inteira, não pedaço. */
const visivel = (t: string): string => t.replace(/ /g, '·');

type EdicaoNatureza = { id: number; natureza: string; grupos: string; naoMigrar: boolean };
type EdicaoNorm = { id: number; de: string; para: string; ativo: boolean };

/**
 * As duas tabelas de regras globais, para ver e corrigir.
 *
 * NATUREZA diz o que a classificação da conta de origem significa e em quais grupos do Domínio ela
 * pode cair. NORMALIZAÇÃO são as substituições que montam o nome comparável — e mexer nelas muda a
 * chave de todo sinônimo já gravado, por isso o aviso na tela: o recálculo é feito junto, na mesma
 * transação, mas é bom quem mexe saber o tamanho do que está mexendo.
 */
export function PainelRegras() {
  const [natureza, setNatureza] = useState<RegraNaturezaEditavel[]>([]);
  const [norm, setNorm] = useState<RegraNormalizacaoEditavel[]>([]);
  const [filtro, setFiltro] = useState('');
  const [edNat, setEdNat] = useState<EdicaoNatureza | null>(null);
  const [edNorm, setEdNorm] = useState<EdicaoNorm | null>(null);
  const [msg, setMsg] = useState<{ texto: string; ok: boolean } | null>(null);

  const recarregar = useCallback(async () => {
    const [n, m] = await Promise.all([listarNatureza(), listarNormalizacao()]);
    setNatureza(n);
    setNorm(m);
  }, []);

  useEffect(() => {
    void recarregar();
  }, [recarregar]);

  const aplicar = async (r: ResultadoRegra, sucesso: string): Promise<boolean> => {
    if (!r.ok) {
      setMsg({ texto: r.erro, ok: false });
      return false;
    }
    await recarregar();
    setMsg({ texto: r.aviso ? `${sucesso} ${r.aviso}` : sucesso, ok: true });
    return true;
  };

  const f = filtro.trim().toUpperCase();
  const normFiltradas =
    f === '' ? norm : norm.filter((r) => `${r.de} ${r.para}`.toUpperCase().includes(f));

  return (
    <main>
      <h1>Regras</h1>
      <p className="sub">
        <a href="/">← Minha mesa</a>
        {' · '}
        <a href="/sinonimos">Sinônimos</a>
        {' · '}
        <a href="/admin">Painel do administrador</a>
      </p>

      {msg !== null && <div className={msg.ok ? 'vazio-ok' : 'aviso-atencao'}>{msg.texto}</div>}

      <section className="cartao">
        <h2>Natureza — o que a classificação de origem significa</h2>
        <p className="sub">
          A primeira regra cujo prefixo casa com a classificação é a que vale. Os grupos do Domínio
          são os destinos que a conta pode ter: é por eles que uma despesa não cai numa conta de
          passivo. Prefixo e ordem não se mudam aqui — mexer neles é remontar a cascata.
        </p>
        <table>
          <thead>
            <tr>
              <th>Prefixo</th>
              <th>Natureza</th>
              <th>Grupos do Domínio</th>
              <th>Tabela</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {natureza.map((r) => (
              <tr key={r.id} data-regra-natureza={r.id}>
                <td className="cod">{r.prefixo}</td>
                <td>
                  {edNat?.id === r.id ? (
                    <input
                      aria-label={`Natureza de ${r.prefixo}`}
                      value={edNat.natureza}
                      onChange={(e) => setEdNat({ ...edNat, natureza: e.target.value })}
                    />
                  ) : (
                    <>
                      {r.natureza}
                      {r.naoMigrar && <div className="meta">não migra</div>}
                    </>
                  )}
                </td>
                <td>
                  {edNat?.id === r.id ? (
                    <>
                      <input
                        aria-label={`Grupos de ${r.prefixo}`}
                        placeholder="ex.: 42, 45"
                        value={edNat.grupos}
                        onChange={(e) => setEdNat({ ...edNat, grupos: e.target.value })}
                      />
                      <label className="chave">
                        <input
                          type="checkbox"
                          checked={edNat.naoMigrar}
                          onChange={(e) => setEdNat({ ...edNat, naoMigrar: e.target.checked })}
                        />
                        não migrar
                      </label>
                    </>
                  ) : (
                    <span className="cod">{r.gruposDominio.join(', ') || '—'}</span>
                  )}
                </td>
                <td className="meta">{r.conjunto === 'dominio' ? 'destino' : 'origem'}</td>
                <td>
                  {edNat?.id === r.id ? (
                    <div className="linha-acoes">
                      <button
                        type="button"
                        onClick={async () => {
                          const ok = await aplicar(
                            await mudarNatureza(
                              r.id,
                              edNat.natureza,
                              edNat.grupos.split(',').map((g) => g.trim()),
                              edNat.naoMigrar,
                            ),
                            'Regra de natureza alterada.',
                          );
                          if (ok) setEdNat(null);
                        }}
                      >
                        Salvar
                      </button>
                      <button
                        type="button"
                        className="secundario pequeno"
                        onClick={() => setEdNat(null)}
                      >
                        Cancelar
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="secundario pequeno"
                      onClick={() =>
                        setEdNat({
                          id: r.id,
                          natureza: r.natureza,
                          grupos: r.gruposDominio.join(', '),
                          naoMigrar: r.naoMigrar,
                        })
                      }
                    >
                      Mudar
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="cartao">
        <h2>Normalização — como o nome da conta vira nome comparável</h2>
        <p className="sub">
          Cada regra troca um trecho pelo outro, na ordem, antes de o nome ser comparado com o plano
          e com os sinônimos. O ponto <strong>·</strong> marca espaço: &quot;·DE·&quot; casa a
          palavra inteira, não o pedaço dentro de outra.{' '}
          <strong>
            Mudar uma regra aqui muda a chave de todos os sinônimos já ensinados e de todo o plano
          </strong>
          ; o recálculo é feito junto, na mesma transação, e a mudança é recusada se dois sinônimos
          passarem a ter a mesma chave.
        </p>

        <div className="linha-acoes">
          <input
            aria-label="Filtrar regras de normalização"
            placeholder="filtrar por trecho"
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
          />
          <span className="meta">
            {normFiltradas.length} de {norm.length}
          </span>
        </div>

        <table>
          <thead>
            <tr>
              <th>Etapa</th>
              <th>Procura</th>
              <th>Troca por</th>
              <th>Ativa</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {normFiltradas.map((r) => (
              <tr key={r.id} data-regra-norm={r.id} className={r.ativo ? undefined : 'linha-origem'}>
                <td className="meta">{r.etapa}</td>
                <td>
                  {edNorm?.id === r.id ? (
                    <input
                      aria-label={`Trecho procurado da regra ${r.id}`}
                      value={edNorm.de}
                      onChange={(e) => setEdNorm({ ...edNorm, de: e.target.value })}
                    />
                  ) : (
                    <span className="cod">{visivel(r.de)}</span>
                  )}
                </td>
                <td>
                  {edNorm?.id === r.id ? (
                    <input
                      aria-label={`Troca da regra ${r.id}`}
                      value={edNorm.para}
                      onChange={(e) => setEdNorm({ ...edNorm, para: e.target.value })}
                    />
                  ) : (
                    <span className="cod">{visivel(r.para) || '(nada)'}</span>
                  )}
                </td>
                <td>
                  {edNorm?.id === r.id ? (
                    <input
                      type="checkbox"
                      aria-label={`Regra ${r.id} ativa`}
                      checked={edNorm.ativo}
                      onChange={(e) => setEdNorm({ ...edNorm, ativo: e.target.checked })}
                    />
                  ) : (
                    <span className="meta">{r.ativo ? 'sim' : 'não'}</span>
                  )}
                </td>
                <td>
                  {edNorm?.id === r.id ? (
                    <div className="linha-acoes">
                      <button
                        type="button"
                        onClick={async () => {
                          const ok = await aplicar(
                            await mudarNormalizacao(r.id, edNorm.de, edNorm.para, edNorm.ativo),
                            'Regra de normalização alterada.',
                          );
                          if (ok) setEdNorm(null);
                        }}
                      >
                        Salvar
                      </button>
                      <button
                        type="button"
                        className="secundario pequeno"
                        onClick={() => setEdNorm(null)}
                      >
                        Cancelar
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="secundario pequeno"
                      onClick={() => setEdNorm({ id: r.id, de: r.de, para: r.para, ativo: r.ativo })}
                    >
                      Mudar
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
