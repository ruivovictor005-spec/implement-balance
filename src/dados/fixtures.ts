// Fonte de dados PROVISÓRIA: lê o plano de contas, os sinônimos e as regras dos arquivos de fixture
// (os mesmos extraídos da planilha). É o que a Task 8 troca pelo banco. Roda só no servidor —
// usa `fs` e, por isso, fica fora de `src/motor` e `src/leitores`, que são puros.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type {
  ContaPlano,
  RegraNatureza,
  RegraNormalizacao,
  SinonimoFixture,
} from '../motor/tipos.js';

const PASTA = join(process.cwd(), 'fixtures');

const ler = <T>(arquivo: string): T => JSON.parse(readFileSync(join(PASTA, arquivo), 'utf8')) as T;

export const carregarPlano = (): ContaPlano[] => ler<ContaPlano[]>('plano.json');

export const carregarRegrasNormalizacao = (): RegraNormalizacao[] =>
  ler<RegraNormalizacao[]>('normalizacao.json');

export const carregarRegrasNatureza = (): RegraNatureza[] => ler<RegraNatureza[]>('natureza.json');

export function carregarSinonimos(): Map<string, string> {
  const lista = ler<SinonimoFixture[]>('sinonimos.json');
  return new Map(lista.map((s) => [s.chaveNormalizada, s.codigoReduzido]));
}
