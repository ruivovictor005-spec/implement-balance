-- "Salvar e continuar depois": marca a implantação que a pessoa guardou DE PROPÓSITO para retomar.
-- Nulo significa que ela só começou e saiu sem decidir — a mesa mostra isso como "não salva".
-- As que já existiam ficam nulas: nada é perdido, elas aparecem como não salvas até a pessoa
-- salvar ou excluir.
ALTER TABLE "implantacao" ADD COLUMN "guardada_em" timestamp with time zone;
