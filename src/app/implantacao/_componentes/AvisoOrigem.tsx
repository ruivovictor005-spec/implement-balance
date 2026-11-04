'use client';
import * as React from 'react';
import type { AuditoriaOrigem } from '../../../motor/origem.js';

const brl = (n: number): string =>
  Math.abs(n).toLocaleString('pt-BR', { minimumFractionDigits: 2 });

/** Valor em módulo com o lado, como num balancete: negativo é débito, positivo é crédito. */
const comLado = (n: number): string => `${brl(n)} ${n < 0 ? 'D' : 'C'}`;

/** O caminho de saída é o mesmo nos dois casos de sinal: fazer o arquivo dizer o lado. */
const COMO_RESOLVER = (
  <>
    O que fazer: exportar o balancete com o lado junto do valor (o sistema lê
    &quot;5.574,25D&quot;) ou com uma coluna de D/C ao lado do saldo — aí o lado vem da origem e não
    é deduzido. Dá também para ajustar o sinal da coluna de saldo no arquivo antes de anexar.
    Enquanto estiver assim, o aviso de lado conta por conta fica desligado: ele apontaria o
    balancete inteiro.
  </>
);

const NOME_DO_PLANO: Record<AuditoriaOrigem['plano'], string> = {
  cosif: 'COSIF (Infobank)',
  dominio: 'plano do Domínio',
  indefinido: 'não identificado',
};

/**
 * O que o sistema entendeu do arquivo recebido, antes de qualquer de-para: em que plano de contas a
 * origem está e se o sinal do saldo segue a convenção esperada.
 *
 * Existe porque as duas coisas, quando estão erradas, não estouram nada — produzem um resultado
 * inteiro errado em silêncio. Um balancete com o sinal trocado FECHA (débito e crédito trocados
 * somam igual), então nem a diferença do painel acusa; e lido pela tabela de natureza do outro
 * plano, cada conta recebe a natureza de outro grupo. Melhor dizer na cara o que foi assumido.
 */
export function AvisoOrigem({ origem }: { origem: AuditoriaOrigem }) {
  return (
    <section className="cartao">
      <h2>Como o arquivo foi lido</h2>
      <p className="sub">
        Plano de contas da origem: <strong>{NOME_DO_PLANO[origem.plano]}</strong>. É ele que decide a
        natureza de cada conta — no COSIF o grupo 4 é passivo, no Domínio é custo e despesa.
        {origem.plano === 'indefinido' && (
          <> Não deu para identificar pelos grupos, então foi lido como COSIF. Confira a natureza das
          contas no de-para antes de gerar o TXT.</>
        )}
      </p>

      {origem.convencao === 'invertida' ? (
        <div className="aviso-atencao">
          <strong>O sinal do saldo neste arquivo parece estar trocado.</strong> Somando as contas:
          as que deveriam ser devedoras (ativo, custo, despesa) dão{' '}
          <strong>{comLado(origem.devedoras)}</strong> e as que deveriam ser credoras (passivo,
          patrimônio líquido, receita) dão <strong>{comLado(origem.credoras)}</strong> — o contrário
          do esperado, nas {origem.conferidas} contas conferidas.
          <br />
          Lido como está, <strong>todos os lançamentos sairiam do lado contrário no TXT</strong>, e o
          balancete continuaria fechando — a diferença do painel não acusa isso. Por isso o painel não
          vai dizer &quot;pronto para importar&quot; enquanto estiver assim.
          <br />
          {COMO_RESOLVER}
        </div>
      ) : origem.convencao === 'ausente' ? (
        <div className="aviso-atencao">
          <strong>Este arquivo não diz de que lado (D/C) está cada saldo.</strong> Todos os{' '}
          {origem.conferidas} saldos conferidos têm o mesmo sinal — num balancete o ativo fica em
          débito e o passivo em crédito, então um arquivo todo de um sinal não traz essa informação:
          ela se perdeu na exportação.
          <br />
          Sem ela, <strong>não há como saber o lado de nenhum lançamento</strong>. Por isso o painel
          não vai dizer &quot;pronto para importar&quot; enquanto estiver assim.
          <br />
          {COMO_RESOLVER}
        </div>
      ) : origem.convencao === 'indefinida' ? (
        <p className="meta">
          Não houve evidência suficiente para conferir o sinal do saldo ({origem.conferidas} conta(s)
          com natureza reconhecida). Confira o D/C de algumas contas no de-para.
        </p>
      ) : (
        <p className="meta">
          Sinal do saldo conferido em {origem.conferidas} conta(s): devedoras somam{' '}
          {comLado(origem.devedoras)} e credoras {comLado(origem.credoras)}, como se espera.
        </p>
      )}
    </section>
  );
}
