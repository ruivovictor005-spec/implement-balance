// Perfis de leitura: cada um diz, por apelidos de cabeçalho, como reconhecer um layout de
// balancete e mapear suas colunas para os campos canônicos do motor. Acrescentar um layout novo é
// cadastrar um perfil aqui, não programar (spec §7).
//
// Os apelidos são comparados de forma normalizada (minúsculas, sem acento, só letras/dígitos), então
// "codi_cta", "Código" e "código" casam a mesma coluna.

export type Perfil = {
  id: 'dominio' | 'infobank';
  nome: string;
  /** campo canônico do balancete → nomes de cabeçalho que o identificam. */
  apelidos: Record<string, string[]>;
};

/**
 * Cabeçalhos de uma coluna que só diz o lado do saldo (D/C). "natureza" entra porque no Domínio
 * essa coluna é devedora/credora; se vier outra coisa, o leitor ignora em vez de inventar um lado.
 */
const LADO_SALDO = ['d/c', 'dc', 'd c', 'lado', 'lado do saldo', 'natureza', 'natureza do saldo'];

export const PERFIS: Perfil[] = [
  {
    id: 'dominio',
    nome: 'Domínio',
    apelidos: {
      codiCta: ['codi_cta', 'código', 'conta', 'código reduzido', 'cod conta'],
      nomeCta: ['nome_cta', 'nome', 'descrição', 'nome da conta', 'descrição da conta', 'descrição conta'],
      clasCta: ['clas_cta', 'classificação', 'máscara'],
      tipoCta: ['tipo_cta', 'tipo'],
      saldoAnterior: ['saldoant', 'saldo anterior'],
      totalDebito: ['totdeb', 'débito', 'total débito', 'débitos'],
      totalCredito: ['totcre', 'crédito', 'total crédito', 'créditos'],
      saldoAtual: ['saldoatu', 'saldo atual', 'saldo'],
      // Opcional: coluna a mais em que a pessoa marca C (custo) ou D (despesa). NÃO confundir com a
      // coluna "natureza" do Domínio, que diz devedora/credora.
      custoDespesa: ['custo_despesa', 'custo ou despesa', 'custo/despesa', 'custo despesa', 'c/d'],
      // Opcional: coluna em que o export escreve de que LADO está o saldo atual (D/C). Quando
      // existe, ela decide o sinal — é a origem dizendo o lado, em vez de o sistema deduzir.
      ladoSaldo: LADO_SALDO,
    },
  },
  {
    id: 'infobank',
    nome: 'Infobank (COSIF)',
    // Layout confirmado pelos cabeçalhos reais da planilha Infobank (clas_cta em A, cta_reduzida em
    // G, saldo atual em F, tipo_cta em K). ATENÇÃO: a convenção de sinal do "saldo atual" do Infobank
    // ainda NÃO foi validada contra um TXT esperado real — é a dependência externa da spec §7. Hoje o
    // saldo é lido como está, sem inversão; confirmar com uma amostra real antes de usar em produção.
    apelidos: {
      codiCta: ['cta_reduzida', 'conta reduzida', 'código reduzido', 'reduzida'],
      nomeCta: ['nome_cta', 'nome', 'descrição'],
      clasCta: ['clas_cta', 'classificação', 'cosif'],
      tipoCta: ['tipo_cta', 'tipo'],
      saldoAnterior: ['saldo anterior', 'saldoant'],
      totalDebito: ['totdeb', 'débito', 'total débito'],
      totalCredito: ['totcre', 'crédito', 'total crédito'],
      saldoAtual: ['saldo atual', 'saldoatu'],
      custoDespesa: ['custo_despesa', 'custo ou despesa', 'custo/despesa', 'custo despesa', 'c/d'],
      ladoSaldo: LADO_SALDO,
    },
  },
];
