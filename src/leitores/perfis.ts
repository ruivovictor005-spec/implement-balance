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

export const PERFIS: Perfil[] = [
  {
    id: 'dominio',
    nome: 'Domínio',
    apelidos: {
      codiCta: ['codi_cta', 'código', 'conta', 'código reduzido', 'cod conta'],
      nomeCta: ['nome_cta', 'nome', 'descrição', 'nome da conta'],
      clasCta: ['clas_cta', 'classificação', 'máscara'],
      tipoCta: ['tipo_cta', 'tipo'],
      saldoAnterior: ['saldoant', 'saldo anterior'],
      totalDebito: ['totdeb', 'débito', 'total débito', 'débitos'],
      totalCredito: ['totcre', 'crédito', 'total crédito', 'créditos'],
      saldoAtual: ['saldoatu', 'saldo atual', 'saldo'],
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
    },
  },
];
