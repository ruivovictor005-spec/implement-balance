-- Cadastro próprio com e-mail + senha e recuperação por e-mail.
-- O oid do Entra deixa de ser obrigatório (usuários de cadastro próprio não têm oid).
ALTER TABLE "usuario" ALTER COLUMN "oid_entra" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "usuario" ADD COLUMN "senha_hash" text;--> statement-breakpoint
ALTER TABLE "usuario" ADD COLUMN "recuperacao_codigo_hash" text;--> statement-breakpoint
ALTER TABLE "usuario" ADD COLUMN "recuperacao_expira" timestamp with time zone;--> statement-breakpoint
-- E-mail único (ignorando maiúsculas) entre as contas que têm e-mail: é por ele que a pessoa entra.
CREATE UNIQUE INDEX IF NOT EXISTS "usuario_email_unico" ON "usuario" (lower("email")) WHERE "email" <> '';
