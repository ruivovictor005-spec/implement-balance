// Resolução do código do Domínio (§6.4) e os 12 textos de status (§6.5).
import type { ResultadoNatureza } from './natureza.js';
import type { ContaPlano } from './tipos.js';

/** Como o código foi resolvido, para filtro e relatório. */
export type Origem =
  | 'manual'
  | 'sinonimo'
  | 'nome_igual'
  | 'nome_cortado'
  | 'nao_migrar'
  | 'nao_encontrado';

export type IndicePlano = {
  /** Todas as contas, analíticas e sintéticas: é por aqui que se sabe se um código existe. */
  porCodigo: Map<string, ContaPlano>;
  /** Só as analíticas, na ordem do plano. Mais de uma quando o plano repete o nome. */
  porNomeNormalizado: Map<string, ContaPlano[]>;
  /** Só as analíticas, na ordem do plano: a varredura do nome cortado anda por aqui. */
  analiticas: ContaPlano[];
};

export type ContaResolvida = { codigo: string | null; origem: Origem; status: string };

/** Os 12 textos da §6.5, literais: é por eles que a equipe já sabe o que fazer. */
const STATUS = {
  naoMigrar: (natureza: string) => `Não migrar - ${natureza}`,
  semNatureza: 'NÃO ENCONTRADO - natureza não identificada pela classificação (col. C)',
  manualInexistente: 'Código da coluna L não existe no plano',
  manual: 'Manual (coluna L)',
  manualOutraNatureza: 'Código da coluna L é de outra natureza - conferir',
  semCodigoComSinonimoDescartado:
    'NÃO ENCONTRADO - sinônimo aponta p/ conta de outra natureza; digite na coluna L',
  semCodigo: 'NÃO ENCONTRADO - digite o código na coluna L',
  sinonimo: 'Pela aba Sinônimos',
  sinonimoDescartado: 'Sinônimo ignorado (outra natureza) - conferir',
  nomeRepetido: 'Nome repetido no plano - conferir',
  nomeIgual: 'Nome igual ao plano',
  nomeCortado: 'Nome cortado - conferir',
} as const;

/** Nome cortado só é tentado a partir deste tamanho: abaixo dele o prefixo casaria qualquer coisa. */
const MINIMO_PARA_NOME_CORTADO = 25;

export function criarIndicePlano(contas: ContaPlano[]): IndicePlano {
  const porCodigo = new Map<string, ContaPlano>();
  const porNomeNormalizado = new Map<string, ContaPlano[]>();
  const analiticas: ContaPlano[] = [];
  for (const conta of contas) {
    porCodigo.set(conta.codigoReduzido, conta);
    if (conta.tipo !== 'A') continue;
    analiticas.push(conta);
    const mesmoNome = porNomeNormalizado.get(conta.descricaoNormalizada);
    if (mesmoNome === undefined) porNomeNormalizado.set(conta.descricaoNormalizada, [conta]);
    else mesmoNome.push(conta);
  }
  return { porCodigo, porNomeNormalizado, analiticas };
}

/** Conta candidata é válida quando é analítica e o grupo da classificação dela é permitido (§6.3). */
function valida(conta: ContaPlano, natureza: ResultadoNatureza): boolean {
  if (conta.tipo !== 'A') return false;
  const grupos = natureza.gruposDominio;
  return grupos.includes(conta.classificacao.slice(0, 1)) || grupos.includes(conta.classificacao.slice(0, 2));
}

/**
 * Código do Domínio para uma linha do balancete, pela cascata da §6.4: ajuste manual, sinônimo,
 * nome idêntico, nome cortado e, por fim, pendência.
 *
 * Recebe o nome já normalizado e a natureza já resolvida: encadear é trabalho de `converter`.
 *
 * Quando um aviso convive com outro, vale a ordem em que a §6.5 lista os textos — o sinônimo
 * descartado (9) aparece antes do nome repetido (10), que aparece antes do nome igual (11) e do
 * nome cortado (12).
 */
export function resolverConta(entrada: {
  nomeNormalizado: string;
  natureza: ResultadoNatureza | null;
  ajusteManual: string | null;
  indice: IndicePlano;
  sinonimos: Map<string, string>;
}): ContaResolvida {
  const { nomeNormalizado, natureza, indice, sinonimos } = entrada;

  if (natureza === null) {
    return { codigo: null, origem: 'nao_encontrado', status: STATUS.semNatureza };
  }
  if (natureza.naoMigrar) {
    return { codigo: null, origem: 'nao_migrar', status: STATUS.naoMigrar(natureza.natureza) };
  }

  const ajusteManual = entrada.ajusteManual?.trim() ?? '';
  if (ajusteManual !== '') {
    const conta = indice.porCodigo.get(ajusteManual);
    if (conta === undefined) {
      return { codigo: null, origem: 'nao_encontrado', status: STATUS.manualInexistente };
    }
    // Ajuste manual vence sinônimo, nome igual e nome cortado. De natureza errada, avisa e não
    // bloqueia: o código fica, para a pessoa conferir.
    const status = valida(conta, natureza) ? STATUS.manual : STATUS.manualOutraNatureza;
    return { codigo: conta.codigoReduzido, origem: 'manual', status };
  }

  const codigoSinonimo = sinonimos.get(nomeNormalizado);
  let sinonimoDescartado = false;
  if (codigoSinonimo !== undefined) {
    const conta = indice.porCodigo.get(codigoSinonimo);
    if (conta !== undefined && valida(conta, natureza)) {
      return { codigo: conta.codigoReduzido, origem: 'sinonimo', status: STATUS.sinonimo };
    }
    sinonimoDescartado = true;
  }

  const mesmoNome = indice.porNomeNormalizado.get(nomeNormalizado) ?? [];
  // A contagem de repetição olha todas as analíticas de mesmo nome, sem filtrar por natureza,
  // como na planilha.
  const nomeRepetido = mesmoNome.length > 1;

  /** Resolvido pelo nome: o aviso mais antigo da §6.5 vence o texto normal da etapa. */
  const statusPorNome = (texto: string) =>
    sinonimoDescartado ? STATUS.sinonimoDescartado : nomeRepetido ? STATUS.nomeRepetido : texto;

  const porNomeIgual = mesmoNome.find((conta) => valida(conta, natureza));
  if (porNomeIgual !== undefined) {
    return {
      codigo: porNomeIgual.codigoReduzido,
      origem: 'nome_igual',
      status: statusPorNome(STATUS.nomeIgual),
    };
  }

  if (nomeNormalizado.length >= MINIMO_PARA_NOME_CORTADO) {
    const porNomeCortado = indice.analiticas.find(
      (conta) => conta.descricaoNormalizada.startsWith(nomeNormalizado) && valida(conta, natureza),
    );
    if (porNomeCortado !== undefined) {
      return {
        codigo: porNomeCortado.codigoReduzido,
        origem: 'nome_cortado',
        status: statusPorNome(STATUS.nomeCortado),
      };
    }
  }

  return {
    codigo: null,
    origem: 'nao_encontrado',
    status: sinonimoDescartado ? STATUS.semCodigoComSinonimoDescartado : STATUS.semCodigo,
  };
}
