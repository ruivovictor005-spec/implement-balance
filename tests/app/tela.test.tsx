// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import * as React from 'react';
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';

afterEach(cleanup);
import type { LinhaResolvida } from '../../src/motor/converter.js';
import type { ContaBusca } from '../../src/app/acoes.js';
import { AreaArquivo } from '../../src/app/_componentes/AreaArquivo.js';
import { BuscaConta } from '../../src/app/_componentes/BuscaConta.js';
import { DadosEmpresa } from '../../src/app/_componentes/DadosEmpresa.js';
import { LinhaPendente } from '../../src/app/_componentes/LinhaPendente.js';
import { PainelConferencia } from '../../src/app/_componentes/PainelConferencia.js';
import { TabelaLinhas } from '../../src/app/_componentes/TabelaLinhas.js';

const linha = (over: Partial<LinhaResolvida>): LinhaResolvida => ({
  codiCta: 'x',
  nomeCta: 'Conta',
  clasCta: '1',
  tipoCta: 'A',
  saldoAnterior: 0,
  totalDebito: 0,
  totalCredito: 0,
  saldoAtual: 0,
  nomeNormalizado: '',
  natureza: '',
  gruposDominio: [],
  codigo: '10',
  origem: 'nome_igual',
  status: 'Nome igual ao plano',
  ...over,
});

const contaBusca = (over: Partial<ContaBusca>): ContaBusca => ({
  codigoReduzido: '18',
  classificacao: '1.1.1',
  descricao: 'Citibank',
  tipo: 'A',
  descricaoNormalizada: 'CITIBANK',
  natureza: 'ATIVO',
  ...over,
});

describe('tela de implantação', () => {
  it('informa o que reconheceu, com as contagens', () => {
    render(
      <AreaArquivo
        nomeArquivo="balancete.xlsx"
        reconhecimento={{ perfilId: 'dominio', perfilNome: 'Domínio', linhas: 113, analiticas: 27, sinteticas: 86 }}
        erro={null}
        onArquivo={() => {}}
      />,
    );
    const aviso = screen.getByText(/Reconheci balancete Domínio/);
    expect(aviso).toHaveTextContent('113 linhas');
    expect(aviso).toHaveTextContent('27 analíticas');
    expect(aviso).toHaveTextContent('86 sintéticas');
  });

  it('painel mostra os sete números e o semáforo', () => {
    render(
      <PainelConferencia
        painel={{
          analiticas: 27,
          mapeadas: 27,
          pendentes: 0,
          saldoPendente: 0,
          totalDebito: 22003884.5,
          totalCredito: 22003884.5,
          diferenca: 0,
          pronto: true,
          status: 'PRONTO PARA IMPORTAR',
        }}
        justificativa=""
        onJustificativa={() => {}}
        onGerar={() => {}}
      />,
    );
    for (const rotulo of [
      'Contas analíticas',
      'Mapeadas',
      'Pendentes',
      'Saldo pendente',
      'Total débito',
      'Total crédito',
      'Diferença D–C',
    ]) {
      expect(screen.getByText(rotulo)).toBeInTheDocument();
    }
    expect(screen.getByText('PRONTO PARA IMPORTAR')).toBeInTheDocument();
  });

  it('pendências aparecem antes das resolvidas', () => {
    render(
      <TabelaLinhas
        linhas={[
          linha({ codiCta: 'R1', origem: 'nome_igual', status: 'Nome igual ao plano' }),
          linha({ codiCta: 'P1', origem: 'nao_encontrado', codigo: null, status: 'NÃO ENCONTRADO - digite o código na coluna L' }),
        ]}
        contas={[]}
        onUsarSoAqui={() => {}}
      />,
    );
    const ordem = Array.from(document.querySelectorAll('tr[data-codi]')).map((tr) =>
      tr.getAttribute('data-codi'),
    );
    expect(ordem.indexOf('P1')).toBeLessThan(ordem.indexOf('R1'));
  });

  it('busca de conta mostra classificação e natureza de cada candidata', () => {
    render(<BuscaConta contas={[contaBusca({})]} onSelecionar={() => {}} />);
    fireEvent.change(screen.getByPlaceholderText(/buscar conta/i), { target: { value: 'citi' } });
    const item = screen.getByText(/Citibank/);
    const linhaItem = item.closest('.busca-item') as HTMLElement;
    expect(within(linhaItem).getByText(/class\. 1\.1\.1/)).toBeInTheDocument();
    expect(within(linhaItem).getByText(/ATIVO/)).toBeInTheDocument();
  });

  it('conta criada passa a aparecer na busca', () => {
    render(
      <BuscaConta
        contas={[contaBusca({ codigoReduzido: '9001', descricao: 'Conta Nova Criada', natureza: '(conta criada nesta sessão)' })]}
        onSelecionar={() => {}}
      />,
    );
    fireEvent.change(screen.getByPlaceholderText(/buscar conta/i), { target: { value: 'nova' } });
    expect(screen.getByText(/Conta Nova Criada/)).toBeInTheDocument();
  });

  it('CNPJ com menos de 14 dígitos acusa antes de enviar', () => {
    render(
      <DadosEmpresa
        valor={{ dataSaldo: '2026-08-31', cnpj: '123', codigoEmpresa: '1', tipoLote: 'V', codigoHistorico: '700', incluirCabecalho: false }}
        onChange={() => {}}
      />,
    );
    expect(screen.getByText(/CNPJ precisa de 14 dígitos/)).toBeInTheDocument();
  });

  it('Gerar TXT fica bloqueado com pendência, e libera com justificativa', () => {
    function Harness() {
      const [j, setJ] = useState('');
      return (
        <PainelConferencia
          painel={{
            analiticas: 10,
            mapeadas: 9,
            pendentes: 1,
            saldoPendente: 100,
            totalDebito: 500,
            totalCredito: 400,
            diferenca: 100,
            pronto: false,
            status: 'ATENÇÃO: revisar pendências / diferença',
          }}
          justificativa={j}
          onJustificativa={setJ}
          onGerar={() => {}}
        />
      );
    }
    render(<Harness />);
    const botao = screen.getByRole('button', { name: /Gerar TXT/ });
    expect(botao).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/Justificativa/), { target: { value: 'conferido com o cliente' } });
    expect(botao).toBeEnabled();
  });

  it('“ensinar para todos” está desabilitado e explica por quê', () => {
    render(
      <table>
        <tbody>
          <LinhaPendente
            linha={linha({ codiCta: 'P1', origem: 'nao_encontrado', codigo: null, status: 'NÃO ENCONTRADO - digite o código na coluna L' })}
            contas={[]}
            onUsarSoAqui={() => {}}
          />
        </tbody>
      </table>,
    );
    expect(screen.getByRole('button', { name: /Ensinar para todos/ })).toBeDisabled();
    expect(screen.getByText(/base compartilhada/)).toBeInTheDocument();
  });
});
