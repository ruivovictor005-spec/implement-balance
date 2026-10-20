-- Executado só na primeira inicialização do Postgres (docker-entrypoint-initdb.d).
-- O banco "implantacao" já é criado pela variável POSTGRES_DB; aqui criamos o de testes.
CREATE DATABASE implantacao_teste;
