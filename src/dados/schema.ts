// Schema Drizzle de todas as tabelas da §8 da spec. As regras de negócio (plano de contas,
// normalização, natureza, sinônimos) são DADOS aqui, versionados, nunca código.
import { sql } from 'drizzle-orm';
import {
  bigserial,
  boolean,
  date,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

export const papel = pgEnum('papel', ['usuario', 'revisor', 'admin']);
export const tipoConta = pgEnum('tipo_conta', ['A', 'S']);
export const statusSinonimo = pgEnum('status_sinonimo', ['ativo', 'arquivado']);
export const statusAlteracao = pgEnum('status_alteracao', ['pendente', 'aprovada', 'rejeitada']);
export const statusImplantacao = pgEnum('status_implantacao', ['em_andamento', 'concluida', 'descartada']);

export const usuario = pgTable('usuario', {
  id: serial('id').primaryKey(),
  // Identidade por e-mail+senha (cadastro próprio). O oid do Entra fica opcional (legado).
  oidEntra: text('oid_entra').unique(),
  email: text('email').notNull(),
  nome: text('nome').notNull(),
  senhaHash: text('senha_hash'),
  recuperacaoCodigoHash: text('recuperacao_codigo_hash'),
  recuperacaoExpira: timestamp('recuperacao_expira', { withTimezone: true }),
  papel: papel('papel').notNull().default('usuario'),
  ativo: boolean('ativo').notNull().default(true),
  ultimoAcessoEm: timestamp('ultimo_acesso_em', { withTimezone: true }),
  criadoEm: timestamp('criado_em', { withTimezone: true }).notNull().defaultNow(),
});

export const planoVersao = pgTable(
  'plano_versao',
  {
    id: serial('id').primaryKey(),
    nome: text('nome').notNull(),
    descricao: text('descricao'),
    vigente: boolean('vigente').notNull().default(false),
    criadaPor: integer('criada_por').references(() => usuario.id),
    criadaEm: timestamp('criada_em', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // Só uma versão pode estar vigente: índice único parcial sobre as linhas vigentes.
    uniqueIndex('plano_versao_uma_vigente').on(t.vigente).where(sql`${t.vigente}`),
  ],
);

export const planoConta = pgTable(
  'plano_conta',
  {
    id: serial('id').primaryKey(),
    planoVersaoId: integer('plano_versao_id')
      .notNull()
      .references(() => planoVersao.id, { onDelete: 'cascade' }),
    codigoReduzido: text('codigo_reduzido').notNull(),
    classificacao: text('classificacao').notNull(),
    descricao: text('descricao').notNull(),
    tipo: tipoConta('tipo').notNull(),
    descricaoNormalizada: text('descricao_normalizada').notNull(),
  },
  (t) => [uniqueIndex('plano_conta_codigo_por_versao').on(t.planoVersaoId, t.codigoReduzido)],
);

export const regraNormalizacao = pgTable('regra_normalizacao', {
  id: serial('id').primaryKey(),
  planoVersaoId: integer('plano_versao_id')
    .notNull()
    .references(() => planoVersao.id, { onDelete: 'cascade' }),
  etapa: integer('etapa').notNull(), // 1 ou 2
  ordem: integer('ordem').notNull(),
  de: text('de').notNull(),
  para: text('para').notNull(),
  ativo: boolean('ativo').notNull().default(true),
});

export const regraNatureza = pgTable('regra_natureza', {
  id: serial('id').primaryKey(),
  planoVersaoId: integer('plano_versao_id')
    .notNull()
    .references(() => planoVersao.id, { onDelete: 'cascade' }),
  ordem: integer('ordem').notNull(),
  prefixoClassificacao: text('prefixo_classificacao').notNull(),
  grupoCosif: text('grupo_cosif').notNull(),
  natureza: text('natureza').notNull(),
  gruposDominio: text('grupos_dominio').array().notNull(),
  naoMigrar: boolean('nao_migrar').notNull().default(false),
  observacao: text('observacao'),
});

export const sinonimo = pgTable(
  'sinonimo',
  {
    id: serial('id').primaryKey(),
    planoVersaoId: integer('plano_versao_id')
      .notNull()
      .references(() => planoVersao.id, { onDelete: 'cascade' }),
    nomeOriginal: text('nome_original').notNull(),
    chaveNormalizada: text('chave_normalizada').notNull(),
    codigoReduzido: text('codigo_reduzido').notNull(),
    foraDoPadrao: boolean('fora_do_padrao').notNull().default(false),
    motivo: text('motivo'),
    status: statusSinonimo('status').notNull().default('ativo'),
    criadoEm: timestamp('criado_em', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // Único por (chave, versão) apenas entre os ATIVOS: um arquivado não conflita com o ativo.
    uniqueIndex('sinonimo_ativo_unico')
      .on(t.chaveNormalizada, t.planoVersaoId)
      .where(sql`${t.status} = 'ativo'`),
  ],
);

// Só cresce, nunca é alterado: é a base do histórico e do desfazer. A imutabilidade é reforçada por
// um gatilho (migração custom) que barra UPDATE e DELETE.
export const sinonimoEvento = pgTable('sinonimo_evento', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  sinonimoId: integer('sinonimo_id')
    .notNull()
    .references(() => sinonimo.id),
  tipo: text('tipo').notNull(),
  codigoDe: text('codigo_de'),
  codigoPara: text('codigo_para'),
  motivo: text('motivo'),
  autorId: integer('autor_id').references(() => usuario.id),
  criadoEm: timestamp('criado_em', { withTimezone: true }).notNull().defaultNow(),
});

export const alteracaoSinonimo = pgTable('alteracao_sinonimo', {
  id: serial('id').primaryKey(),
  sinonimoId: integer('sinonimo_id')
    .notNull()
    .references(() => sinonimo.id),
  codigoProposto: text('codigo_proposto').notNull(),
  motivo: text('motivo'),
  solicitadoPor: integer('solicitado_por').references(() => usuario.id),
  status: statusAlteracao('status').notNull().default('pendente'),
  revisadoPor: integer('revisado_por').references(() => usuario.id),
  observacaoRevisor: text('observacao_revisor'),
  criadoEm: timestamp('criado_em', { withTimezone: true }).notNull().defaultNow(),
});

export const implantacao = pgTable(
  'implantacao',
  {
    id: serial('id').primaryKey(),
    usuarioId: integer('usuario_id')
      .notNull()
      .references(() => usuario.id),
    empresaCodigoDominio: text('empresa_codigo_dominio'),
    empresaCnpj: text('empresa_cnpj'),
    empresaNome: text('empresa_nome'),
    dataSaldo: date('data_saldo'),
    tipoLote: text('tipo_lote'),
    codigoHistorico: text('codigo_historico'),
    incluirCabecalho: boolean('incluir_cabecalho').notNull().default(false),
    planoVersaoId: integer('plano_versao_id').references(() => planoVersao.id),
    layoutDetectado: text('layout_detectado'),
    arquivoOrigem: text('arquivo_origem'),
    nomeArquivoTxt: text('nome_arquivo_txt'),
    status: statusImplantacao('status').notNull().default('em_andamento'),
    iniciadaEm: timestamp('iniciada_em', { withTimezone: true }).notNull().defaultNow(),
    // Quando a pessoa apertou "Salvar e continuar depois". Nulo = começou e saiu sem decidir.
    guardadaEm: timestamp('guardada_em', { withTimezone: true }),
    concluidaEm: timestamp('concluida_em', { withTimezone: true }),
    tempoAtivoSegundos: integer('tempo_ativo_segundos'),
    qtdAnaliticas: integer('qtd_analiticas'),
    qtdMapeadas: integer('qtd_mapeadas'),
    qtdPendentes: integer('qtd_pendentes'),
    saldoPendente: numeric('saldo_pendente', { precision: 18, scale: 2 }),
    totalDebito: numeric('total_debito', { precision: 18, scale: 2 }),
    totalCredito: numeric('total_credito', { precision: 18, scale: 2 }),
    diferenca: numeric('diferenca', { precision: 18, scale: 2 }),
    liberacaoMotivo: text('liberacao_motivo'),
    txtGerado: text('txt_gerado'),
    txtHash: text('txt_hash'),
  },
);

export const implantacaoLinha = pgTable('implantacao_linha', {
  id: serial('id').primaryKey(),
  implantacaoId: integer('implantacao_id')
    .notNull()
    .references(() => implantacao.id, { onDelete: 'cascade' }),
  ordem: integer('ordem').notNull(),
  codiCta: text('codi_cta'),
  nomeCta: text('nome_cta'),
  clasCta: text('clas_cta'),
  tipoCta: text('tipo_cta'),
  saldoAnterior: numeric('saldo_anterior', { precision: 18, scale: 2 }),
  totalDebito: numeric('total_debito', { precision: 18, scale: 2 }),
  totalCredito: numeric('total_credito', { precision: 18, scale: 2 }),
  saldoAtual: numeric('saldo_atual', { precision: 18, scale: 2 }),
  nomeNormalizado: text('nome_normalizado'),
  natureza: text('natureza'),
  gruposPermitidos: text('grupos_permitidos').array(),
  ajusteManual: text('ajuste_manual'),
  codigoResolvido: text('codigo_resolvido'),
  origemResolucao: text('origem_resolucao'),
  statusTexto: text('status_texto'),
});

export const contaCriada = pgTable('conta_criada', {
  id: serial('id').primaryKey(),
  implantacaoId: integer('implantacao_id')
    .notNull()
    .references(() => implantacao.id, { onDelete: 'cascade' }),
  codigoReduzido: text('codigo_reduzido').notNull(),
  descricao: text('descricao').notNull(),
  classificacao: text('classificacao').notNull(),
});

export const auditoria = pgTable('auditoria', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  usuarioId: integer('usuario_id').references(() => usuario.id),
  acao: text('acao').notNull(),
  entidade: text('entidade'),
  entidadeId: text('entidade_id'),
  detalhes: jsonb('detalhes'),
  ip: text('ip'),
  criadoEm: timestamp('criado_em', { withTimezone: true }).notNull().defaultNow(),
});
