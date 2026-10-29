import { describe, expect, it } from 'vitest';
import type { ConcluidaResumo } from '../../src/app/implantacao/concluir.js';
import { filtrarPorPeriodo, resumirPorPessoa } from '../../src/app/painel/resumo.js';

const c = (over: Partial<ConcluidaResumo>): ConcluidaResumo => ({
  id: 1,
  empresaNome: 'Empresa',
  empresaCnpj: null,
  dataSaldo: null,
  pessoa: 'Ana',
  concluidaEm: new Date('2026-10-20T10:00:00Z'),
  liberacao: null,
  ...over,
});

describe('painel de supervisão — agregação', () => {
  it('agrupa por pessoa contando as concluídas', () => {
    const r = resumirPorPessoa([
      c({ id: 1, pessoa: 'Ana' }),
      c({ id: 2, pessoa: 'Ana' }),
      c({ id: 3, pessoa: 'Bruno' }),
    ]);
    const ana = r.find((p) => p.pessoa === 'Ana')!;
    expect(ana.qtd).toBe(2);
    expect(r.find((p) => p.pessoa === 'Bruno')!.qtd).toBe(1);
  });

  it('ordena da pessoa com mais concluídas para a com menos', () => {
    const r = resumirPorPessoa([
      c({ id: 1, pessoa: 'Bruno' }),
      c({ id: 2, pessoa: 'Ana' }),
      c({ id: 3, pessoa: 'Ana' }),
    ]);
    expect(r[0].pessoa).toBe('Ana');
    expect(r[0].qtd).toBe(2);
  });

  it('guarda a última conclusão de cada pessoa', () => {
    const r = resumirPorPessoa([
      c({ id: 1, pessoa: 'Ana', concluidaEm: new Date('2026-10-10T00:00:00Z') }),
      c({ id: 2, pessoa: 'Ana', concluidaEm: new Date('2026-10-25T00:00:00Z') }),
    ]);
    expect(r[0].ultimaConclusao?.toISOString()).toBe('2026-10-25T00:00:00.000Z');
  });

  it('filtra por período medindo a partir de agora', () => {
    const agora = new Date('2026-10-28T00:00:00Z');
    const lista = [
      c({ id: 1, concluidaEm: new Date('2026-10-27T00:00:00Z') }), // 1 dia
      c({ id: 2, concluidaEm: new Date('2026-10-01T00:00:00Z') }), // 27 dias
      c({ id: 3, concluidaEm: new Date('2026-08-01T00:00:00Z') }), // ~88 dias
    ];
    expect(filtrarPorPeriodo(lista, '7', agora)).toHaveLength(1);
    expect(filtrarPorPeriodo(lista, '30', agora)).toHaveLength(2);
    expect(filtrarPorPeriodo(lista, 'tudo', agora)).toHaveLength(3);
  });
});
