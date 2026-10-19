// Carregadores das fixtures extraídas da planilha. Só os testes leem arquivo: o motor é puro.
import { readFileSync } from 'node:fs';
import type {
  ContaPlano,
  LinhaBalanceteGabarito,
  RegraNatureza,
  RegraNormalizacao,
  SinonimoFixture,
} from '../../src/motor/tipos.js';

const PASTA_FIXTURES = new URL('../../fixtures/', import.meta.url);

function carregar<T>(arquivo: string): T {
  return JSON.parse(readFileSync(new URL(arquivo, PASTA_FIXTURES), 'utf8')) as T;
}

export const carregarPlano = (): ContaPlano[] => carregar<ContaPlano[]>('plano.json');

export const carregarSinonimos = (): SinonimoFixture[] => carregar<SinonimoFixture[]>('sinonimos.json');

export const carregarNormalizacao = (): RegraNormalizacao[] =>
  carregar<RegraNormalizacao[]>('normalizacao.json');

export const carregarNatureza = (): RegraNatureza[] => carregar<RegraNatureza[]>('natureza.json');

export const carregarBalancete = (): LinhaBalanceteGabarito[] =>
  carregar<LinhaBalanceteGabarito[]>('balancete.json');

export const carregarTxtEsperado = (): string[] => carregar<string[]>('txt-esperado.json');

/** O motor processa apenas contas analíticas: `tipo_cta` começando com `S` é sintética (§6.1). */
export const somenteAnaliticas = (balancete: LinhaBalanceteGabarito[]): LinhaBalanceteGabarito[] =>
  balancete.filter((linha) => !linha.tipoCta.startsWith('S'));

/** Mapa de sinônimos como o motor consome: chave normalizada → código reduzido. */
export function mapaSinonimos(sinonimos: SinonimoFixture[]): Map<string, string> {
  return new Map(sinonimos.map((s) => [s.chaveNormalizada, s.codigoReduzido]));
}
