-- Qual plano de contas o balancete RECEBIDO usa, indicado pela pessoa: 'cosif' ou 'dominio'.
-- Nulo significa "deduza pelos grupos da classificação", que é o padrão e continua valendo.
--
-- Existe porque é essa escolha que decide qual tabela de natureza vale para a origem, e deduzir
-- errado troca a natureza de quase todas as contas: no COSIF o grupo 4 é passivo, no Domínio é
-- custo e despesa, e o grupo 3 do COSIF é "compensação / não migrar", que faria a receita inteira
-- desaparecer do TXT em silêncio. Quem recebeu o arquivo sabe de onde ele veio; o sistema deduz.
ALTER TABLE "implantacao" ADD COLUMN "plano_origem" text;
