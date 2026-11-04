'use client';
import * as React from 'react';
import { useState } from 'react';
import type { SinonimoAtivo } from '../../../dados/sinonimos.js';

type Retorno = { ok: true; aplicada: boolean; aviso?: string } | { ok: false; erro: string };

/** Formulário de troca aberto numa linha. Fica fora da linha para o estado não se perder. */
type Edicao = { id: number; codigo: string; motivo: string };

/**
 * Procurar uma regra que JÁ existe e mudar para onde ela aponta.
 *
 * É a metade que faltava da página: dava para ensinar um sinônimo novo, mas não para ver os que já
 * existem nem corrigi-los — e ensinar por cima era recusado com "já existe sinônimo para este nome;
 * para trocar, peça uma alteração", sem lugar nenhum para pedir. Daí "provisão de INSS" apontando
 * para INSS a Pagar seguir apontando.
 *
 * Mostra a conta de destino por extenso, não só o código: é lendo "INSS a Pagar" que se vê que a
 * regra está errada.
 */
export function RegrasExistentes({
  admin,
  onBuscar,
  onAlterar,
}: {
  admin: boolean;
  onBuscar: (termo: string) => Promise<SinonimoAtivo[]>;
  onAlterar: (
    sinonimoId: number,
    codigo: string,
    motivo: string,
    eventoConhecido?: number,
  ) => Promise<Retorno>;
}) {
  const [termo, setTermo] = useState('');
  const [achados, setAchados] = useState<SinonimoAtivo[] | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [edicao, setEdicao] = useState<Edicao | null>(null);
  const [msg, setMsg] = useState<{ texto: string; ok: boolean } | null>(null);

  const procurar = async (): Promise<void> => {
    const t = termo.trim();
    if (t === '') return;
    setBuscando(true);
    setMsg(null);
    try {
      setAchados(await onBuscar(t));
      setEdicao(null);
    } finally {
      setBuscando(false);
    }
  };

  return (
    <section className="cartao">
      <h2>Mudar uma regra que já existe</h2>
      <p className="sub">
        Procure pelo nome da conta como vem no balancete, pelo código de destino ou pelo nome da
        conta do Domínio. Depois é só apontar para onde ela deveria ir.
      </p>

      <div className="linha-acoes">
        <input
          aria-label="Procurar regra"
          placeholder="ex.: provisão INSS, FGTS, 227"
          value={termo}
          onChange={(e) => setTermo(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void procurar();
          }}
        />
        <button type="button" onClick={() => void procurar()} disabled={buscando}>
          {buscando ? 'Procurando…' : 'Procurar'}
        </button>
      </div>

      {msg !== null && <div className={msg.ok ? 'vazio-ok' : 'aviso-atencao'}>{msg.texto}</div>}

      {achados !== null && achados.length === 0 && (
        <div className="vazio">
          Nenhuma regra para &quot;{termo.trim()}&quot;. Se a conta está indo para o lugar errado sem
          regra nenhuma, ela está casando pelo nome com o plano — ensine um sinônimo acima para
          mandá-la para outro lugar.
        </div>
      )}

      {achados !== null && achados.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>Nome no balancete</th>
              <th>Vai hoje para</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {achados.map((s) => (
              <tr key={s.id} data-sinonimo={s.id}>
                <td>
                  {s.nomeOriginal}
                  <div className="meta cod">{s.chaveNormalizada}</div>
                </td>
                <td>
                  <span className="cod">{s.codigo}</span>{' '}
                  {s.descricaoConta ?? <span className="meta">(fora do plano vigente)</span>}
                  {s.classificacaoConta !== null && (
                    <div className="meta cod">{s.classificacaoConta}</div>
                  )}
                </td>
                <td>
                  {edicao?.id === s.id ? (
                    <div className="indicar">
                      <input
                        aria-label={`Novo código para ${s.nomeOriginal}`}
                        placeholder="novo código"
                        value={edicao.codigo}
                        onChange={(e) => setEdicao({ ...edicao, codigo: e.target.value })}
                      />
                      <input
                        aria-label={`Motivo da mudança de ${s.nomeOriginal}`}
                        placeholder="motivo"
                        value={edicao.motivo}
                        onChange={(e) => setEdicao({ ...edicao, motivo: e.target.value })}
                      />
                      <div className="linha-acoes">
                        <button
                          type="button"
                          onClick={async () => {
                            const r = await onAlterar(
                              s.id,
                              edicao.codigo.trim(),
                              edicao.motivo.trim(),
                              s.ultimoEventoId ?? undefined,
                            );
                            if (!r.ok) {
                              setMsg({ texto: r.erro, ok: false });
                              return;
                            }
                            const base = r.aplicada
                              ? 'Regra alterada para todos.'
                              : 'Pedido enviado. Vale quando o administrador aprovar.';
                            setEdicao(null);
                            // A re-busca limpa a mensagem, então ela é escrita DEPOIS — senão o
                            // aviso de sucesso sumia no mesmo instante em que aparecia.
                            await procurar();
                            setMsg({ texto: r.aviso ? `${base} ${r.aviso}` : base, ok: true });
                          }}
                        >
                          {admin ? 'Alterar para todos' : 'Pedir alteração'}
                        </button>
                        <button
                          type="button"
                          className="secundario pequeno"
                          onClick={() => setEdicao(null)}
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="secundario pequeno"
                      onClick={() => setEdicao({ id: s.id, codigo: '', motivo: '' })}
                    >
                      Mudar
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
