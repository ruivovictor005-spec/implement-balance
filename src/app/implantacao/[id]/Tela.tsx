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
import { AreaArquivo } from '../_componentes/AreaArquivo.js';
import { MapeamentoColunas } from '../_componentes/MapeamentoColunas.js';
import { PreviaDominio } from '../_componentes/PreviaDominio.js';
import { DadosEmpresa } from '../_componentes/DadosEmpresa.js';
import { PainelConferencia } from '../_componentes/PainelConferencia.js';
import { RegistrarContaCriada } from '../_componentes/RegistrarContaCriada.js';
import { TabelaLinhas } from '../_componentes/TabelaLinhas.js';

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
      setTimeout(() => {
        montado.current = true;
      }, 0);
    })();
  }, [id]);

  // Salva os dados da empresa e recalcula pouco depois de a pessoa parar de digitar.
  useEffect(() => {
    if (!montado.current) return;
    const t = setTimeout(() => {
      void (async () => {
        await salvarDadosEmpresa(id, dados);
        const r = await recalcular(id);
        setPainel(r.painel);
        setLinhas(r.linhas);
      })();
    }, 600);
    return () => clearTimeout(t);
  }, [dados, id]);

  // Consulta de tempos em tempos se alguém ensinou um sinônimo que resolve as pendências.
  useEffect(() => {
    if (linhas.length === 0) return;
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
  }, [id, linhas.length]);

  const onArquivo = useCallback(
    async (arquivo: File) => {
      const bytes = new Uint8Array(await arquivo.arrayBuffer());
      ultimoArquivo.current = { bytes, nome: arquivo.name };
      setNomeArquivo(arquivo.name);
      setErro(null);
      try {
        const r = await anexarBalancete(id, { bytes, nomeArquivo: arquivo.name });
        if (!r.reconhecido) {
          setPrevia(r.previa);
          return;
        }
        setReconhecimento(r.reconhecimento);
        setPainel(r.painel);
        setLinhas(r.linhas);
        setLancamentos(r.lancamentos);
        setPrevia(null);
      } catch (e) {
        setErro((e as Error).message);
      }
    },
    [id],
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
        setPainel(r.painel);
        setLinhas(r.linhas);
        setLancamentos(r.lancamentos);
        setPrevia(null);
      } catch (e) {
        setErro((e as Error).message);
      }
    },
    [id],
  );

  const onUsarSoAqui = useCallback(
    async (codiCta: string, codigo: string) => {
      await definirAjusteManual(id, codiCta, codigo);
      const r = await recalcular(id);
      setPainel(r.painel);
      setLinhas(r.linhas);
      setLancamentos(r.lancamentos);
    },
    [id],
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
      setPainel(r.painel);
      setLinhas(r.linhas);
      setLancamentos(r.lancamentos);
    },
    [id],
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

  return (
    <main>
      <h1>Implantação de Saldos</h1>
      <p className="sub">
        <a href="/">← Minha mesa</a>
      </p>

      <DadosEmpresa valor={dados} onChange={setDados} />

      <AreaArquivo
        nomeArquivo={nomeArquivo}
        reconhecimento={reconhecimento}
        erro={erro}
        onArquivo={onArquivo}
      />

      {previa && <MapeamentoColunas previa={previa} onConfirmar={onMapear} />}

      {aviso && <div className="reconhecido">{aviso}</div>}

      {linhas.length > 0 && (
        <>
          <PainelConferencia
            painel={painel}
            justificativa={justificativa}
            onJustificativa={setJustificativa}
            onGerar={onGerar}
          />
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
          <TabelaLinhas linhas={linhas} contas={contas} onUsarSoAqui={onUsarSoAqui} />
          <PreviaDominio lancamentos={lancamentos} />
        </>
      )}
    </main>
  );
}
