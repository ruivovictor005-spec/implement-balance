// Confere, grupo a grupo, o balancete de ORIGEM contra o que vai ser implantado no DOMÍNIO.
// Função pura.
//
// Para que serve: achar a conta que foi mapeada para o grupo errado. Se uma conta de ATIVO foi
// indicada para uma conta de DESPESA, o total do ativo fica faltando e o da despesa fica sobrando
// — pelo mesmo valor, com sinais opostos. É esse par que denuncia o erro, e é por isso que a
// conferência é por grupo: ela não depende de a pessoa comparar duas tabelas de cabeça.
//
// A conta de cada grupo:
//
//     diferença = origem − pendente − domínio
//
// `pendente` sai da conta porque uma linha ainda sem conta indicada está legitimamente fora do
// Domínio; sem isso, toda pendência viraria uma falsa divergência.
//
// Os dois lados falam vocabulários diferentes — a origem é classificada em COSIF, o destino no
// plano do Domínio —, então ambos são traduzidos para os grupos de 1º nível do plano de DESTINO,
// que é onde os saldos vão parar.

import { grupoDaNatureza, type GrupoId } from './resumo-balancete.js';

export type ContaDoPlano = {
  codigoReduzido: string;
  classificacao: string;
  descricao: string;
};

export type LinhaParaConferir = {
  /** Natureza da conta de ORIGEM, como o motor resolveu pela classificação COSIF. */
  natureza: string;
  /** Conta do Domínio indicada; null quando a linha ainda está pendente. */
  codigo: string | null;
  /** Assinado: negativo é devedor. */
  saldoAtual: number;
};

export type GrupoConferido = {
  chave: string;
  rotulo: string;
  origem: number;
  pendente: number;
  dominio: number;
  diferenca: number;
  confere: boolean;
};

export type Conferencia = {
  grupos: GrupoConferido[];
  /** true quando nenhum grupo tem diferença. */
  confere: boolean;
  /**
   * Linhas que não dá para conferir — natureza de origem não reconhecida, ou conta indicada que
   * não está no plano. Ficam DE FORA dos dois lados, para a aritmética da tabela continuar exata,
   * e são informadas para ninguém achar que a conferência cobriu tudo.
   */
  foraDaConferencia: { quantidade: number; saldo: number };
};

/**
 * Onde cada grupo da origem cai no plano do DOMÍNIO. O patrimônio líquido não tem grupo de topo
 * próprio no Domínio: ele mora dentro do PASSIVO (classificação 24), então é lá que ele é
 * conferido — comparar contra um grupo que não existe no destino só produziria divergência falsa.
 */
const CHAVE_NO_DOMINIO: Record<GrupoId, string> = {
  ativo: '1',
  passivo: '2',
  patrimonioLiquido: '2',
  receitas: '3',
  custos: '4',
};

/** ROUND do Excel em 2 casas, como no resto do motor. */
function arredondar2(valor: number): number {
  const sinal = valor < 0 ? -1 : 1;
  return (sinal * Math.round(Math.abs(valor) * 100)) / 100;
}

export function conferirPorGrupo(
  linhas: LinhaParaConferir[],
  plano: ContaDoPlano[],
): Conferencia {
  // Os grupos e seus nomes saem do próprio plano de destino.
  const rotulos = new Map<string, string>();
  for (const conta of plano) {
    const c = conta.classificacao.trim();
    if (c.length === 1) rotulos.set(c, conta.descricao);
  }
  const porCodigo = new Map(plano.map((c) => [c.codigoReduzido, c]));

  const origem = new Map<string, number>();
  const pendente = new Map<string, number>();
  const dominio = new Map<string, number>();
  const soma = (mapa: Map<string, number>, chave: string, valor: number): void => {
    mapa.set(chave, (mapa.get(chave) ?? 0) + valor);
  };

  let foraQuantidade = 0;
  let foraSaldo = 0;

  for (const linha of linhas) {
    const grupo = grupoDaNatureza(linha.natureza);
    const chaveOrigem = grupo === null ? null : CHAVE_NO_DOMINIO[grupo];

    // Sem grupo de origem não há contra o que comparar.
    if (chaveOrigem === null || !rotulos.has(chaveOrigem)) {
      foraQuantidade += 1;
      foraSaldo += linha.saldoAtual;
      continue;
    }

    if (linha.codigo === null) {
      soma(origem, chaveOrigem, linha.saldoAtual);
      soma(pendente, chaveOrigem, linha.saldoAtual);
      continue;
    }

    const destino = porCodigo.get(linha.codigo);
    const chaveDestino = destino === undefined ? '' : destino.classificacao.trim().slice(0, 1);
    if (!rotulos.has(chaveDestino)) {
      // Indicada para uma conta que não está no plano: não dá para dizer em que grupo caiu.
      foraQuantidade += 1;
      foraSaldo += linha.saldoAtual;
      continue;
    }

    soma(origem, chaveOrigem, linha.saldoAtual);
    soma(dominio, chaveDestino, linha.saldoAtual);
  }

  const chaves = [...rotulos.keys()].sort();
  const grupos: GrupoConferido[] = chaves
    .map((chave) => {
      const o = arredondar2(origem.get(chave) ?? 0);
      const p = arredondar2(pendente.get(chave) ?? 0);
      const d = arredondar2(dominio.get(chave) ?? 0);
      const diferenca = arredondar2(o - p - d);
      return {
        chave,
        rotulo: rotulos.get(chave) ?? chave,
        origem: o,
        pendente: p,
        dominio: d,
        diferenca,
        confere: diferenca === 0,
      };
    })
    // Grupo que não apareceu de nenhum dos lados não diz nada; fica de fora da tabela.
    .filter((g) => g.origem !== 0 || g.dominio !== 0 || g.pendente !== 0);

  return {
    grupos,
    confere: grupos.every((g) => g.confere),
    foraDaConferencia: { quantidade: foraQuantidade, saldo: arredondar2(foraSaldo) },
  };
}
