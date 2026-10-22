'use client';
import * as React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Celula } from '../../../leitores/ler-arquivo.js';
import type { LinhaResolvida, Painel } from '../../../motor/converter.js';
import {
  anexarBalancete,
  carregarContas,
  concluir,
  definirAjusteManual,
  estadoImplantacao,
  gerarTxt,
  lerPrevia,
  reaplicar,
  recalcular,
  registrarContaCriada,
  salvarDadosEmpresa,
  type ContaBusca,
  type ContaCriadaEntrada,
  type DadosEmpresaForm,
  type Lancamento,
  type Reconhecimento,
} from '../acoes.js';
import { Abas, type AbaId } from '../_componentes/Abas.js';
import { AreaArquivo } from '../_componentes/AreaArquivo.js';
import { MapeamentoColunas } from '../_componentes/MapeamentoColunas.js';
import { PreviaBalancete } from '../_componentes/PreviaBalancete.js';
import { TabelaDePara, Pendencias } from '../_componentes/TabelaDePara.js';
import { DadosEmpresa } from '../_componentes/DadosEmpresa.js';
import { PainelConferencia } from '../_componentes/PainelConferencia.js';
import { RegistrarContaCriada } from '../_componentes/RegistrarContaCriada.js';

const PAINEL_VAZIO: Painel = {
  analiticas: 0,
  mapeadas: 0,
  pendentes: 0,
  saldoPendente: 0,
  totalDebito: 0,
  totalCredito: 0,
  diferenca: 0,
  pronto: false,
  status: 'Anexe o balancete para começar.',
};

const DADOS_VAZIO: DadosEmpresaForm = {
  dataSaldo: '',
  cnpj: '',
  codigoEmpresa: '',
  tipoLote: 'V',
  codigoHistorico: '700',
  incluirCabecalho: false,
};

