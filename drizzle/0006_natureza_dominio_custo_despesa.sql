-- Natureza do plano de DESTINO (Domínio) e indicação opcional de custo/despesa.
ALTER TABLE "regra_natureza" ADD COLUMN "conjunto" text DEFAULT 'cosif' NOT NULL;--> statement-breakpoint
ALTER TABLE "implantacao_linha" ADD COLUMN "custo_despesa" text;--> statement-breakpoint
-- Bancos que já existem: carrega a tabela "Natureza Domínio" na versão vigente do plano. Num banco
-- novo ainda não há versão vigente aqui, e quem traz a tabela é a carga inicial (scripts/semear.ts).
INSERT INTO "regra_natureza" ("plano_versao_id", "ordem", "prefixo_classificacao", "grupo_cosif", "natureza", "grupos_dominio", "nao_migrar", "conjunto")
SELECT v."id", r.ordem, r.prefixo, r.grupo, r.natureza, r.grupos, false, 'dominio'
FROM "plano_versao" v
CROSS JOIN (VALUES
  (1001, '11', 'Ativo Circulante', 'ATIVO CIRCULANTE', ARRAY['11']::text[]),
  (1002, '12', 'Ativo Não Circulante - Realizável a LP', 'ATIVO NÃO CIRCULANTE', ARRAY['12']::text[]),
  (1003, '13', 'Ativo Não Circulante - Invest./Imob./Intang.', 'ATIVO NÃO CIRCULANTE', ARRAY['13']::text[]),
  (1004, '1', 'Ativo (demais)', 'ATIVO', ARRAY['1']::text[]),
  (1005, '21', 'Passivo Circulante', 'PASSIVO CIRCULANTE', ARRAY['21']::text[]),
  (1006, '22', 'Passivo Não Circulante', 'PASSIVO NÃO CIRCULANTE', ARRAY['22']::text[]),
  (1007, '23', 'Resultado de Exercícios Futuros', 'PASSIVO - REF', ARRAY['23']::text[]),
  (1008, '24', 'Patrimônio Líquido', 'PATRIMÔNIO LÍQUIDO', ARRAY['24']::text[]),
  (1009, '2', 'Passivo (demais)', 'PASSIVO', ARRAY['21', '22', '23']::text[]),
  (1010, '31', 'Receita Bruta', 'RECEITA', ARRAY['31']::text[]),
  (1011, '32', 'Deduções da Receita Bruta', 'DEDUÇÃO DA RECEITA', ARRAY['32']::text[]),
  (1012, '33', 'Receitas Financeiras', 'RECEITA FINANCEIRA', ARRAY['33']::text[]),
  (1013, '34', 'Outras Receitas Operacionais', 'OUTRAS RECEITAS', ARRAY['34']::text[]),
  (1014, '35', 'Receitas Extraordinárias', 'RECEITA NÃO OPERACIONAL', ARRAY['35']::text[]),
  (1015, '3', 'Receitas (demais)', 'RECEITA', ARRAY['3']::text[]),
  (1016, '41', 'Custos', 'CUSTO', ARRAY['41']::text[]),
  (1017, '42', 'Despesas Operacionais', 'DESPESA', ARRAY['42']::text[]),
  (1018, '45', 'Resultados Extraordinários', 'DESPESA NÃO OPERACIONAL', ARRAY['45']::text[]),
  (1019, '46', 'Tributos sobre o Resultado', 'TRIBUTOS S/ LUCRO', ARRAY['46']::text[]),
  (1020, '4', 'Custos e Despesas (demais)', 'CUSTO / DESPESA', ARRAY['4']::text[])
) AS r(ordem, prefixo, grupo, natureza, grupos)
WHERE v."vigente" = true;
