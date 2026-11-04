// Confere, grupo a grupo, o balancete de ORIGEM contra o que vai ser implantado no DOMÍNIO.
// Função pura.
//
// Para que serve: chamar a atenção para um grupo cujo saldo mudou em relação ao balancete que veio
// da empresa. Pode ser erro — uma conta indicada para o grupo errado — ou pode ser proposital, uma
// reclassificação que a pessoa decidiu fazer. O sistema NÃO sabe a diferença, então ele sinaliza e
// quem analisa julga. É por isso que o resultado é "atenção", e não um veredito.
//
// A conta de cada grupo:
//
//     diferença = origem − pendente − domínio
//
// `pendente` sai da conta porque uma linha ainda sem conta indicada está legitimamente fora do
// Domínio; sem isso, toda pendência viraria falso alarme.
//
// DOIS NÍVEIS:
//
// 1º nível (ATIVO, PASSIVO, RECEITAS, CUSTOS E DESPESAS) — sempre dá para conferir: todo saldo
//    cai em um dos quatro, dos dois lados.
//
// 2º nível (Ativo Circulante, Patrimônio Líquido, Despesas Operacionais…) — só dá para conferir
//    quando a natureza da origem aponta para UM subgrupo do Domínio. A ponte é o `gruposDominio`
//    que o motor já resolve para cada linha e usa para validar as escolhas do de-para. Quando a
//    natureza aceita mais de um ("ATIVO" aceita 11 e 12), não existe subgrupo esperado: a conta
//    pode estar legitimamente em qualquer um deles, e apontar atenção ali seria alarme falso. Essas
//    linhas ficam de fora do 2º nível — e são informadas, para a conferência não parecer completa
//    sem ser.

import { grupoDaNatureza, type GrupoId } from './resumo-balancete.js';

export type ContaDoPlano = {
  codigoReduzido: string;
  classificacao: string;
  descricao: string;
};

export type LinhaParaConferir = {
  /** Natureza da conta de ORIGEM, como o motor resolveu pela classificação COSIF. */
  natureza: string;
  /** Subgrupos do Domínio que esta natureza aceita. Um só = dá para conferir o 2º nível. */
  gruposDominio: string[];
  /** Conta do Domínio indicada; null quando a linha ainda está pendente. */
  codigo: string | null;
  /** Assinado: negativo é devedor. */
  saldoAtual: number;
};

export type GrupoConferido = {
  chave: string;
  /** 0 para o grupo de topo, 1 para o subgrupo. */
  nivel: number;
  rotulo: string;
  origem: number;
  pendente: number;
  dominio: number;
  diferenca: number;
  confere: boolean;
};

export type Contagem = { quantidade: number; saldo: number };

export type Conferencia = {
  /** Grupos de topo e subgrupos, em ordem de classificação. */
  grupos: GrupoConferido[];
  /** true quando nenhum grupo, de nenhum nível, pede atenção. */
  confere: boolean;
  /**
   * Linhas que não dá para conferir em nível nenhum — natureza de origem não reconhecida, ou conta
   * indicada que não está no plano. Ficam DE FORA dos dois lados, para a aritmética continuar
   * exata, e são informadas para ninguém achar que a conferência cobriu tudo.
   */
  foraDaConferencia: Contagem;
  /** Linhas conferidas no 1º nível, mas cuja natureza não determina UM subgrupo. */
  foraDoSubgrupo: Contagem;
};

