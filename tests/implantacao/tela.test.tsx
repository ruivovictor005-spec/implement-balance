// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

// A "minha mesa" (Mesa) importa ações de servidor; aqui elas são só esboços, para o teste de
// componente não arrastar o grafo do servidor (auth, banco).
const excluirMock = vi.fn(async (_id: number) => ({ ok: true }) as { ok: true } | { ok: false; erro: string });
vi.mock('../../src/app/implantacao/acoes.js', () => ({
  iniciarERedirecionar: async () => {},
  excluirImplantacao: (id: number) => excluirMock(id),
}));

import type { LinhaResolvida } from '../../src/motor/converter.js';
import type { ContaBusca, ImplantacaoAberta } from '../../src/app/implantacao/acoes.js';
import { AreaArquivo } from '../../src/app/implantacao/_componentes/AreaArquivo.js';
import { BuscaConta } from '../../src/app/implantacao/_componentes/BuscaConta.js';
import { DadosEmpresa } from '../../src/app/implantacao/_componentes/DadosEmpresa.js';
import { MapeamentoColunas } from '../../src/app/implantacao/_componentes/MapeamentoColunas.js';
import { Mesa } from '../../src/app/implantacao/_componentes/Mesa.js';
import { PainelConferencia } from '../../src/app/implantacao/_componentes/PainelConferencia.js';
import { SairDaImplantacao } from '../../src/app/implantacao/_componentes/SairDaImplantacao.js';
import { Pendencias, TabelaDePara } from '../../src/app/implantacao/_componentes/TabelaDePara.js';
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

  // Datas por componentes LOCAIS: `new Date('2026-10-22')` é meia-noite em UTC e, num fuso atrás de
  // Greenwich, a tela mostraria o dia anterior — o teste passaria ou falharia conforme o fuso.
  const aberta = (over: Partial<ImplantacaoAberta> = {}): ImplantacaoAberta => ({
    id: 7,
    empresaNome: 'Padaria Pão Quente',
    empresaCnpj: '12.345.678/0001-90',
    iniciadaEm: new Date(2026, 9, 20),
    guardadaEm: null,
    ...over,
  });

  it('mesa lista as implantações em andamento pelo nome da empresa', () => {
    render(<Mesa abertas={[aberta()]} />);
    expect(screen.getByText('Padaria Pão Quente')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Padaria Pão Quente/ })).toHaveAttribute('href', '/implantacao/7');
  });

  // A diferença entre "eu salvei isso para continuar" e "isso ficou aberto por acidente" é o que a
  // pessoa precisa ver na lista para saber o que pode excluir sem medo.
  it('mesa distingue a implantação salva da não salva', () => {
    const { unmount } = render(<Mesa abertas={[aberta({ guardadaEm: new Date(2026, 9, 22) })]} />);
    expect(screen.getByText(/salva em 22\/10\/2026 para continuar/)).toBeInTheDocument();
    expect(screen.queryByText('não salva')).not.toBeInTheDocument();
    unmount();

    render(<Mesa abertas={[aberta()]} />);
    expect(screen.getByText('não salva')).toBeInTheDocument();
  });

  it('mesa só exclui depois de confirmar, e a implantação sai da lista', async () => {
    excluirMock.mockClear();
    excluirMock.mockResolvedValue({ ok: true });
    render(<Mesa abertas={[aberta()]} />);

    fireEvent.click(screen.getByRole('button', { name: /Excluir implantação Padaria/ }));
    expect(excluirMock).not.toHaveBeenCalled(); // o primeiro clique só pergunta
    expect(screen.getByText('Excluir esta implantação?')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Sim, excluir' }));
    await waitFor(() => expect(screen.queryByText('Padaria Pão Quente')).not.toBeInTheDocument());
    expect(excluirMock).toHaveBeenCalledWith(7);
    expect(screen.getByText(/Nenhuma implantação aberta/)).toBeInTheDocument();
  });

  it('mesa desiste da exclusão ao responder "Não"', () => {
    excluirMock.mockClear();
    render(<Mesa abertas={[aberta()]} />);
    fireEvent.click(screen.getByRole('button', { name: /Excluir implantação Padaria/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Não' }));
    expect(excluirMock).not.toHaveBeenCalled();
    expect(screen.getByText('Padaria Pão Quente')).toBeInTheDocument();
  });

  // O erro vem como valor de retorno da ação; a lista não pode fingir que excluiu.
  it('mesa mostra o erro da exclusão e mantém a implantação na lista', async () => {
    excluirMock.mockClear();
    excluirMock.mockResolvedValue({ ok: false, erro: 'Esta implantação é de outra pessoa.' });
    render(<Mesa abertas={[aberta()]} />);
    fireEvent.click(screen.getByRole('button', { name: /Excluir implantação Padaria/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Sim, excluir' }));

    expect(await screen.findByText('Esta implantação é de outra pessoa.')).toBeInTheDocument();
    expect(screen.getByText('Padaria Pão Quente')).toBeInTheDocument();
  });

  it('diálogo de saída oferece salvar, excluir e cancelar', () => {
    const onSalvar = vi.fn();
    const onExcluir = vi.fn();
    const onCancelar = vi.fn();
    render(
      <SairDaImplantacao
        onSalvar={onSalvar}
        onExcluir={onExcluir}
        onCancelar={onCancelar}
        ocupado={null}
        erro={null}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Salvar e continuar depois' }));
    fireEvent.click(screen.getByRole('button', { name: 'Excluir' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onSalvar).toHaveBeenCalledOnce();
    expect(onExcluir).toHaveBeenCalledOnce();
    expect(onCancelar).toHaveBeenCalledOnce();
  });

  it('diálogo de saída trava os botões enquanto espera o servidor e mostra o erro', () => {
    const onSalvar = vi.fn();
    render(
      <SairDaImplantacao
        onSalvar={onSalvar}
        onExcluir={() => {}}
        onCancelar={() => {}}
        ocupado="salvar"
        erro="Não consegui salvar agora."
      />,
    );
    expect(screen.getByText('Não consegui salvar agora.')).toBeInTheDocument();
    const salvando = screen.getByRole('button', { name: 'Salvando…' });
    expect(salvando).toBeDisabled();
    fireEvent.click(salvando);
    expect(onSalvar).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
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

  // O de-para é a tela onde a pessoa confere conta por conta. O sinal sozinho não dizia o lado
  // (ativo vinha com "-", passivo sem nada); o valor sai em módulo e o lado sai explícito.
  describe('lado do saldo no de-para', () => {
    const celulaDe = (codi: string): HTMLElement =>
      document.querySelector(`tr[data-codi="${codi}"] td.num`) as HTMLElement;

    it('mostra o valor em módulo com D ou C, sem o sinal', () => {
      render(
        <TabelaDePara
          linhas={[
            linha({ codiCta: 'A1', natureza: 'ATIVO CIRCULANTE', saldoAtual: -1234.56 }),
            linha({ codiCta: 'P1', natureza: 'PASSIVO', saldoAtual: 987.65 }),
          ]}
          contas={[]}
          onIndicar={() => {}}
        />,
      );
      const ativo = celulaDe('A1');
      expect(ativo).toHaveTextContent('1.234,56');
      expect(ativo).toHaveTextContent('D');
      expect(ativo.textContent).not.toContain('-');

      const passivo = celulaDe('P1');
      expect(passivo).toHaveTextContent('987,65');
      expect(passivo).toHaveTextContent('C');
    });

    it('aponta o saldo invertido e deixa o normal em paz', () => {
      render(
        <TabelaDePara
          linhas={[
            linha({ codiCta: 'OK', natureza: 'ATIVO CIRCULANTE', saldoAtual: -100 }),
            linha({ codiCta: 'VIRADO', natureza: 'ATIVO CIRCULANTE', saldoAtual: 100 }),
          ]}
          contas={[]}
          onIndicar={() => {}}
        />,
      );
      expect(within(celulaDe('VIRADO')).getByText('saldo invertido')).toBeInTheDocument();
      expect(within(celulaDe('OK')).queryByText('saldo invertido')).not.toBeInTheDocument();
    });

    it('saldo zero e natureza desconhecida não são apontados como invertidos', () => {
      render(
        <TabelaDePara
          linhas={[
            linha({ codiCta: 'ZERO', natureza: 'ATIVO', saldoAtual: 0 }),
            linha({ codiCta: 'NOVA', natureza: 'COMPENSAÇÃO', saldoAtual: 50 }),
          ]}
          contas={[]}
          onIndicar={() => {}}
        />,
      );
      expect(celulaDe('ZERO')).toHaveTextContent('—');
      expect(within(celulaDe('ZERO')).queryByText('saldo invertido')).not.toBeInTheDocument();
      expect(within(celulaDe('NOVA')).queryByText('saldo invertido')).not.toBeInTheDocument();
    });

    it('a aba de pendências mostra o lado do mesmo jeito', () => {
      render(
        <Pendencias
          linhas={[
            linha({
              codiCta: 'P9',
              origem: 'nao_encontrado',
              codigo: null,
              status: 'NÃO ENCONTRADO',
              natureza: 'RECEITA DE SERVIÇOS',
              saldoAtual: -42,
            }),
          ]}
          contas={[]}
          onIndicar={() => {}}
        />,
      );
      const celula = celulaDe('P9');
      expect(celula).toHaveTextContent('42,00');
      expect(celula).toHaveTextContent('D');
      // Receita devedora: é o caso que a pessoa precisa ver.
      expect(within(celula).getByText('saldo invertido')).toBeInTheDocument();
    });
  });
});
