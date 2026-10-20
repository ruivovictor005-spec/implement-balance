CREATE TYPE "public"."papel" AS ENUM('usuario', 'revisor', 'admin');--> statement-breakpoint
CREATE TYPE "public"."status_alteracao" AS ENUM('pendente', 'aprovada', 'rejeitada');--> statement-breakpoint
CREATE TYPE "public"."status_implantacao" AS ENUM('em_andamento', 'concluida', 'descartada');--> statement-breakpoint
CREATE TYPE "public"."status_sinonimo" AS ENUM('ativo', 'arquivado');--> statement-breakpoint
CREATE TYPE "public"."tipo_conta" AS ENUM('A', 'S');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "alteracao_sinonimo" (
	"id" serial PRIMARY KEY NOT NULL,
	"sinonimo_id" integer NOT NULL,
	"codigo_proposto" text NOT NULL,
	"motivo" text,
	"solicitado_por" integer,
	"status" "status_alteracao" DEFAULT 'pendente' NOT NULL,
	"revisado_por" integer,
	"observacao_revisor" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "auditoria" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"usuario_id" integer,
	"acao" text NOT NULL,
	"entidade" text,
	"entidade_id" text,
	"detalhes" jsonb,
	"ip" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "conta_criada" (
	"id" serial PRIMARY KEY NOT NULL,
	"implantacao_id" integer NOT NULL,
	"codigo_reduzido" text NOT NULL,
	"descricao" text NOT NULL,
	"classificacao" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "implantacao" (
	"id" serial PRIMARY KEY NOT NULL,
	"usuario_id" integer NOT NULL,
	"empresa_codigo_dominio" text,
	"empresa_cnpj" text,
	"empresa_nome" text,
	"data_saldo" date,
	"tipo_lote" text,
	"codigo_historico" text,
	"incluir_cabecalho" boolean DEFAULT false NOT NULL,
	"plano_versao_id" integer,
	"layout_detectado" text,
	"arquivo_origem" text,
	"status" "status_implantacao" DEFAULT 'em_andamento' NOT NULL,
	"iniciada_em" timestamp with time zone DEFAULT now() NOT NULL,
	"concluida_em" timestamp with time zone,
	"tempo_ativo_segundos" integer,
	"qtd_analiticas" integer,
	"qtd_mapeadas" integer,
	"qtd_pendentes" integer,
	"saldo_pendente" numeric(18, 2),
	"total_debito" numeric(18, 2),
	"total_credito" numeric(18, 2),
	"diferenca" numeric(18, 2),
	"liberacao_motivo" text,
	"txt_gerado" text,
	"txt_hash" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "implantacao_linha" (
	"id" serial PRIMARY KEY NOT NULL,
	"implantacao_id" integer NOT NULL,
	"ordem" integer NOT NULL,
	"codi_cta" text,
	"nome_cta" text,
	"clas_cta" text,
	"tipo_cta" text,
	"saldo_anterior" numeric(18, 2),
	"total_debito" numeric(18, 2),
	"total_credito" numeric(18, 2),
	"saldo_atual" numeric(18, 2),
	"nome_normalizado" text,
	"natureza" text,
	"grupos_permitidos" text[],
	"ajuste_manual" text,
	"codigo_resolvido" text,
	"origem_resolucao" text,
	"status_texto" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "plano_conta" (
	"id" serial PRIMARY KEY NOT NULL,
	"plano_versao_id" integer NOT NULL,
	"codigo_reduzido" text NOT NULL,
	"classificacao" text NOT NULL,
	"descricao" text NOT NULL,
	"tipo" "tipo_conta" NOT NULL,
	"descricao_normalizada" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "plano_versao" (
	"id" serial PRIMARY KEY NOT NULL,
	"nome" text NOT NULL,
	"descricao" text,
	"vigente" boolean DEFAULT false NOT NULL,
	"criada_por" integer,
	"criada_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "regra_natureza" (
	"id" serial PRIMARY KEY NOT NULL,
	"plano_versao_id" integer NOT NULL,
	"ordem" integer NOT NULL,
	"prefixo_classificacao" text NOT NULL,
	"grupo_cosif" text NOT NULL,
	"natureza" text NOT NULL,
	"grupos_dominio" text[] NOT NULL,
	"nao_migrar" boolean DEFAULT false NOT NULL,
	"observacao" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "regra_normalizacao" (
	"id" serial PRIMARY KEY NOT NULL,
	"plano_versao_id" integer NOT NULL,
	"etapa" integer NOT NULL,
	"ordem" integer NOT NULL,
	"de" text NOT NULL,
	"para" text NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sinonimo" (
	"id" serial PRIMARY KEY NOT NULL,
	"plano_versao_id" integer NOT NULL,
	"nome_original" text NOT NULL,
	"chave_normalizada" text NOT NULL,
	"codigo_reduzido" text NOT NULL,
	"fora_do_padrao" boolean DEFAULT false NOT NULL,
	"motivo" text,
	"status" "status_sinonimo" DEFAULT 'ativo' NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sinonimo_evento" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"sinonimo_id" integer NOT NULL,
	"tipo" text NOT NULL,
	"codigo_de" text,
	"codigo_para" text,
	"motivo" text,
	"autor_id" integer,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "usuario" (
	"id" serial PRIMARY KEY NOT NULL,
	"oid_entra" text NOT NULL,
	"email" text NOT NULL,
	"nome" text NOT NULL,
	"papel" "papel" DEFAULT 'usuario' NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	"ultimo_acesso_em" timestamp with time zone,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "usuario_oid_entra_unique" UNIQUE("oid_entra")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "alteracao_sinonimo" ADD CONSTRAINT "alteracao_sinonimo_sinonimo_id_sinonimo_id_fk" FOREIGN KEY ("sinonimo_id") REFERENCES "public"."sinonimo"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "alteracao_sinonimo" ADD CONSTRAINT "alteracao_sinonimo_solicitado_por_usuario_id_fk" FOREIGN KEY ("solicitado_por") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "alteracao_sinonimo" ADD CONSTRAINT "alteracao_sinonimo_revisado_por_usuario_id_fk" FOREIGN KEY ("revisado_por") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "auditoria" ADD CONSTRAINT "auditoria_usuario_id_usuario_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "conta_criada" ADD CONSTRAINT "conta_criada_implantacao_id_implantacao_id_fk" FOREIGN KEY ("implantacao_id") REFERENCES "public"."implantacao"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "implantacao" ADD CONSTRAINT "implantacao_usuario_id_usuario_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "implantacao" ADD CONSTRAINT "implantacao_plano_versao_id_plano_versao_id_fk" FOREIGN KEY ("plano_versao_id") REFERENCES "public"."plano_versao"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "implantacao_linha" ADD CONSTRAINT "implantacao_linha_implantacao_id_implantacao_id_fk" FOREIGN KEY ("implantacao_id") REFERENCES "public"."implantacao"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "plano_conta" ADD CONSTRAINT "plano_conta_plano_versao_id_plano_versao_id_fk" FOREIGN KEY ("plano_versao_id") REFERENCES "public"."plano_versao"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "plano_versao" ADD CONSTRAINT "plano_versao_criada_por_usuario_id_fk" FOREIGN KEY ("criada_por") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "regra_natureza" ADD CONSTRAINT "regra_natureza_plano_versao_id_plano_versao_id_fk" FOREIGN KEY ("plano_versao_id") REFERENCES "public"."plano_versao"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "regra_normalizacao" ADD CONSTRAINT "regra_normalizacao_plano_versao_id_plano_versao_id_fk" FOREIGN KEY ("plano_versao_id") REFERENCES "public"."plano_versao"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sinonimo" ADD CONSTRAINT "sinonimo_plano_versao_id_plano_versao_id_fk" FOREIGN KEY ("plano_versao_id") REFERENCES "public"."plano_versao"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sinonimo_evento" ADD CONSTRAINT "sinonimo_evento_sinonimo_id_sinonimo_id_fk" FOREIGN KEY ("sinonimo_id") REFERENCES "public"."sinonimo"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sinonimo_evento" ADD CONSTRAINT "sinonimo_evento_autor_id_usuario_id_fk" FOREIGN KEY ("autor_id") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "implantacao_uma_em_andamento" ON "implantacao" USING btree ("usuario_id") WHERE "implantacao"."status" = 'em_andamento';--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "plano_conta_codigo_por_versao" ON "plano_conta" USING btree ("plano_versao_id","codigo_reduzido");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "plano_versao_uma_vigente" ON "plano_versao" USING btree ("vigente") WHERE "plano_versao"."vigente";--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "sinonimo_ativo_unico" ON "sinonimo" USING btree ("chave_normalizada","plano_versao_id") WHERE "sinonimo"."status" = 'ativo';