export function Tela({ id }: { id: number }) {
  const [dados, setDados] = useState<DadosEmpresaForm>(DADOS_VAZIO);
  const [reconhecimento, setReconhecimento] = useState<Reconhecimento | null>(null);
  const [nomeArquivo, setNomeArquivo] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [painel, setPainel] = useState<Painel>(PAINEL_VAZIO);
  const [linhas, setLinhas] = useState<LinhaResolvida[]>([]);
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  const [contas, setContas] = useState<ContaBusca[]>([]);
  const [justificativa, setJustificativa] = useState('');
  const [aviso, setAviso] = useState<string | null>(null);
  const [previa, setPrevia] = useState<Celula[][] | null>(null);
  const [previaManual, setPreviaManual] = useState(false);
  const [aba, setAba] = useState<AbaId>('config');
  const [editavel, setEditavel] = useState(true);
  const montado = useRef(false);
  const ultimoArquivo = useRef<{ bytes: Uint8Array; nome: string } | null>(null);

  useEffect(() => {
    void (async () => {
      const [estado, lista] = await Promise.all([estadoImplantacao(id), carregarContas()]);
      setDados(estado.dados);
      setReconhecimento(estado.reconhecimento);
      setPainel(estado.painel);
      setLinhas(estado.linhas);
      setLancamentos(estado.lancamentos);
      setContas(lista);
      setEditavel(estado.editavel);
      if (estado.linhas.length > 0) setAba('depara');
      setTimeout(() => {
        montado.current = true;
      }, 0);
    })();
  }, [id]);

  // Salva os dados da empresa e recalcula pouco depois de a pessoa parar de digitar.
  useEffect(() => {
    if (!montado.current || !editavel) return;
    const t = setTimeout(() => {
      void (async () => {
        await salvarDadosEmpresa(id, dados);
        const r = await recalcular(id);
        setPainel(r.painel);
        setLinhas(r.linhas);
        setLancamentos(r.lancamentos);
      })();
    }, 600);
    return () => clearTimeout(t);
  }, [dados, id, editavel]);

  // Consulta de tempos em tempos se alguém ensinou um sinônimo que resolve as pendências.
  useEffect(() => {
    if (linhas.length === 0 || !editavel) return;
    const t = setInterval(() => {
      void (async () => {
        const r = await reaplicar(id);
        if (r.resolvidas > 0) {
          const fresh = await recalcular(id);
          setPainel(fresh.painel);
          setLinhas(fresh.linhas);
          setLancamentos(fresh.lancamentos);
          const quem = r.porQuem.length > 0 ? ` pelo que ${r.porQuem.join(', ')} ensinou` : '';
          setAviso(`${r.resolvidas} pendência(s) resolvida(s) sozinha(s)${quem}.`);
        }
      })();
    }, 15000);
    return () => clearInterval(t);
  }, [id, linhas.length, editavel]);

  const aplicarResultado = useCallback(
    (r: { painel: Painel; linhas: LinhaResolvida[]; lancamentos: Lancamento[] }) => {
      setPainel(r.painel);
      setLinhas(r.linhas);
      setLancamentos(r.lancamentos);
    },
    [],
  );

  const onArquivo = useCallback(
    async (arquivo: File) => {
      const bytes = new Uint8Array(await arquivo.arrayBuffer());
      ultimoArquivo.current = { bytes, nome: arquivo.name };
      setNomeArquivo(arquivo.name);
      setErro(null);
      setPreviaManual(false);
      try {
        const r = await anexarBalancete(id, { bytes, nomeArquivo: arquivo.name });
        if (!r.reconhecido) {
          setPrevia(r.previa);
          return;
        }
        setReconhecimento(r.reconhecimento);
        aplicarResultado(r);
        setPrevia(null);
        setAba('depara');
      } catch (e) {
        setErro((e as Error).message);
      }
    },
    [id, aplicarResultado],
  );

  const onMapear = useCallback(
    async (linhaCabecalho: number, colunas: Record<string, number>) => {
      const a = ultimoArquivo.current;
      if (a === null) return;
      setErro(null);
      try {
        const r = await anexarBalancete(id, { bytes: a.bytes, nomeArquivo: a.nome }, { linhaCabecalho, colunas });
        if (!r.reconhecido) {
          setErro('Ainda não consegui ler com esse mapeamento; confira as colunas.');
          return;
        }
        setReconhecimento(r.reconhecimento);
        aplicarResultado(r);
        setPrevia(null);
        setPreviaManual(false);
        setAba('depara');
      } catch (e) {
        setErro((e as Error).message);
      }
    },
    [id, aplicarResultado],
  );

  // "Ajustar colunas" sob demanda: lê a prévia do último arquivo anexado nesta sessão.
  const onAjustarColunas = useCallback(async () => {
    const a = ultimoArquivo.current;
    if (a === null) return;
    setErro(null);
    const p = await lerPrevia({ bytes: a.bytes, nomeArquivo: a.nome });
    setPrevia(p);
    setPreviaManual(true);
  }, []);

  const onIndicar = useCallback(
    async (codiCta: string, codigo: string) => {
      await definirAjusteManual(id, codiCta, codigo);
      const r = await recalcular(id);
      aplicarResultado(r);
    },
    [id, aplicarResultado],
  );

  const onRegistrarConta = useCallback(
    async (conta: ContaCriadaEntrada) => {
      await registrarContaCriada(id, conta);
      setContas((atual) => [
        {
          codigoReduzido: conta.codigoReduzido,
          classificacao: conta.classificacao,
          descricao: conta.descricao,
          tipo: 'A' as const,
          descricaoNormalizada: '',
          natureza: '(conta criada nesta sessão)',
        },
        ...atual,
      ]);
      const r = await recalcular(id);
      aplicarResultado(r);
    },
    [id, aplicarResultado],
  );

  const onGerar = useCallback(async () => {
    setAviso(null);
    const r = await gerarTxt(id, painel.pronto ? undefined : justificativa);
    if (!r.ok) {
      setAviso(r.erro);
      return;
    }
    const blob = new Blob([r.conteudo], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = r.nomeArquivo;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, [id, painel.pronto, justificativa]);

  const onConcluir = useCallback(async () => {
    setAviso(null);
    const r = await concluir(id, painel.pronto ? undefined : justificativa);
    if (!r.ok) {
      setAviso(r.erro);
      return;
    }
    window.location.href = '/';
  }, [id, painel.pronto, justificativa]);

  const temArquivoNaSessao = ultimoArquivo.current !== null;
  const temLinhas = linhas.length > 0;

  return (
    <main>
      <header className="cab-impl">
        <div>
          <h1>Implementação de saldos</h1>
          <p className="sub" style={{ margin: 0 }}>
            <a href="/">← Minha mesa</a>
          </p>
        </div>
        {temLinhas && (
          <div className={`pill ${painel.pronto ? 'pronto' : 'revisar'}`}>
            <span className="ponto" />
            {painel.pronto ? 'Pronto para importar' : `${painel.pendentes} pendência(s) · dif. verificar`}
          </div>
        )}
      </header>

      {aviso && <div className="reconhecido">{aviso}</div>}

      {!editavel && (
        <div className="erro" style={{ marginTop: 0 }}>
          Esta implantação já foi concluída ou descartada — você está só visualizando (somente leitura).
        </div>
      )}

      <Abas aba={aba} onAba={setAba} pendentes={painel.pendentes} total={linhas.length} />

      {aba === 'config' && (
        <>
          <DadosEmpresa valor={dados} onChange={editavel ? setDados : () => {}} />
          {editavel && (
            <AreaArquivo
              nomeArquivo={nomeArquivo}
              reconhecimento={reconhecimento}
              erro={erro}
              onArquivo={onArquivo}
            />
          )}
          {editavel && temArquivoNaSessao && previa === null && (
            <div className="cartao" style={{ paddingTop: 14, paddingBottom: 14 }}>
              <div className="linha-acoes" style={{ marginTop: 0, justifyContent: 'space-between' }}>
                <span className="meta">
                  Os nomes não vieram certos ou o layout está diferente? Aponte as colunas à mão.
                </span>
                <button type="button" className="secundario" onClick={onAjustarColunas}>
                  Ajustar colunas do arquivo
                </button>
              </div>
            </div>
          )}
          {previa && (
            <MapeamentoColunas
              previa={previa}
              onConfirmar={onMapear}
              titulo={previaManual ? 'Ajustar as colunas do arquivo' : 'Apontar as colunas manualmente'}
              descricao={
                previaManual
                  ? 'Indique a linha do cabeçalho e qual coluna é cada campo — principalmente o nome da conta.'
                  : 'O layout não foi reconhecido. Indique a linha do cabeçalho e qual coluna é cada campo.'
              }
              onCancelar={previaManual ? () => setPrevia(null) : undefined}
            />
          )}
          {temLinhas && (
            <>
              <PainelConferencia
                painel={painel}
                justificativa={justificativa}
                onJustificativa={setJustificativa}
                onGerar={onGerar}
              />
              {editavel && (
                <>
                  <section className="cartao">
                    <h2>Concluir</h2>
                    <p className="sub">Baixe o TXT e conclua. Depois de concluída, a implantação sai da sua mesa.</p>
                    <div className="linha-acoes">
                      <button type="button" className="secundario" onClick={onConcluir}>
                        Concluir implantação
                      </button>
                    </div>
                  </section>
                  <RegistrarContaCriada onRegistrar={onRegistrarConta} />
                </>
              )}
            </>
          )}
        </>
      )}

      {aba === 'depara' &&
        (temLinhas ? (
          <TabelaDePara linhas={linhas} contas={contas} onIndicar={onIndicar} editavel={editavel} />
        ) : (
          <div className="cartao vazio">Anexe um balancete na aba Configuração para começar o de-para.</div>
        ))}

      {aba === 'previa' &&
        (temLinhas ? (
          <PreviaBalancete lancamentos={lancamentos} contas={contas} />
        ) : (
          <div className="cartao vazio">Anexe um balancete para ver a prévia no Domínio.</div>
        ))}

      {aba === 'pendencias' &&
        (temLinhas ? (
          <Pendencias linhas={linhas} contas={contas} onIndicar={onIndicar} editavel={editavel} />
        ) : (
          <div className="cartao vazio">Anexe um balancete para ver as pendências.</div>
        ))}
    </main>
  );
}