/**
 * Onde cada grupo da origem cai no plano do DOMÍNIO. O patrimônio líquido não tem grupo de topo
 * próprio no Domínio: ele mora dentro do PASSIVO (classificação 24), então é lá que ele é
 * conferido — comparar contra um grupo que não existe no destino só produziria alarme falso.
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

type Acumulador = {
  origem: Map<string, number>;
  pendente: Map<string, number>;
  dominio: Map<string, number>;
};

const novoAcumulador = (): Acumulador => ({
  origem: new Map(),
  pendente: new Map(),
  dominio: new Map(),
});

const soma = (mapa: Map<string, number>, chave: string, valor: number): void => {
  mapa.set(chave, (mapa.get(chave) ?? 0) + valor);
};

export function conferirPorGrupo(
  linhas: LinhaParaConferir[],
  plano: ContaDoPlano[],
): Conferencia {
  // Os grupos e seus nomes saem do próprio plano de destino.
  const rotulos = new Map<string, string>(); // chave (1 ou 2 dígitos) → nome
  for (const conta of plano) {
    const c = conta.classificacao.trim();
    if (c.length === 1 || c.length === 2) rotulos.set(c, conta.descricao);
  }
  const porCodigo = new Map(plano.map((c) => [c.codigoReduzido, c]));
  const ehGrupo = (chave: string, digitos: number): boolean =>
    chave.length === digitos && rotulos.has(chave);

  const topo = novoAcumulador();
  const sub = novoAcumulador();
  const fora: Contagem = { quantidade: 0, saldo: 0 };
  const foraSub: Contagem = { quantidade: 0, saldo: 0 };
  const contar = (c: Contagem, saldo: number): void => {
    c.quantidade += 1;
    c.saldo += saldo;
  };

  for (const linha of linhas) {
    const grupo = grupoDaNatureza(linha.natureza);
    const chaveTopo = grupo === null ? null : CHAVE_NO_DOMINIO[grupo];
    if (chaveTopo === null || !ehGrupo(chaveTopo, 1)) {
      contar(fora, linha.saldoAtual);
      continue;
    }

    const destino = linha.codigo === null ? undefined : porCodigo.get(linha.codigo);
    if (linha.codigo !== null && destino === undefined) {
      // Indicada para uma conta que não está no plano: não dá para dizer onde caiu.
      contar(fora, linha.saldoAtual);
      continue;
    }

    const classificacaoDestino = destino === undefined ? '' : destino.classificacao.trim();
    const topoDestino = classificacaoDestino.slice(0, 1);
    if (destino !== undefined && !ehGrupo(topoDestino, 1)) {
      contar(fora, linha.saldoAtual);
      continue;
    }

    // --- 1º nível: sempre confere.
    soma(topo.origem, chaveTopo, linha.saldoAtual);
    if (destino === undefined) soma(topo.pendente, chaveTopo, linha.saldoAtual);
    else soma(topo.dominio, topoDestino, linha.saldoAtual);

    // --- 2º nível: só quando a natureza determina UM subgrupo.
    const esperado = linha.gruposDominio.length === 1 ? linha.gruposDominio[0] : null;
    const subDestino = classificacaoDestino.slice(0, 2);
    const destinoConferivel = destino === undefined || ehGrupo(subDestino, 2);
    if (esperado === null || !ehGrupo(esperado, 2) || !destinoConferivel) {
      contar(foraSub, linha.saldoAtual);
      continue;
    }

    soma(sub.origem, esperado, linha.saldoAtual);
    if (destino === undefined) soma(sub.pendente, esperado, linha.saldoAtual);
    else soma(sub.dominio, subDestino, linha.saldoAtual);
  }

  const montar = (acc: Acumulador, nivel: number, digitos: number): GrupoConferido[] =>
    [...rotulos.keys()]
      .filter((chave) => chave.length === digitos)
      .map((chave) => {
        const o = arredondar2(acc.origem.get(chave) ?? 0);
        const p = arredondar2(acc.pendente.get(chave) ?? 0);
        const d = arredondar2(acc.dominio.get(chave) ?? 0);
        const diferenca = arredondar2(o - p - d);
        return {
          chave,
          nivel,
          rotulo: rotulos.get(chave) ?? chave,
          origem: o,
          pendente: p,
          dominio: d,
          diferenca,
          confere: diferenca === 0,
        };
      })
      // Grupo que não apareceu de nenhum dos lados não diz nada.
      .filter((g) => g.origem !== 0 || g.dominio !== 0 || g.pendente !== 0);

  // Ordem de classificação: o subgrupo vem logo depois do grupo que o contém.
  const grupos = [...montar(topo, 0, 1), ...montar(sub, 1, 2)].sort((a, b) =>
    a.chave < b.chave ? -1 : a.chave > b.chave ? 1 : 0,
  );

  return {
    grupos,
    confere: grupos.every((g) => g.confere),
    foraDaConferencia: { quantidade: fora.quantidade, saldo: arredondar2(fora.saldo) },
    foraDoSubgrupo: { quantidade: foraSub.quantidade, saldo: arredondar2(foraSub.saldo) },
  };
}
