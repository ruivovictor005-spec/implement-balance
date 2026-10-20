-- sinonimo_evento só cresce: barra UPDATE e DELETE no nível do banco, reforçando que é a base do
-- histórico e do desfazer (spec §8, plano Task 8 Step 4).
CREATE OR REPLACE FUNCTION barrar_alteracao_sinonimo_evento() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'sinonimo_evento é imutável: % não é permitido', TG_OP;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER sinonimo_evento_imutavel
BEFORE UPDATE OR DELETE ON sinonimo_evento
FOR EACH ROW EXECUTE FUNCTION barrar_alteracao_sinonimo_evento();
