// Orquestrador do motor (§5): encadeia normalização, natureza, resolução, agregação e leiaute,
// e monta o painel de conferência (§6.8). Função pura — entra balancete, plano e regras; sai
// linhas resolvidas, lançamentos, TXT e painel. Nenhum I/O.
import { gerarLancamentos, type Lancamento } from './agregar.js';
import {
  aplicarCustoDespesa,
  lerCustoDespesa,
  resolverNatureza,
  resolverNaturezaDominioOrigem,
} from './natureza.js';
import {
  auditarOrigem,
  detectarPlanoOrigem,
  type AuditoriaOrigem,
  type PlanoIndicado,
} from './origem.js';
import { normalizarNome } from './normalizar.js';
import { criarIndicePlano, resolverConta, type Origem } from './resolver.js';
import { gerarTxt, type ParametrosLote } from './leiaute-dominio.js';
import type { ContaPlano, LinhaBalancete, RegraNatureza, RegraNormalizacao } from './tipos.js';

export type { ParametrosLote } from './leiaute-dominio.js';

/** Linha do balancete com tudo que o motor calculou para ela. */
export type LinhaResolvida = LinhaBalancete & {
  nomeNormalizado: string;
  natureza: string;
  gruposDominio: string[];
  codigo: string | null;
  origem: Origem;
  status: string;
};

export type Painel = {
  analiticas: number;
  mapeadas: number;
  pendentes: number;
  saldoPendente: number;
  totalDebito: number;
  totalCredito: number;
  diferenca: number;
  pronto: boolean;
  status: string;
  /** O que o sistema sabe dizer sobre o arquivo recebido: em que plano está e se o sinal confere. */
  origem: AuditoriaOrigem;
};

/** ROUND do Excel em 2 casas: meio centavo arredonda para longe do zero. */
function arredondar2(valor: number): number {
  const sinal = valor < 0 ? -1 : 1;
  return (sinal * Math.round(Math.abs(valor) * 100)) / 100;
}

