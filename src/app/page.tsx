'use client';
import * as React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Celula } from '../leitores/ler-arquivo.js';
import {
  carregarContas,
  processarArquivo,
  type ContaBusca,
  type ContaCriadaEntrada,
  type ParametrosEntrada,
  type ResultadoConversao,
} from './acoes.js';
import { AreaArquivo } from './_componentes/AreaArquivo.js';
import { DadosEmpresa } from './_componentes/DadosEmpresa.js';
import { MapeamentoColunas } from './_componentes/MapeamentoColunas.js';
import { PainelConferencia } from './_componentes/PainelConferencia.js';
import { RegistrarContaCriada } from './_componentes/RegistrarContaCriada.js';
import { TabelaLinhas } from './_componentes/TabelaLinhas.js';

function hojeIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const PARAMS_INICIAIS: ParametrosEntrada = {
  dataSaldo: hojeIso(),
  cnpj: '',
  codigoEmpresa: '',
  tipoLote: 'V',
  codigoHistorico: '700',
  incluirCabecalho: false,
};

export default function Pagina() {
  const [params, setParams] = useState<ParametrosEntrada>(PARAMS_INICIAIS);
  const [bytes, setBytes] = useState<Uint8Array | null>(null);
  const [nomeArquivo, setNomeArquivo] = useState<string | null>(null);
  const [ajustes, setAjustes] = useState<Record<string, string>>({});
  const [contasCriadas, setContasCriadas] = useState<ContaCriadaEntrada[]>([]);
  const [manual, setManual] = useState<{ linhaCabecalho: number; colunas: Record<string, number> } | null>(null);
  const [resultado, setResultado] = useState<ResultadoConversao | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [previa, setPrevia] = useState<Celula[][] | null>(null);
  const [contas, setContas] = useState<ContaBusca[]>([]);
  const [justificativa, setJustificativa] = useState('');

  const seq = useRef(0);

  useEffect(() => {
    carregarContas()
      .then(setContas)
      .catch(() => setContas([]));
  }, []);

  useEffect(() => {
    if (bytes === null || nomeArquivo === null) return;
    const meu = ++seq.current;
    processarArquivo({
      bytes,
      nomeArquivo,
      parametros: params,
      ajustes: Object.entries(ajustes),
      contasCriadas,
      manual: manual ?? undefined,
    })
      .then((r) => {
        if (meu !== seq.current) return; // resposta velha, ignora
        if (r.ok) {
          setResultado(r.resultado);
          setErro(null);
          setPrevia(null);
        } else {
          setResultado(null);
          setErro(r.erro);
          setPrevia(r.previa ?? null);
        }
      })
      .catch((e) => {
        if (meu !== seq.current) return;
        setErro((e as Error).message);
      });
  }, [bytes, nomeArquivo, params, ajustes, contasCriadas, manual]);

  const onArquivo = useCallback(async (arquivo: File) => {
    const buf = new Uint8Array(await arquivo.arrayBuffer());
    setManual(null);
    setPrevia(null);
    setErro(null);
    setResultado(null);
    setAjustes({});
    setNomeArquivo(arquivo.name);
    setBytes(buf);
  }, []);

  const baixarTxt = useCallback(() => {
    if (resultado === null) return;
    const conteudo = `${resultado.txt.join('\r\n')}\r\n`;
    const blob = new Blob([conteudo], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Importacao_Dominio.txt';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, [resultado]);

  const contasComCriadas: ContaBusca[] = [
    ...contasCriadas.map((c) => ({
      codigoReduzido: c.codigoReduzido,
      classificacao: c.classificacao,
      descricao: c.descricao,
      tipo: 'A' as const,
      descricaoNormalizada: '',
      natureza: '(conta criada nesta sessão)',
    })),
    ...contas,
  ];

  return (
    <main>
      <h1>Implantação de Saldos</h1>
      <p className="sub">
        Converte o balancete de origem no arquivo de importação posicional do Domínio (leiaute 19).
      </p>

      <DadosEmpresa valor={params} onChange={setParams} />

      <AreaArquivo
        nomeArquivo={nomeArquivo}
        reconhecimento={resultado?.reconhecimento ?? null}
        erro={erro}
        onArquivo={onArquivo}
      />

      {previa && (
        <MapeamentoColunas
          previa={previa}
          onConfirmar={(linhaCabecalho, colunas) => setManual({ linhaCabecalho, colunas })}
        />
      )}

      {resultado && (
        <>
          <PainelConferencia
            painel={resultado.painel}
            justificativa={justificativa}
            onJustificativa={setJustificativa}
            onGerar={baixarTxt}
          />
          <RegistrarContaCriada onRegistrar={(c) => setContasCriadas((atual) => [...atual, c])} />
          <TabelaLinhas
            linhas={resultado.linhas}
            contas={contasComCriadas}
            onUsarSoAqui={(codiCta, codigo) => setAjustes((atual) => ({ ...atual, [codiCta]: codigo }))}
          />
        </>
      )}
    </main>
  );
}
