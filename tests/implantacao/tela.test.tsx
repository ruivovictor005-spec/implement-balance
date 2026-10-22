// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

// A "minha mesa" (Mesa) importa uma ação de servidor; aqui ela é só um esboço, para o teste de
// componente não arrastar o grafo do servidor (auth, banco).
vi.mock('../../src/app/implantacao/acoes.js', () => ({ iniciarERedirecionar: async () => {} }));

import type { LinhaResolvida } from '../../src/motor/converter.js';
import type { ContaBusca } from '../../src/app/implantacao/acoes.js';
import { AreaArquivo } from '../../src/app/implantacao/_componentes/AreaArquivo.js';
import { BuscaConta } from '../../src/app/implantacao/_componentes/BuscaConta.js';
import { DadosEmpresa } from '../../src/app/implantacao/_componentes/DadosEmpresa.js';
import { MapeamentoColunas } from '../../src/app/implantacao/_componentes/MapeamentoColunas.js';
import { Mesa } from '../../src/app/implantacao/_componentes/Mesa.js';
import { PainelConferencia } from '../../src/app/implantacao/_componentes/PainelConferencia.js';
import { TabelaLinhas } from '../../src/app/implantacao/_componentes/TabelaLinhas.js';

afterEach(cleanup);

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
  it('mesa mostra o botão de começar quando não há implantação aberta', () => {
    render(<Mesa abertas={[]} />);
    expect(screen.getByRole('button', { name: /Começar uma nova/ })).toBeInTheDocument();
  });

  it('mesa lista as implantações em andamento pelo nome da empresa', () => {
    render(
      <Mesa
        abertas={[
          { id: 7, empresaNome: 'Padaria Pão Quente', empresaCnpj: '12.345.678/0001-90', iniciadaEm: new Date('2026-10-20') },
        ]}
      />,
    );
    expect(screen.getByText('Padaria Pão Quente')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Padaria Pão Quente/ })).toHaveAttribute('href', '/implantacao/7');
  });

  it('área de arquivo informa o que reconheceu, com as contagens', () => {
    render(
      <AreaArquivo
        nomeArquivo="balancete.xlsx"
        reconhecimento={{ perfilId: 'dominio', perfilNome: 'Domínio', linhas: 113, analiticas: 27, sinteticas: 86 }}
        erro={null}
        onArquivo={() => {}}
      />,
    );
    const aviso = screen.getByText(/Reconheci balancete Domínio/);
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
    const item = screen.getByText(/Citibank/).closest('.busca-item') as HTMLElement;
    expect(within(item).getByText(/class\. 1\.1\.1/)).toBeInTheDocument();
    expect(within(item).getByText(/ATIVO/)).toBeInTheDocument();
  });

  it('CNPJ com menos de 14 dígitos acusa antes de enviar', () => {
    render(
      <DadosEmpresa
        valor={{ nomeEmpresa: 'Teste', dataSaldo: '2026-08-31', cnpj: '123', codigoEmpresa: '1', tipoLote: 'V', codigoHistorico: '700', incluirCabecalho: false }}
        onChange={() => {}}
      />,
    );
    expect(screen.getByText(/CNPJ precisa de 14 dígitos/)).toBeInTheDocument();
  });

  it('layout desconhecido abre o mapeamento de colunas', () => {
    render(
      <MapeamentoColunas
        previa={[
          ['coluna 1', 'coluna 2', 'coluna 3'],
          ['1', 'Caixa', '100'],
        ]}
        onConfirmar={() => {}}
      />,
    );
    expect(screen.getByText(/Apontar as colunas manualmente/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Código da conta/)).toBeInTheDocument();
  });
});
