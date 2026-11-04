// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SinonimoAtivo } from '../../src/dados/sinonimos.js';
import { RegrasExistentes } from '../../src/app/sinonimos/_componentes/RegrasExistentes.js';

afterEach(cleanup);

const regra = (over: Partial<SinonimoAtivo> = {}): SinonimoAtivo => ({
  id: 1,
  nomeOriginal: 'PROVISAO DE INSS SOBRE FERIAS',
  chaveNormalizada: 'PROVISAO INSS S FERIAS',
  codigo: '227',
  descricaoConta: 'INSS a Pagar',
  classificacaoConta: '21302001',
  foraDoPadrao: false,
  ultimoEventoId: 42,
  ...over,
});

type Retorno = { ok: true; aplicada: boolean; aviso?: string } | { ok: false; erro: string };

const montar = (
  achados: SinonimoAtivo[],
  onAlterar: (id: number, codigo: string, evento?: number) => Promise<Retorno> = vi
    .fn()
    .mockResolvedValue({ ok: true, aplicada: true }),
  admin = true,
) => {
  const onBuscar = vi.fn(async () => achados);
  render(<RegrasExistentes admin={admin} onBuscar={onBuscar} onAlterar={onAlterar} />);
  return { onBuscar, onAlterar };
};

const procurar = async (termo: string): Promise<void> => {
  fireEvent.change(screen.getByLabelText('Procurar regra'), { target: { value: termo } });
  fireEvent.click(screen.getByRole('button', { name: 'Procurar' }));
};

const linha = (id: number): HTMLElement =>
  document.querySelector(`tr[data-sinonimo="${id}"]`) as HTMLElement;

describe('mudar uma regra que já existe', () => {
  it('mostra para onde a regra aponta hoje, por extenso', async () => {
    montar([regra()]);
    await procurar('INSS');
    await waitFor(() => expect(linha(1)).toBeInTheDocument());
    expect(linha(1)).toHaveTextContent('227');
    expect(linha(1)).toHaveTextContent('INSS a Pagar');
    expect(linha(1)).toHaveTextContent('PROVISAO INSS S FERIAS');
  });

  it('não procura com o termo vazio', async () => {
    const { onBuscar } = montar([]);
    fireEvent.click(screen.getByRole('button', { name: 'Procurar' }));
    expect(onBuscar).not.toHaveBeenCalled();
  });

  // Não achar nada também é resposta: quer dizer que a conta está casando pelo nome, sem regra.
  it('sem resultado, explica o que isso significa', async () => {
    montar([]);
    await procurar('NAO EXISTE');
    await waitFor(() => expect(screen.getByText(/Nenhuma regra para/)).toBeInTheDocument());
    expect(screen.getByText(/casando pelo nome com o plano/)).toBeInTheDocument();
  });

  it('manda o novo código e a versão que estava na tela', async () => {
    const onAlterar = vi.fn().mockResolvedValue({ ok: true, aplicada: true });
    montar([regra()], onAlterar);
    await procurar('INSS');
    await waitFor(() => expect(linha(1)).toBeInTheDocument());

    fireEvent.click(within(linha(1)).getByRole('button', { name: 'Mudar' }));
    fireEvent.change(screen.getByLabelText(/Novo código para/), { target: { value: '223' } });
    fireEvent.click(screen.getByRole('button', { name: 'Alterar para todos' }));

    await waitFor(() => expect(onAlterar).toHaveBeenCalledWith(1, '223', 42));

    // O motivo deixou de ser pedido: não há campo nenhum para ele.
    expect(screen.queryByLabelText(/Motivo/)).not.toBeInTheDocument();
  });

  it('administrador altera para todos; quem não é, pede', async () => {
    montar([regra()], undefined, false);
    await procurar('INSS');
    await waitFor(() => expect(linha(1)).toBeInTheDocument());
    fireEvent.click(within(linha(1)).getByRole('button', { name: 'Mudar' }));
    expect(screen.getByRole('button', { name: 'Pedir alteração' })).toBeInTheDocument();
  });

  it('diz que foi alterado para todos, ou que virou pedido', async () => {
    const pedido = vi.fn().mockResolvedValue({ ok: true, aplicada: false });
    montar([regra()], pedido, false);
    await procurar('INSS');
    await waitFor(() => expect(linha(1)).toBeInTheDocument());
    fireEvent.click(within(linha(1)).getByRole('button', { name: 'Mudar' }));
    fireEvent.change(screen.getByLabelText(/Novo código para/), { target: { value: '223' } });
    fireEvent.click(screen.getByRole('button', { name: 'Pedir alteração' }));
    await waitFor(() =>
      expect(screen.getByText(/Vale quando o administrador aprovar/)).toBeInTheDocument(),
    );
  });

  it('erro do servidor aparece e o formulário continua aberto', async () => {
    const recusa = vi.fn().mockResolvedValue({ ok: false, erro: 'Código 999 não existe.' });
    montar([regra()], recusa);
    await procurar('INSS');
    await waitFor(() => expect(linha(1)).toBeInTheDocument());
    fireEvent.click(within(linha(1)).getByRole('button', { name: 'Mudar' }));
    fireEvent.change(screen.getByLabelText(/Novo código para/), { target: { value: '999' } });
    fireEvent.click(screen.getByRole('button', { name: 'Alterar para todos' }));

    await waitFor(() => expect(screen.getByText('Código 999 não existe.')).toBeInTheDocument());
    expect(screen.getByLabelText(/Novo código para/)).toBeInTheDocument();
  });

  it('regra apontando para fora do plano vigente é dita como tal', async () => {
    montar([regra({ codigo: '99999', descricaoConta: null, classificacaoConta: null })]);
    await procurar('INSS');
    await waitFor(() => expect(linha(1)).toBeInTheDocument());
    expect(linha(1)).toHaveTextContent('fora do plano vigente');
  });
});
