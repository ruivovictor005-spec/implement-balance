// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type {
  RegraNaturezaEditavel,
  RegraNormalizacaoEditavel,
} from '../../src/dados/regras.js';

// O painel chama as ações de servidor direto; aqui elas são esboços, para o teste de componente
// não arrastar o grafo do servidor (auth, banco).
const natureza: RegraNaturezaEditavel[] = [
  {
    id: 1,
    ordem: 2,
    prefixo: '1.1',
    grupoCosif: 'Disponibilidades',
    natureza: 'ATIVO CIRCULANTE',
    gruposDominio: ['11'],
    naoMigrar: false,
    conjunto: 'cosif',
  },
  {
    id: 2,
    ordem: 5,
    prefixo: '3',
    grupoCosif: 'Compensação',
    natureza: 'COMPENSAÇÃO',
    gruposDominio: [],
    naoMigrar: true,
    conjunto: 'cosif',
  },
];

const normalizacao: RegraNormalizacaoEditavel[] = [
  { id: 10, etapa: 2, ordem: 86, de: ' RECOLHER ', para: ' PAGAR ', ativo: true },
  { id: 11, etapa: 2, ordem: 8, de: ' DE ', para: ' ', ativo: true },
  { id: 12, etapa: 2, ordem: 24, de: ' BCO ', para: ' BANCO ', ativo: false },
  { id: 13, etapa: 1, ordem: 28, de: 'º', para: '', ativo: true },
];

const mudarNaturezaMock = vi.fn(async () => ({ ok: true }) as { ok: true } | { ok: false; erro: string });
const mudarNormMock = vi.fn(
  async () => ({ ok: true, aviso: 'As chaves foram recalculadas.' }) as
    | { ok: true; aviso?: string }
    | { ok: false; erro: string },
);

vi.mock('../../src/app/regras/acoes.js', () => ({
  souAdmin: async () => true,
  listarNatureza: async () => natureza,
  listarNormalizacao: async () => normalizacao,
  mudarNatureza: (...a: unknown[]) => mudarNaturezaMock(...(a as [])),
  mudarNormalizacao: (...a: unknown[]) => mudarNormMock(...(a as [])),
}));

import { PainelRegras } from '../../src/app/regras/PainelRegras.js';

afterEach(() => {
  cleanup();
  mudarNaturezaMock.mockClear();
  mudarNormMock.mockClear();
});

const linhaNat = (id: number): HTMLElement =>
  document.querySelector(`tr[data-regra-natureza="${id}"]`) as HTMLElement;
const linhaNorm = (id: number): HTMLElement =>
  document.querySelector(`tr[data-regra-norm="${id}"]`) as HTMLElement;

const montar = async (): Promise<void> => {
  render(<PainelRegras />);
  await waitFor(() => expect(linhaNat(1)).toBeInTheDocument());
};

describe('painel de regras', () => {
  describe('natureza', () => {
    it('mostra o prefixo, a natureza e os grupos de destino', async () => {
      await montar();
      expect(linhaNat(1)).toHaveTextContent('1.1');
      expect(linhaNat(1)).toHaveTextContent('ATIVO CIRCULANTE');
      expect(linhaNat(1)).toHaveTextContent('11');
      expect(linhaNat(2)).toHaveTextContent('não migra');
    });

    it('salva a natureza e os grupos separados por vírgula', async () => {
      await montar();
      fireEvent.click(within(linhaNat(1)).getByRole('button', { name: 'Mudar' }));
      fireEvent.change(screen.getByLabelText('Grupos de 1.1'), { target: { value: '11, 12' } });
      fireEvent.click(within(linhaNat(1)).getByRole('button', { name: 'Salvar' }));
      await waitFor(() =>
        expect(mudarNaturezaMock).toHaveBeenCalledWith(1, 'ATIVO CIRCULANTE', ['11', '12'], false),
      );
    });

    it('o erro do servidor aparece e o formulário continua aberto', async () => {
      mudarNaturezaMock.mockResolvedValueOnce({ ok: false, erro: '"abc" não é um grupo do Domínio.' });
      await montar();
      fireEvent.click(within(linhaNat(1)).getByRole('button', { name: 'Mudar' }));
      fireEvent.change(screen.getByLabelText('Grupos de 1.1'), { target: { value: 'abc' } });
      fireEvent.click(within(linhaNat(1)).getByRole('button', { name: 'Salvar' }));

      await waitFor(() =>
        expect(screen.getByText('"abc" não é um grupo do Domínio.')).toBeInTheDocument(),
      );
      expect(screen.getByLabelText('Grupos de 1.1')).toBeInTheDocument();
    });
  });

  describe('normalização', () => {
    it('o espaço aparece como · para a regra não parecer casar pedaço de palavra', async () => {
      await montar();
      expect(linhaNorm(10)).toHaveTextContent('·RECOLHER·');
      expect(linhaNorm(10)).toHaveTextContent('·PAGAR·');
    });

    // Trocar por UM ESPAÇO e trocar por NADA são regras diferentes, e a tela não pode confundi-las:
    // a primeira separa palavras, a segunda cola o que sobra.
    it('separa "troca por espaço" de "troca por nada"', async () => {
      await montar();
      expect(within(linhaNorm(11)).getAllByText('·').length).toBeGreaterThan(0);
      expect(linhaNorm(13)).toHaveTextContent('(nada)');
    });

    it('regra desligada aparece como tal', async () => {
      await montar();
      expect(linhaNorm(12)).toHaveTextContent('não');
    });

    it('o filtro reduz a lista e diz quantas sobraram', async () => {
      await montar();
      expect(linhaNorm(10)).toBeInTheDocument();
      fireEvent.change(screen.getByLabelText('Filtrar regras de normalização'), {
        target: { value: 'BCO' },
      });
      await waitFor(() => expect(linhaNorm(10)).toBeNull());
      expect(linhaNorm(12)).toBeInTheDocument();
      expect(screen.getByText('1 de 4')).toBeInTheDocument();
    });

    it('salva o trecho, a troca e o ligado/desligado', async () => {
      await montar();
      fireEvent.click(within(linhaNorm(10)).getByRole('button', { name: 'Mudar' }));
      fireEvent.change(screen.getByLabelText('Troca da regra 10'), { target: { value: ' QUITAR ' } });
      fireEvent.click(screen.getByLabelText('Regra 10 ativa'));
      fireEvent.click(within(linhaNorm(10)).getByRole('button', { name: 'Salvar' }));
      await waitFor(() =>
        expect(mudarNormMock).toHaveBeenCalledWith(10, ' RECOLHER ', ' QUITAR ', false),
      );
    });

    it('o aviso do recálculo das chaves volta para a tela', async () => {
      await montar();
      fireEvent.click(within(linhaNorm(10)).getByRole('button', { name: 'Mudar' }));
      fireEvent.click(within(linhaNorm(10)).getByRole('button', { name: 'Salvar' }));
      await waitFor(() =>
        expect(screen.getByText(/As chaves foram recalculadas/)).toBeInTheDocument(),
      );
    });

    // O tamanho do que se está mexendo tem de estar na tela, não só no commit.
    it('avisa que mexer aqui mexe em tudo que já foi ensinado', async () => {
      await montar();
      expect(
        screen.getByText(/muda a chave de todos os sinônimos já ensinados/),
      ).toBeInTheDocument();
    });
  });
});
