-- Sinônimo novo passa pela aprovação do administrador antes de valer para todos: entra como
-- 'pendente' (não é lido pelo motor) e vira 'ativo' ou 'rejeitado' na decisão.
ALTER TYPE "public"."status_sinonimo" ADD VALUE IF NOT EXISTS 'pendente';--> statement-breakpoint
ALTER TYPE "public"."status_sinonimo" ADD VALUE IF NOT EXISTS 'rejeitado';--> statement-breakpoint
ALTER TABLE "sinonimo" ADD COLUMN "proposto_por" integer REFERENCES "usuario"("id");--> statement-breakpoint
ALTER TABLE "sinonimo" ADD COLUMN "observacao_decisao" text;
