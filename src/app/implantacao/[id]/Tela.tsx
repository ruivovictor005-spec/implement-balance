'use client';
import * as React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { LinhaResolvida, Painel } from '../../../motor/converter.js';
import {
  anexarBalancete,
  baixarTxt,
  carregarContas,
  definirAjusteManual,
  estadoImplantacao,
  reaplicar,
  recalcular,
  registrarContaCriada,
  salvarDadosEmpresa,
  type ContaBusca,
  type ContaCriadaEntrada,
  type DadosEmpresaForm,
  type Reconhecimento,
} from '../acoes.js';
import { AreaArquivo } from '../_componentes/AreaArquivo.js';
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
  const [contas, setContas] = useState<ContaBusca[]>([]);
  const [justificativa, setJustificativa] = useState('');
  const [aviso, setAviso] = useState<string | null>(null);
  const montado = useRef(false);

  useEffect(() => {
    void (async () => {
      const [estado, lista] = await Promise.all([estadoImplantacao(id), carregarContas()]);
      setDados(estado.dados);
      setReconhecimento(estado.reconhecimento);
      setPainel(estado.painel);
      setLinhas(estado.linhas);
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
      setNomeArquivo(arquivo.name);
      setErro(null);
      try {
        const r = await anexarBalancete(id, { bytes, nomeArquivo: arquivo.name });
        setReconhecimento(r.reconhecimento);
        setPainel(r.painel);
        setLinhas(r.linhas);
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
    },
    [id],
  );

  const onGerar = useCallback(async () => {
    const texto = await baixarTxt(id);
    const blob = new Blob([`${texto}\r\n`], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Importacao_Dominio.txt';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, [id]);

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

      {aviso && <div className="reconhecido">{aviso}</div>}

      {linhas.length > 0 && (
        <>
          <PainelConferencia
            painel={painel}
            justificativa={justificativa}
            onJustificativa={setJustificativa}
            onGerar={onGerar}
          />
          <RegistrarContaCriada onRegistrar={onRegistrarConta} />
          <TabelaLinhas linhas={linhas} contas={contas} onUsarSoAqui={onUsarSoAqui} />
        </>
      )}
    </main>
  );
}