export function converter(entrada: {
  balancete: LinhaBalancete[];
  plano: ContaPlano[];
  contasCriadas: ContaPlano[];
  sinonimos: Map<string, string>;
  regrasNormalizacao: RegraNormalizacao[];
  regrasNatureza: RegraNatureza[];
  /**
   * Tabela de natureza do plano do Domínio. Serve de DESTINO sempre e também de ORIGEM quando o
   * balancete recebido já está no plano do Domínio (empresa que vem de outro escritório que também
   * usa Domínio) — ver `motor/origem.ts`.
   */
  regrasNaturezaDominio: RegraNatureza[];
  /**
   * Plano do balancete recebido, INDICADO pela pessoa. Quando vem, manda. Nulo (o padrão) deixa o
   * sistema deduzir pelos grupos presentes na classificação.
   */
  planoOrigemIndicado?: PlanoIndicado | null;
  ajustesManuais: Map<string, string>;
  parametros: ParametrosLote;
}): { linhas: LinhaResolvida[]; lancamentos: Lancamento[]; txt: string[]; painel: Painel } {
  const {
    balancete,
    plano,
    contasCriadas,
    sinonimos,
    regrasNormalizacao,
    regrasNatureza,
    regrasNaturezaDominio,
    planoOrigemIndicado = null,
    ajustesManuais,
    parametros,
  } = entrada;

  // Conta criada durante a sessão entra no índice como analítica comum.
  const indice = criarIndicePlano([...plano, ...contasCriadas]);

  // Em que plano está a ORIGEM. Lida pela tabela errada, a classificação responde outra natureza:
  // num balancete do Domínio, o grupo 2 é passivo (a tabela COSIF diria "ativo não circulante"), o
  // 4 é custo/despesa (diria "passivo") e o 3 é receita (diria "compensação / não migrar", e aí a
  // receita toda desaparecia do TXT em silêncio). Ver `motor/origem.ts`.
  //
  // A indicação da pessoa manda; a dedução é só o padrão de quem não indicou nada.
  const planoDaOrigem = planoOrigemIndicado ?? detectarPlanoOrigem(balancete);
  const naturezaDaOrigem = (classificacao: string) =>
    planoDaOrigem === 'dominio'
      ? resolverNaturezaDominioOrigem(classificacao, regrasNaturezaDominio)
      : resolverNatureza(classificacao, regrasNatureza);

  const linhas: LinhaResolvida[] = [];
  for (const linha of balancete) {
    if (linha.tipoCta.startsWith('S')) continue; // §6.1: sintética não vira saldo
    const nomeNormalizado = normalizarNome(linha.nomeCta, regrasNormalizacao);
    // Natureza da origem; a coluna opcional de custo/despesa, quando preenchida, decide entre
    // custo e despesa nas contas de resultado devedoras.
    const natureza = aplicarCustoDespesa(
      naturezaDaOrigem(linha.clasCta),
      lerCustoDespesa(linha.custoDespesa),
    );
    const ajusteManual = ajustesManuais.get(linha.codiCta) ?? null;
    const resolvida = resolverConta({ nomeNormalizado, natureza, ajusteManual, indice, sinonimos });
    linhas.push({
      ...linha,
      nomeNormalizado,
      natureza: natureza?.natureza ?? '',
      gruposDominio: natureza?.gruposDominio ?? [],
      codigo: resolvida.codigo,
      origem: resolvida.origem,
      status: resolvida.status,
    });
  }

  const resolvidas = linhas
    .filter((l): l is LinhaResolvida & { codigo: string } => l.codigo !== null)
    .map((l) => ({
      codigo: l.codigo,
      saldoAtual: l.saldoAtual,
      origemCodigo: l.codiCta,
      origemNome: l.nomeCta,
    }));
  const lancamentos = gerarLancamentos(resolvidas, indice);
  const txt = gerarTxt(lancamentos, parametros);

  // O painel reproduz os contadores da planilha (§6.8). "Pendente" é a linha que ficou sem código
  // (NÃO ENCONTRADO ou coluna L inexistente); "Não migrar" não conta como pendência nem reprova.
  const pendentes = linhas.filter((l) => l.origem === 'nao_encontrado');
  const totalDebito = arredondar2(
    lancamentos.reduce((s, l) => (l.contaDebito !== null ? s + l.valor : s), 0),
  );
  const totalCredito = arredondar2(
    lancamentos.reduce((s, l) => (l.contaCredito !== null ? s + l.valor : s), 0),
  );
  const diferenca = arredondar2(totalDebito - totalCredito);

  // Convenção de sinal do arquivo. Continua sendo calculada e devolvida, mas NÃO reprova mais o
  // painel: a pedido de quem usa, o sistema deixou de opinar sobre o sinal. A tela usa só para não
  // acusar conta por conta quando o arquivo inteiro está trocado, e oferece o botão de inverter.
  //
  // O que isso custa, escrito aqui porque sumiu da tela: um balancete com o sinal trocado FECHA do
  // mesmo jeito (débito e crédito trocados somam igual), então `diferenca` não acusa — e agora nada
  // mais acusa. O painel pode dizer "PRONTO PARA IMPORTAR" para um TXT com todos os lançamentos do
  // lado contrário. Quem confere o sinal é quem olha o balancete.
  const origem = auditarOrigem(balancete, linhas, planoOrigemIndicado);
  const pronto =
    parametros.cnpj.trim() !== '' &&
    parametros.codigoEmpresa.trim() !== '' &&
    pendentes.length === 0 &&
    diferenca === 0;

  const painel: Painel = {
    analiticas: linhas.length,
    mapeadas: linhas.length - pendentes.length,
    pendentes: pendentes.length,
    saldoPendente: arredondar2(pendentes.reduce((s, l) => s + l.saldoAtual, 0)),
    totalDebito,
    totalCredito,
    diferenca,
    pronto,
    status: pronto ? 'PRONTO PARA IMPORTAR' : 'ATENÇÃO: revisar pendências / diferença',
    origem,
  };

  return { linhas, lancamentos, txt, painel };
}
