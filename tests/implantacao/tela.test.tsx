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

import { conferirPorGrupo } from '../../src/motor/conferencia-grupo.js';
import type { LinhaResolvida } from '../../src/motor/converter.js';
import type { AuditoriaOrigem } from '../../src/motor/origem.js';
import type { ContaBusca, ImplantacaoAberta, Lancamento } from '../../src/app/implantacao/acoes.js';
import { AreaArquivo } from '../../src/app/implantacao/_componentes/AreaArquivo.js';
import { AvisoOrigem } from '../../src/app/implantacao/_componentes/AvisoOrigem.js';
import { BuscaConta } from '../../src/app/implantacao/_componentes/BuscaConta.js';
import { DadosEmpresa } from '../../src/app/implantacao/_componentes/DadosEmpresa.js';
import { MapeamentoColunas } from '../../src/app/implantacao/_componentes/MapeamentoColunas.js';
import { Mesa } from '../../src/app/implantacao/_componentes/Mesa.js';
import { ConferenciaPorGrupo } from '../../src/app/implantacao/_componentes/ConferenciaPorGrupo.js';
import { PainelConferencia } from '../../src/app/implantacao/_componentes/PainelConferencia.js';
import { PreviaBalancete } from '../../src/app/implantacao/_componentes/PreviaBalancete.js';
import { ResumoBalancete } from '../../src/app/implantacao/_componentes/ResumoBalancete.js';
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
          origem: {
            plano: 'cosif',
            detectado: 'cosif',
            indicado: false,
            convencao: 'normal',
            devedoras: -22003884.5,
            credoras: 22003884.5,
            conferidas: 27,
          },
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
      expect(within(celulaDe('VIRADO')).getByText('conferir o lado')).toBeInTheDocument();
      expect(within(celulaDe('OK')).queryByText('conferir o lado')).not.toBeInTheDocument();
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
      expect(within(celulaDe('ZERO')).queryByText('conferir o lado')).not.toBeInTheDocument();
      expect(within(celulaDe('NOVA')).queryByText('conferir o lado')).not.toBeInTheDocument();
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
      expect(within(celula).getByText('conferir o lado')).toBeInTheDocument();
    });

    // Conta redutora fica do lado contrário ao do grupo por construção: apontar é alarme falso.
    it('conta redutora não é apontada', () => {
      render(
        <TabelaDePara
          linhas={[
            linha({
              codiCta: 'PREJ',
              nomeCta: '(-) PREJUÍZOS ACUMULADOS',
              natureza: 'PATRIMÔNIO LÍQUIDO',
              saldoAtual: -756099.49,
            }),
          ]}
          contas={[]}
          onIndicar={() => {}}
        />,
      );
      expect(within(celulaDe('PREJ')).queryByText('conferir o lado')).not.toBeInTheDocument();
    });

    // Quando o arquivo inteiro vem com o sinal trocado, TODA conta parece invertida: apontar uma
    // por uma esconde o problema de verdade, que é o arquivo.
    it('com conferirLado desligado, nenhuma conta é apontada', () => {
      render(
        <TabelaDePara
          linhas={[
            linha({ codiCta: 'A1', natureza: 'ATIVO CIRCULANTE', saldoAtual: 100 }),
            linha({ codiCta: 'P1', natureza: 'PASSIVO', saldoAtual: -100 }),
          ]}
          contas={[]}
          onIndicar={() => {}}
          conferirLado={false}
        />,
      );
      expect(within(celulaDe('A1')).queryByText('conferir o lado')).not.toBeInTheDocument();
      expect(within(celulaDe('P1')).queryByText('conferir o lado')).not.toBeInTheDocument();
      // O lado continua aparecendo: o que sai é a acusação, não a informação.
      expect(celulaDe('A1')).toHaveTextContent('C');
    });
  });

  // O cartão que diz o que o sistema ASSUMIU sobre o arquivo. Existe porque plano errado e sinal
  // trocado não estouram nada — produzem um resultado inteiro errado em silêncio.
  describe('como o arquivo foi lido', () => {
    const origem = (over: Partial<AuditoriaOrigem> = {}): AuditoriaOrigem => ({
      plano: 'cosif',
      detectado: 'cosif',
      indicado: false,
      convencao: 'normal',
      devedoras: -1000,
      credoras: 1000,
      conferidas: 10,
      ...over,
    });

    /** O texto todo do cartão: as frases misturam <strong>, então se lê o conjunto. */
    const textoDe = (over: Partial<AuditoriaOrigem> = {}): string =>
      render(<AvisoOrigem origem={origem(over)} />).container.textContent ?? '';

    it('diz em que plano a origem foi lida', () => {
      expect(textoDe({ plano: 'dominio' })).toContain('plano do Domínio');
      expect(textoDe({ plano: 'cosif' })).toContain('COSIF (Infobank)');
    });

    it('avisa quando não identificou o plano e diz o que foi assumido', () => {
      // Sem indicação, o plano em uso É o deduzido: "indefinido" nos dois.
      const t = textoDe({ plano: 'indefinido', detectado: 'indefinido' });
      expect(t).toContain('não identificado');
      expect(t).toContain('foi lido como COSIF');
      expect(t).toContain('indique o plano abaixo');
    });

    it('sinal trocado: explica a consequência no TXT e mostra os dois totais', () => {
      const t = textoDe({
        convencao: 'invertida',
        devedoras: 25000,
        credoras: -25000,
        conferidas: 14,
      });
      expect(t).toContain('sinal do saldo neste arquivo parece estar trocado');
      expect(t).toContain('do lado contrário no TXT');
      expect(t).toContain('25.000,00 C'); // devedoras somando crédito: o contrário do esperado
      expect(t).toContain('25.000,00 D');
      expect(t).toContain('14 contas conferidas');
    });

    it('sinal conferido: confirma sem alarme', () => {
      const t = textoDe();
      expect(t).toContain('Sinal do saldo conferido');
      expect(t).not.toContain('parece estar trocado');
    });

    it('sem evidência: diz que não deu para conferir, em vez de afirmar', () => {
      const t = textoDe({ convencao: 'indefinida', conferidas: 1 });
      expect(t).toContain('Não houve evidência suficiente');
    });

    // O export que perde o D/C: o lado de cada saldo simplesmente não está no arquivo.
    it('sem D/C no arquivo: diz que a informação não veio e como trazê-la', () => {
      const t = textoDe({ convencao: 'ausente', devedoras: 33445.75, credoras: 1875052.67 });
      expect(t).toContain('não diz de que lado (D/C) está cada saldo');
      expect(t).toContain('5.574,25D');
    });

    it('diz se o plano foi indicado por você ou deduzido', () => {
      expect(textoDe({ indicado: false })).toContain('deduzido pelos grupos');
      expect(textoDe({ plano: 'dominio', indicado: true })).toContain('indicado por você');
    });
  });

  // A pessoa que recebeu o arquivo sabe de qual sistema ele saiu; deduzir é palpite.
  describe('indicar o plano do balancete', () => {
    const seletorCom = (over: Partial<AuditoriaOrigem>, onIndicar = vi.fn(), editavel = true) => {
      render(
        <AvisoOrigem
          origem={{
            plano: 'cosif',
            detectado: 'cosif',
            indicado: false,
            convencao: 'normal',
            devedoras: -1000,
            credoras: 1000,
            conferidas: 10,
            ...over,
          }}
          onIndicarPlano={onIndicar}
          editavel={editavel}
        />,
      );
      return {
        select: screen.getByLabelText(/Plano do balancete recebido/) as HTMLSelectElement,
        onIndicar,
      };
    };

    it('a opção de deduzir mostra o que a dedução diz hoje', () => {
      seletorCom({ detectado: 'dominio' });
      expect(screen.getByText(/Deduzir pelo arquivo \(hoje: plano do Domínio\)/)).toBeInTheDocument();
    });

    it('sem indicação, o seletor fica em "deduzir"', () => {
      expect(seletorCom({ indicado: false, plano: 'dominio' }).select.value).toBe('');
    });

    it('com indicação, o seletor mostra o plano indicado', () => {
      expect(seletorCom({ indicado: true, plano: 'dominio' }).select.value).toBe('dominio');
    });

    it('escolher Domínio avisa quem chamou', () => {
      const { select, onIndicar } = seletorCom({});
      fireEvent.change(select, { target: { value: 'dominio' } });
      expect(onIndicar).toHaveBeenCalledWith('dominio');
    });

    it('voltar para "deduzir" manda null, não vazio', () => {
      const { select, onIndicar } = seletorCom({ indicado: true, plano: 'dominio' });
      fireEvent.change(select, { target: { value: '' } });
      expect(onIndicar).toHaveBeenCalledWith(null);
    });

    it('quando a dedução discorda da indicação, diz o que ela diria', () => {
      seletorCom({ indicado: true, plano: 'cosif', detectado: 'dominio' });
      expect(screen.getByText(/A dedução pelos grupos diria/)).toBeInTheDocument();
    });

    it('implantação concluída não deixa trocar o plano', () => {
      expect(seletorCom({}, vi.fn(), false).select.disabled).toBe(true);
    });
  });

  describe('resumo do balancete', () => {
    const resumoDe = (over: Partial<LinhaResolvida>[]) =>
      render(<ResumoBalancete linhas={over.map((o) => linha(o))} />);

    const celulas = (id: string): string[] =>
      Array.from(
        (document.querySelector(`tr[data-linha="${id}"]`) as HTMLElement).querySelectorAll('td.num'),
      ).map((td) => (td.textContent ?? '').trim());

    it('mostra os grupos, os totais e o resultado com D/C', () => {
      resumoDe([
        {
          natureza: 'ATIVO CIRCULANTE',
          saldoAnterior: -18177277.09,
          totalDebito: 10289559.06,
          totalCredito: 10795555.65,
          saldoAtual: -17671280.5,
        },
        {
          natureza: 'DESPESA ADMINISTRATIVA',
          saldoAnterior: -4858693.11,
          totalDebito: 335752.92,
          totalCredito: 0,
          saldoAtual: -5194446.03,
        },
        {
          natureza: 'RECEITA DE SERVIÇOS',
          saldoAnterior: 676229.12,
          totalDebito: 1448.35,
          totalCredito: 162791.57,
          saldoAtual: 837572.34,
        },
      ]);

      expect(screen.getByText('ATIVO')).toBeInTheDocument();
      expect(screen.getByText('Patrimônio Líquido')).toBeInTheDocument();

      // Saldo em módulo colado no lado, como no relatório do Domínio.
      expect(celulas('ativo')[3]).toBe('17.671.280,50D');
      expect(celulas('receitas')[3]).toBe('837.572,34C');

      // Devedoras = ativo + custos, nas quatro colunas.
      expect(celulas('devedoras')[0]).toBe('23.035.970,20D');
      expect(celulas('devedoras')[3]).toBe('22.865.726,53D');

      // Resultado do mês é só a movimentação; o do exercício, o acumulado.
      expect(celulas('resultadoMes')[3]).toBe('174.409,70D');
      expect(celulas('resultadoExercicio')[3]).toBe('4.356.873,69D');
    });

    it('avisa quando alguma linha ficou fora dos totais', () => {
      resumoDe([
        { natureza: 'ATIVO', saldoAtual: -10 },
        { natureza: 'COMPENSAÇÃO', saldoAtual: -999 },
      ]);
      expect(screen.getByText(/1 linha\(s\) ficaram fora do resumo/)).toBeInTheDocument();
    });

    it('não avisa nada quando todas as linhas entraram', () => {
      resumoDe([{ natureza: 'ATIVO', saldoAtual: -10 }]);
      expect(screen.queryByText(/fora do resumo/)).not.toBeInTheDocument();
    });
  });

  // A prévia é um balancete de verdade: cada conta de grupo totaliza o que está abaixo dela, em
  // todos os níveis. É o que permite conferir a realocação sem somar linha a linha.
  describe('prévia hierárquica no Domínio', () => {
    const conta = (codigoReduzido: string, classificacao: string, descricao: string): ContaBusca => ({
      codigoReduzido,
      classificacao,
      descricao,
      tipo: classificacao.length >= 8 ? 'A' : 'S',
      descricaoNormalizada: '',
      natureza: '',
    });

    // Recorte do plano real, com a cadeia de sintéticas que o Domínio imprime.
    const planinho: ContaBusca[] = [
      conta('1000', '1', 'ATIVO'),
      conta('1100', '11', 'Ativo Circulante'),
      conta('1110', '111', 'Disponível'),
      conta('1112', '11102', 'Bancos Conta Movimento'),
      conta('10', '11102001', 'Bradesco'),
      conta('15', '11102006', 'Santander'),
      // Outro subgrupo do ATIVO: é entre 11 e 12 que a troca passa despercebida no topo.
      conta('1200', '12', 'Ativo Não Circulante'),
      conta('99', '12101001', 'Empréstimos Funcionários'),
      conta('2000', '2', 'PASSIVO'),
      conta('2140', '21401', 'Impostos e Contribuições a Recolher'),
      conta('235', '21401003', 'PIS a Recolher'),
    ];

    const lanc = (codigo: string, valor: number, lado: 'D' | 'C', origem = 'X1'): Lancamento => ({
      contaDebito: lado === 'D' ? codigo : null,
      contaCredito: lado === 'C' ? codigo : null,
      valor,
      complemento: ' | conta',
      origemCodigo: origem,
      origemNome: 'CONTA DE ORIGEM',
    });

    const previa = (lancamentos: Lancamento[]) =>
      render(<PreviaBalancete contas={planinho} lancamentos={lancamentos} />);

    const linhaDe = (classificacao: string): HTMLElement =>
      document.querySelector(`tr[data-classificacao="${classificacao}"]`) as HTMLElement;

    const numeros = (tr: HTMLElement): string[] =>
      Array.from(tr.querySelectorAll('td.num')).map((td) => (td.textContent ?? '').trim());

    it('mostra a cadeia de grupos acima da conta, na ordem do plano', () => {
      previa([lanc('10', 100, 'D')]);
      const classes = Array.from(document.querySelectorAll('tr[data-classificacao]')).map((t) =>
        t.getAttribute('data-classificacao'),
      );
      expect(classes).toEqual(['1', '11', '111', '11102', '11102001']);
    });

    it('a conta de grupo soma as analíticas abaixo dela', () => {
      previa([lanc('10', 100, 'D'), lanc('15', 40, 'C')]);
      // Bancos Conta Movimento junta Bradesco e Santander.
      expect(numeros(linhaDe('11102'))).toEqual(['100,00', '40,00', '60,00 D']);
      expect(numeros(linhaDe('1'))).toEqual(['100,00', '40,00', '60,00 D']);
    });

    it('marca o que é grupo e o que é conta', () => {
      previa([lanc('10', 100, 'D')]);
      expect(linhaDe('11102')).toHaveAttribute('data-sintetica', '1');
      expect(linhaDe('11102001')).toHaveAttribute('data-sintetica', '0');
      expect(linhaDe('11102')).toHaveClass('grupo');
      expect(linhaDe('11102001')).not.toHaveClass('grupo');
    });

    it('cada grupo é indentado conforme o nível', () => {
      previa([lanc('10', 100, 'D')]);
      const recuo = (c: string): number =>
        Number(
          ((linhaDe(c).querySelectorAll('td')[2] as HTMLElement).style.paddingLeft || '0').replace(
            'px',
            '',
          ),
        );
      expect(recuo('1')).toBeLessThan(recuo('11'));
      expect(recuo('11')).toBeLessThan(recuo('111'));
      expect(recuo('111')).toBeLessThan(recuo('11102001'));
    });

    it('grupos de topo diferentes não se misturam', () => {
      previa([lanc('235', 300, 'C'), lanc('10', 100, 'D')]);
      expect(numeros(linhaDe('1'))).toEqual(['100,00', '', '100,00 D']);
      expect(numeros(linhaDe('2'))).toEqual(['', '300,00', '300,00 C']);
    });

    // O total conta só as analíticas: somar os grupos junto seria contar o mesmo saldo várias vezes.
    it('o total geral não soma os grupos duas vezes', () => {
      previa([lanc('10', 100, 'D'), lanc('15', 40, 'C'), lanc('235', 300, 'C')]);
      const total = document.querySelector('tr.total') as HTMLElement;
      expect(numeros(total)).toEqual(['100,00', '340,00', '240,00 C']);
      expect(screen.getByText(/3 conta\(s\)/)).toBeInTheDocument();
    });

    it('as origens aparecem sob a conta, sem entrar no total do grupo', () => {
      previa([lanc('10', 60, 'D', 'X1'), lanc('10', 40, 'D', 'X2')]);
      expect(screen.getAllByText(/veio de/)).toHaveLength(2);
      expect(numeros(linhaDe('11102'))).toEqual(['100,00', '', '100,00 D']);
    });

    it('conta fora do plano vai para o fim, sem pendurar em grupo nenhum', () => {
      previa([lanc('10', 100, 'D'), lanc('999', 7, 'D')]);
      const linhas = Array.from(document.querySelectorAll('tr[data-classificacao]'));
      const ultima = linhas[linhas.length - 1];
      expect(ultima.getAttribute('data-classificacao')).toBe('');
      expect(ultima).toHaveTextContent('(fora do plano)');
      expect(numeros(linhaDe('1'))).toEqual(['100,00', '', '100,00 D']);
    });

    it('sem lançamentos não mostra tabela', () => {
      previa([]);
      expect(screen.getByText(/Indique as contas no de-para/)).toBeInTheDocument();
      expect(document.querySelector('tr[data-classificacao]')).toBeNull();
    });

    // A coluna de status marca se o grupo bate com o balancete de origem.
    describe('coluna "Confere?"', () => {
      const comConferencia = (
        lancamentos: Lancamento[],
        origem: Partial<LinhaResolvida>[],
      ): void => {
        render(
          <PreviaBalancete
            contas={planinho}
            lancamentos={lancamentos}
            conferencia={conferirPorGrupo(origem.map((l) => linha(l)), planinho)}
          />,
        );
      };

      it('grupo que bate fica OK e sem destaque', () => {
        comConferencia(
          [lanc('10', 100, 'D')],
          [{ natureza: 'ATIVO CIRCULANTE', gruposDominio: ['11'], saldoAtual: -100, codigo: '10' }],
        );
        expect(linhaDe('1')).toHaveAttribute('data-confere', 'ok');
        expect(linhaDe('1')).toHaveTextContent('OK');
        expect(linhaDe('1')).not.toHaveClass('atencao');
      });

      // "ATENÇÃO", e não veredito: a mudança de grupo pode ser proposital.
      it('grupo que difere pede ATENÇÃO e fica destacado', () => {
        // Saldo de ativo na origem foi indicado para uma conta de passivo.
        comConferencia(
          [lanc('235', 100, 'C')],
          [{ natureza: 'ATIVO CIRCULANTE', gruposDominio: ['11'], saldoAtual: -100, codigo: '235' }],
        );
        expect(linhaDe('2')).toHaveAttribute('data-confere', 'atencao');
        expect(linhaDe('2')).toHaveTextContent('ATENÇÃO');
        // Nem veredito nem "pendente", que aqui significa outra coisa.
        expect(linhaDe('2')).not.toHaveTextContent(/NÃO BATE|PENDENTE/i);
        expect(linhaDe('2')).toHaveClass('atencao');
      });

      // O subgrupo também recebe status quando a natureza aponta para um só.
      it('subgrupo recebe status; níveis sem comparação ficam em branco', () => {
        comConferencia(
          [lanc('10', 100, 'D')],
          [{ natureza: 'ATIVO CIRCULANTE', gruposDominio: ['11'], saldoAtual: -100, codigo: '10' }],
        );
        expect(linhaDe('1')).toHaveAttribute('data-confere', 'ok');
        expect(linhaDe('11')).toHaveAttribute('data-confere', 'ok');
        for (const classe of ['111', '11102', '11102001']) {
          expect(linhaDe(classe)).not.toHaveAttribute('data-confere');
        }
      });

      // O ganho do 2º nível: os dois subgrupos estão dentro de ATIVO, então o topo não vê nada.
      it('troca de subgrupo dentro do mesmo grupo acende só no subgrupo', () => {
        comConferencia(
          [lanc('99', 100, 'D')],
          [{ natureza: 'ATIVO CIRCULANTE', gruposDominio: ['11'], saldoAtual: -100, codigo: '99' }],
        );
        expect(linhaDe('1')).toHaveAttribute('data-confere', 'ok');
        expect(linhaDe('12')).toHaveAttribute('data-confere', 'atencao');
        expect(linhaDe('12')).toHaveClass('atencao');
      });

      it('natureza ambígua não acende subgrupo nenhum', () => {
        comConferencia(
          [lanc('99', 100, 'D')],
          [{ natureza: 'ATIVO', gruposDominio: ['11', '12'], saldoAtual: -100, codigo: '99' }],
        );
        expect(linhaDe('1')).toHaveAttribute('data-confere', 'ok');
        expect(linhaDe('12')).not.toHaveAttribute('data-confere');
        expect(document.querySelector('tr.atencao')).toBeNull();
      });

      it('sem conferência, a coluna fica vazia e nada é destacado', () => {
        previa([lanc('10', 100, 'D')]);
        expect(linhaDe('1')).not.toHaveAttribute('data-confere');
        expect(document.querySelector('tr.atencao')).toBeNull();
      });
    });
  });

  // Conferir grupo a grupo é o que acha a conta indicada para o grupo errado sem a pessoa ter de
  // comparar duas tabelas de cabeça.
  describe('conferência por grupo', () => {
    const planoConf: ContaBusca[] = [
      { codigoReduzido: 'g1', classificacao: '1', descricao: 'ATIVO', tipo: 'S', descricaoNormalizada: '', natureza: '' },
      { codigoReduzido: 'g4', classificacao: '4', descricao: 'CUSTOS E DESPESAS', tipo: 'S', descricaoNormalizada: '', natureza: '' },
      { codigoReduzido: '10', classificacao: '11102001', descricao: 'Bradesco', tipo: 'A', descricaoNormalizada: '', natureza: '' },
      { codigoReduzido: '537', classificacao: '42105002', descricao: 'Telefone', tipo: 'A', descricaoNormalizada: '', natureza: '' },
    ];

    const conferir = (ls: Partial<LinhaResolvida>[]) =>
      render(
        <ConferenciaPorGrupo
          conferencia={conferirPorGrupo(ls.map((l) => linha(l)), planoConf)}
        />,
      );

    const grupoDe = (chave: string): HTMLElement =>
      document.querySelector(`tr[data-grupo="${chave}"]`) as HTMLElement;

    it('diz que está tudo certo quando os grupos batem', () => {
      conferir([
        { natureza: 'ATIVO CIRCULANTE', saldoAtual: -1000, codigo: '10' },
        { natureza: 'DESPESA ADMINISTRATIVA', saldoAtual: -400, codigo: '537' },
      ]);
      expect(screen.getByText(/Todos os grupos conferidos batem/)).toBeInTheDocument();
      expect(grupoDe('1')).not.toHaveClass('atencao');
    });

    it('aponta o grupo com diferença e explica o que ela significa', () => {
      conferir([
        { natureza: 'ATIVO CIRCULANTE', saldoAtual: -1000, codigo: '537' }, // ativo em despesa
      ]);
      expect(screen.getByText(/2 grupo\(s\) para verificar/)).toBeInTheDocument();
      expect(screen.getByText(/não quer dizer erro/)).toBeInTheDocument();
      expect(grupoDe('1')).toHaveClass('atencao');
      expect(grupoDe('4')).toHaveClass('atencao');
      // Mesmo valor dos dois lados, em lados contrários.
      expect(grupoDe('1')).toHaveTextContent('1.000,00D');
      expect(grupoDe('4')).toHaveTextContent('1.000,00C');
    });

    it('pendência não vira divergência', () => {
      conferir([
        { natureza: 'ATIVO CIRCULANTE', saldoAtual: -1000, codigo: '10' },
        { natureza: 'ATIVO CIRCULANTE', saldoAtual: -250, codigo: null },
      ]);
      expect(screen.getByText(/Todos os grupos conferidos batem/)).toBeInTheDocument();
      expect(grupoDe('1')).toHaveTextContent('250,00D'); // mostrada como pendente
    });

    it('avisa o que ficou fora da conferência', () => {
      conferir([
        { natureza: 'ATIVO CIRCULANTE', saldoAtual: -1000, codigo: '10' },
        { natureza: 'COMPENSAÇÃO', saldoAtual: -77, codigo: '10' },
      ]);
      expect(screen.getByText(/1 linha\(s\), somando 77,00/)).toBeInTheDocument();
    });

    it('sem nada indicado, convida a fazer o de-para', () => {
      conferir([]);
      expect(screen.getByText(/Indique as contas no de-para para conferir os grupos/)).toBeInTheDocument();
    });
  });
});
