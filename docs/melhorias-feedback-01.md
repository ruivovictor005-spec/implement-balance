# Feedback do 1º teste (Victor) — melhorias a fazer

Registro das considerações do parceiro após o primeiro uso real, para retomar nas próximas sessões.
Nada aqui está feito ainda, salvo onde indicado. Prioridade: **A = alta, B = média**.

## 1. Ver o balancete do cliente enquanto identifica as contas (A)
Ao identificar uma conta pendente, a pessoa precisa enxergar **de que grupo a conta é** (ativo,
passivo, PL, resultado). Hoje a linha pendente mostra só o nome e o status. Falta mostrar a
**classificação de origem** e a **natureza** da própria linha, e, idealmente, uma visão do balancete
de origem ao lado (as abas "Balancete importado" / "Prévia Balancete" das planilhas).
- Mínimo: exibir `clas_cta` + natureza em cada linha (pendente e resolvida).
- Ideal: painel/aba com o balancete de origem navegável durante o de-para.

## 2. Aba de resumo do de-para (A)
Uma visão de resumo mostrando: o que já foi identificado, o que não foi, e **onde** as pendentes
estão. E o mapeamento "conta era **1** → passa a ser **6**" (origem → código Domínio), como a planilha
demonstrava. Hoje isso está diluído na tabela de linhas.

## 3. Alterar a classificação / trocar o código de uma conta JÁ resolvida (A) — bug de uso
A busca "usar só aqui" só aparece nas linhas **pendentes**. Uma conta que o motor já resolveu (mesmo
que para uma conta de **natureza diferente**, com o aviso "Código da coluna L é de outra natureza —
conferir") **não tem como ser alterada pela tela**. O parceiro classificou algumas erradas de
propósito: o sistema avisou certo, mas não deixou corrigir.
- Fazer: permitir a busca/override em **todas** as linhas, não só nas pendentes (chamar
  `definirAjusteManual` em qualquer linha). Mostrar claramente o aviso de natureza divergente e
  permitir confirmar mesmo assim ou escolher outra conta.

## 4. Prévia do balancete no modelo Domínio (A)
As planilhas tinham uma aba com a **prévia de como ficaria o balancete no Domínio**. Falta essa
visão (resumo do resultado antes de gerar o TXT).

## 5. Consultar o plano de contas padrão, com o grupo visível (A)
A pessoa precisa **navegar/buscar o plano de contas padrão** para achar a conta certa. Ex.: digita
"contas a pagar" e podem aparecer opções de grupos diferentes (PL, resultado, adiantamento). Hoje a
busca mostra `class. X · natureza`, mas:
- Precisa ficar **mais claro o grupo** (ativo/passivo/PL/resultado) de cada candidata.
- Precisa poder **abrir o plano inteiro** para navegar, não só buscar por texto.
- Ver os dois lado a lado (plano de contas + balancete em de-para).

## 6. Análise visual lado a lado (A)
Poder olhar o **balancete** e o **plano de contas** juntos, visualmente, para fazer o de-para com
segurança.

## 7. Resumo comparando balancete antigo × balancete Domínio (B)
Uma visão final comparando o balancete de origem com o resultado no modelo Domínio.

## 8. Pendências: mostrar todas de uma vez (B)
Não obrigar a filtrar por tipo de pendência — mostrar **todas as pendências juntas** por padrão.
(Hoje já aparecem primeiro, mas há um filtro; revisar para não exigir filtragem.)

## 9. Dashboard / controle de demandas (para supervisores) (A)
Falta um **painel de acompanhamento** (dentro do próprio sistema, provavelmente restrito a
supervisores/revisores): quanto tempo a equipe leva, tempo por usuário, quantas cada um já fez, etc.
Os dados existem (auditoria + tempo ativo + concluídas), mas **não há tela/menu para isso**.
- Fazer: uma tela de dashboard agregando por pessoa e período, acessível por um botão visível.

## 10. Navegação intuitiva / descoberta (A)
As telas existem (`/sinonimos`, `/concluidas`) mas **não há menu** para chegar nelas — a pessoa não
descobre. Falta um **cabeçalho/menu** visível em todas as telas. Tudo precisa ser muito intuitivo.

## 11. Layout de balancete Domínio não reconhecido (B) — investigar depois
Um balancete exportado do **sistema Domínio** (fora de ordem / outro layout) **não foi reconhecido**.
Investigar a detecção de layout e cadastrar o(s) perfil(is) reais depois.

---

## Observação de arquitetura
Boa parte disso é **UI sobre dados que já existem** (classificação, natureza, auditoria, tempos,
plano de contas). O motor e o banco não precisam mudar para 1, 2, 4, 7, 8, 9, 10. O item 3 é um ajuste
de fluxo (permitir override em qualquer linha). O item 11 é detecção de layout (leitores). Sugestão de
ordem para a próxima sessão: **3 (corrigir o override) → 1/5 (grupo visível + navegar plano) → 10
(menu) → 2/4/7 (resumos/prévia) → 9 (dashboard) → 11 (layout)**.
