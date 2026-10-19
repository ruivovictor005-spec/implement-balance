# Implantação de Saldos — Desenho da solução

- **Data:** 19/10/2026
- **Produto:** 1 de 2 (o segundo é o Controle de Fechamento Mensal, fora desta spec)
- **Status:** aguardando revisão de Victor Ruivo

---

## 1. Contexto

A Corp Service vai migrar cerca de **300 empresas-clientes** para dentro da sua base no sistema Domínio. Cada empresa chega com um plano de contas próprio e precisa ser adequada a um **plano de contas padrão único**, usado em todas as empresas e que será atualizado ao longo do tempo.

Essa adequação é feita hoje por uma planilha Excel (`INTEGRAÇÃO INFOBANK`), que:

1. lê o balancete da empresa de origem;
2. traduz cada conta **analítica** para o código reduzido equivalente no plano padrão;
3. gera o **arquivo TXT posicional de importação de saldos do Domínio** (leiaute 19).

A planilha funciona e o cálculo dela está correto. O problema não é o cálculo — é a distribuição:

- O conhecimento acumulado (o de-para de nomes de conta, hoje **1.387 linhas** na aba `Sinônimos`) vive dentro do arquivo. Para usar a versão mais completa, cada pessoa depende de baixar a planilha que a última pessoa salvou — e de que essa pessoa tenha se lembrado de salvá-la e subi-la de volta.
- Com várias pessoas trabalhando na migração ao mesmo tempo, o que uma aprende não chega à outra. Todas reensinam os mesmos nomes.
- Quem tem dificuldade com Excel tem dificuldade com a ferramenta.
- Não existe registro de quem implantou qual empresa, quando, em quanto tempo e com que resultado.

## 2. Objetivo

Um site privado da Corp Service, com entrada pela conta Microsoft corporativa, onde várias pessoas trabalham ao mesmo tempo sobre **uma única base de sinônimos compartilhada**, que se alimenta do trabalho normal de quem a usa.

**Critérios de sucesso:**

1. O resultado é **idêntico ao da planilha** — mesmo código resolvido, mesmo texto de status, mesmo TXT caractere por caractere (verificado por teste automático, ver §10).
2. Um sinônimo ensinado por uma pessoa está disponível para todas as outras **no mesmo instante**, sem ninguém salvar, baixar ou subir arquivo.
3. Quem desliga da empresa perde o acesso automaticamente, sem ninguém precisar agir.
4. Victor consegue, sozinho, ver quem usou, ver o que quebrou e corrigir — sem depender de terceiros.
5. Ao fim da migração existe um relatório de quantas empresas foram implantadas, por quem, quando e em quanto tempo.

## 3. Decisões tomadas

| # | Decisão | Escolha |
|---|---|---|
| 1 | Primeiro produto | Implantação de saldos, com a fundação (acesso, banco, monitoramento) nascendo junto |
| 2 | Plano de contas | **Um padrão único**, versionado. A própria ferramenta é o caminho da padronização |
| 3 | Contas criadas na migração | São **por empresa**, não por grupo nem do padrão. Pertencem à implantação, não ao plano |
| 4 | Alcance dos sinônimos | **Sempre globais** (não existe sinônimo por grupo ou por empresa) |
| 5 | Quem alimenta os sinônimos | Todos criam direto; **alterar ou apagar o que já existe passa por revisão**, com histórico e desfazer |
| 6 | Aprendizado | **Nunca automático.** O padrão de cada ajuste é "vale só para esta importação"; ensinar é um segundo clique, com motivo |
| 7 | Ajuste manual | **Vence sempre.** O sistema avisa quando a natureza não bate, mas não bloqueia |
| 8 | Gerar TXT com pendência ou diferença D–C | **Travado**, com liberação mediante justificativa registrada |
| 9 | Sinônimos novos durante uma implantação em curso | **Reaplicados automaticamente**, só nas linhas pendentes, sem tocar no que a pessoa já decidiu |
| 10 | Cronômetro | Registra **tempo total** (início→conclusão) e **tempo ativo** (descontando inatividade) |
| 11 | Hospedagem | Portátil (Docker + Postgres). Decisão oficial antes de subir dado real de cliente |
| 12 | Stack | Site único em TypeScript (Next.js) + Postgres + Entra ID, com o motor isolado como módulo puro |

## 4. Escopo

### Dentro da v1

- Entrada por conta Microsoft corporativa (Entra ID), com papéis de usuário, revisor e administrador.
- Upload do balancete com **reconhecimento automático do layout** e mapeamento manual de colunas como alternativa.
- Motor de conversão fiel à planilha (§6).
- Base de sinônimos global, com criação direta, revisão de alterações, histórico e desfazer.
- Registro de contas criadas, por implantação.
- Tabelas de regra editáveis pela tela: Normalização e Natureza COSIF **com histórico de alteração** (valor anterior e novo, autor e data); o Plano padrão, além disso, **com versão formal** publicável.
- Implantação como unidade de trabalho, com cronômetro, conclusão e lista de concluídas exportável para Excel.
- Geração e download do TXT do Domínio.
- Monitoramento: acessos, ações, erros e disponibilidade.
- Manual de operação em português.

### Fora da v1 (deliberadamente)

- **Controle de Fechamento Mensal** — é o produto 2, na mesma fundação, com spec própria.
- **Integração por API** com Domínio ou INFOBANK. Aqui é arquivo entra, arquivo sai; nenhum robô clicando em tela.
- Aplicativo de celular.
- Relatórios além da exportação para Excel.
- Edição colaborativa simultânea da *mesma* implantação (cada implantação tem um dono).

## 5. Arquitetura e fronteiras

A regra que governa o desenho: **o que hoje é fórmula vira dado no banco, não código.** Normalização, Natureza COSIF e Plano de Contas são tabelas editáveis. Quando chegar uma versão nova das planilhas, a atualização é importar tabela e ajustar regra — não reprogramar o sistema.

| Peça | O que faz | Do que depende |
|---|---|---|
| `motor` | normaliza nome, resolve natureza, resolve o código, agrega, monta o TXT | **de nada** — função pura, sem banco e sem rede |
| `leitores` | recebe o arquivo, identifica o layout, devolve linhas tipadas | de nada — também puro |
| `dados` | lê e grava no Postgres | banco |
| `telas` | o site | `dados` + `motor` |
| `acesso` | quem é a pessoa, se está ativa, o que pode fazer | Entra ID |
| `observabilidade` | auditoria, captura de erro, métricas | banco |

O `motor` não depender de nada é o que torna possível o teste de equivalência com o Excel (§10) e o que permite, depois, expor a mesma conversão para os robôs UiPath por um endereço HTTP.

**Portabilidade:** tudo empacotado em Docker, com Postgres gerenciado. Mudar de hospedagem (inclusive para a Azure da Corp Service) é mover a caixa, não reescrever o sistema. Nenhuma dependência de recurso exclusivo de um fornecedor.

## 6. O motor de conversão

Reconstruído a partir das fórmulas da planilha atual. Cada etapa abaixo é obrigação de comportamento, não sugestão.

### 6.1 Leitura

Entram **apenas contas analíticas**. Se `tipo_cta` começa com `S` (sintética), a linha é ignorada por completo — não aparece em conferência nem em pendência. Campos usados: `codi_cta`, `nome_cta`, `clas_cta`, `tipo_cta`, `saldoatu` (e `saldoant`, `totdeb`, `totcre` apenas como referência na tela).

### 6.2 Normalização do nome

1. Maiúsculas; espaço especial (U+00A0) trocado por espaço comum.
2. O texto é envolvido em espaços (` NOME `), para que trechos como ` DE ` casem palavra inteira.
3. **Etapa 1** — percorre a tabela de Normalização (acentos e pontuação) aplicando cada substituição **em cadeia, na ordem da tabela**, uma sobre o resultado da anterior.
4. `TRIM`, e o texto é envolvido em espaços novamente.
5. **Etapa 2** — mesma mecânica, com o dicionário de palavras (` DE `→nada, ` LTDA `→nada, ` SOBRE `→` S `, etc.).
6. `TRIM` final.

**A ordem das linhas da tabela é parte da regra.** O campo `ordem` é explícito, visível e editável; nada reordena a tabela implicitamente.

A planilha percorre 199 posições fixas em cada etapa, das quais hoje **50 estão preenchidas na etapa 1** (linhas 2 a 52) **e 132 na etapa 2** (linhas 2 a 133). Posição vazia é inócua (substitui nada por nada), então percorrer a tabela real na ordem produz exatamente o mesmo resultado.

**O valor de substituição pode ser só espaços, e isso é significativo** — 18 regras da etapa 1 e 17 da etapa 2 substituem por um texto feito apenas de espaços (`.` → ` `, por exemplo, que separa em vez de colar). Outras 3 substituem por nada, apagando o trecho. Nenhuma regra pode ter `de` ou `para` com espaços removidos: é o espaço que faz o trecho casar palavra inteira.

Linha com `de` vazio é inerte (no Excel, `SUBSTITUTE` com texto antigo vazio devolve o texto intacto) e não entra na tabela.

### 6.3 Natureza e grupos permitidos

Procura na tabela Natureza COSIF a **primeira linha, na ordem da tabela**, cujo prefixo case com o início da classificação de origem (comparando `LEFT(TRIM(classificação), tamanho_do_prefixo)`).

A tabela está ordenada **do mais específico para o mais genérico** (`5.9.9.99` antes de `1.1`, que vem antes de `1`; `8.1.9.99` antes de `8.1.9`). É essa ordem que define a precedência, e ela é preservada pelo campo `ordem`.

Dessa linha saem:

- a **natureza** (ex.: `ATIVO CIRCULANTE`, `DESPESA ADMINISTRATIVA`);
- os **grupos permitidos no Domínio** (ex.: `11|12`), ou o veto **`NÃO MIGRAR`** (compensação e totalizador P.L.A., que importados duplicariam saldo).

**Conta candidata é válida** quando: é analítica (`tipo = A`) **e** o primeiro ou os dois primeiros caracteres da sua classificação estão entre os grupos permitidos.

### 6.4 Resolução do código, nesta ordem

1. **Ajuste manual** preenchido → usa, sem discussão.
2. **Sinônimo** (pela chave normalizada) → aceito somente se a conta apontada for válida (§6.3). Se não for, o sinônimo é descartado.
3. **Nome idêntico**: primeira conta válida cuja descrição normalizada seja igual ao nome normalizado.
4. **Nome cortado**: somente se o nome normalizado tiver **25 caracteres ou mais**, primeira conta válida cuja descrição normalizada *comece* com ele. Abaixo de 25 não tenta.
5. Nada disso → `N/A` (pendência).

Quando duas contas do plano normalizam para o mesmo nome, vale a primeira e a linha é marcada como repetida (ver §6.5) — comportamento idêntico ao da planilha.

### 6.5 Textos de status

Os 12 textos abaixo são reproduzidos literalmente, porque é por eles que a equipe já sabe o que fazer:

1. `Não migrar - <natureza>`
2. `NÃO ENCONTRADO - natureza não identificada pela classificação (col. C)`
3. `Código da coluna L não existe no plano`
4. `Manual (coluna L)`
5. `Código da coluna L é de outra natureza - conferir`
6. `NÃO ENCONTRADO - sinônimo aponta p/ conta de outra natureza; digite na coluna L`
7. `NÃO ENCONTRADO - digite o código na coluna L`
8. `Pela aba Sinônimos`
9. `Sinônimo ignorado (outra natureza) - conferir`
10. `Nome repetido no plano - conferir`
11. `Nome igual ao plano`
12. `Nome cortado - conferir`

Cada linha guarda também a **origem da resolução** em campo próprio (`manual`, `sinonimo`, `nome_igual`, `nome_cortado`, `nao_migrar`, `nao_encontrado`), para filtro e relatório.

### 6.6 Agregação

1. Agrupa pelas contas resolvidas (código numérico).
2. Soma o saldo atual por código, arredondando em 2 casas.
3. **Descarta saldo zero.**
4. Ordena pela classificação da conta no plano (texto, crescente).
5. Define a natureza do lançamento pelo **sinal**: saldo **negativo → débito**; saldo **positivo → crédito**. Valor é o módulo.
6. Complemento do histórico: ` | ` + descrição da conta, sem quebra de linha (CR e LF trocados por espaço).

### 6.7 Arquivo TXT — leiaute 19 posicional

Campos preenchidos pela pessoa: data do saldo, CNPJ, código da empresa no Domínio, tipo do lote, código do histórico (700 por padrão) e incluir-cabeçalho (S/N).

| Registro | Composição | Tamanho |
|---|---|---|
| `01` (opcional) | `01` + empresa (7, zeros à esquerda) + CNPJ (14, só dígitos, espaços à direita) + data `dd/mm/aaaa` + data `dd/mm/aaaa` + `N` + `05` + `00000` + `1` + `17` | 54 |
| `02` (lote) | `02` + `0000001` + tipo do lote + data `dd/mm/aaaa` + 30 espaços + 100 espaços | 150 |
| `03` (partida) | `03` + sequência (7, **começando em 2**) + conta débito (7) + conta crédito (7) + valor × 100 (15) + código do histórico (7) + complemento (512) + `0000000` + 100 espaços | 664 |
| `99` | `99` + 98 caracteres `9` | 100 |

Conta ausente (débito ou crédito) vai como `0000000`. O complemento é cortado ou completado com espaços até 512 posições.

### 6.8 Painel de conferência

Contas analíticas, contas mapeadas, contas pendentes, saldo das pendentes, total débito, total crédito e diferença D–C (arredondada em 2 casas). O semáforo **PRONTO PARA IMPORTAR** acende somente com CNPJ e código da empresa preenchidos, zero pendências e diferença zero. Caso contrário: `ATENÇÃO: revisar pendências / diferença`.

### 6.9 Sem os limites da planilha

As fórmulas atuais operam em faixas fixas (balancete até a linha 2000, plano até 3000). O sistema não tem esse limite: o tamanho do balancete e do plano é o que o arquivo trouxer.

## 7. Leitura de arquivos

- **Layout conhecido:** o do balancete presente na planilha atual (campos `codi_cta`, `nome_cta`, `clas_cta`, `tipo_cta`, `saldoant`, `totdeb`, `totcre`, `saldoatu`), reconhecido automaticamente pelos nomes de coluna.
- **Resposta da tela:** o site diz o que entendeu — *"Reconheci balancete Domínio — 487 linhas, 312 analíticas, 175 sintéticas ignoradas"*.
- **Layout desconhecido:** abre o mapeamento manual de colunas, onde a pessoa aponta qual coluna é qual. É a rede de segurança, não o caminho normal.
- **Extensões aceitas:** `.xlsx`, `.xlsm`, `.csv` e `.txt` delimitado. O formato antigo `.xls` **não** é lido: a biblioteca que o lê tem vulnerabilidades conhecidas sem correção publicada, e aqui ela receberia arquivo de qualquer pessoa. Quem tiver `.xls` recebe a instrução de abrir no Excel e salvar como `.xlsx`.
- **Acrescentar um layout novo** é cadastro de perfil de leitura, não programação.

> **Dependência externa:** Victor fornecerá amostras reais dos balancetes Domínio e INFOBANK para confirmar e estender o reconhecimento. Não bloqueia o início: a v1 nasce com o layout já conhecido.

## 8. Modelo de dados

Entidades principais (Postgres). Campos de auditoria (`criado_por`, `criado_em`) omitidos quando óbvios.

**`usuario`** — `oid_entra` (único, vem da Microsoft), `email`, `nome`, `papel` (`usuario` | `revisor` | `admin`), `ativo`, `ultimo_acesso_em`. A identidade vem do Entra ID; **o papel é local ao site**.

**`plano_versao`** — `nome`, `descricao`, `vigente` (apenas uma por vez), `criada_por`, `criada_em`.

**`plano_conta`** — `plano_versao_id`, `codigo_reduzido`, `classificacao`, `descricao`, `tipo` (`A` | `S`), `descricao_normalizada`. Único por (`plano_versao_id`, `codigo_reduzido`).

**`regra_normalizacao`** — `etapa` (1 | 2), `ordem`, `de`, `para`, `ativo`.

**`regra_natureza`** — `ordem`, `prefixo_classificacao`, `grupo_cosif`, `natureza`, `grupos_dominio`, `nao_migrar`, `observacao`.

**`sinonimo`** — `nome_original`, `chave_normalizada`, `codigo_reduzido`, `plano_versao_id`, `fora_do_padrao`, `motivo`, `status` (`ativo` | `arquivado`). Único por (`chave_normalizada`, `plano_versao_id`) entre os ativos.

**`sinonimo_evento`** (só cresce, nunca é alterado) — `sinonimo_id`, `tipo`, `codigo_de`, `codigo_para`, `motivo`, `autor_id`, `criado_em`. É a base do histórico e do desfazer.

**`alteracao_sinonimo`** — `sinonimo_id`, `codigo_proposto`, `motivo`, `solicitado_por`, `status` (`pendente` | `aprovada` | `rejeitada`), `revisado_por`, `observacao_revisor`.

**`implantacao`** — `usuario_id`, `empresa_codigo_dominio`, `empresa_cnpj`, `empresa_nome`, `data_saldo`, `tipo_lote`, `codigo_historico`, `incluir_cabecalho`, `plano_versao_id`, `layout_detectado`, `arquivo_origem`, `status` (`em_andamento` | `concluida` | `descartada`), `iniciada_em`, `concluida_em`, `tempo_ativo_segundos`, `qtd_analiticas`, `qtd_mapeadas`, `qtd_pendentes`, `saldo_pendente`, `total_debito`, `total_credito`, `diferenca`, `liberacao_motivo`, `txt_gerado`, `txt_hash`.

**`implantacao_linha`** — `implantacao_id`, `ordem`, os campos de origem (`codi_cta`, `nome_cta`, `clas_cta`, `tipo_cta`, saldos), `nome_normalizado`, `natureza`, `grupos_permitidos`, `ajuste_manual`, `codigo_resolvido`, `origem_resolucao`, `status_texto`.

**`conta_criada`** — `implantacao_id`, `codigo_reduzido`, `descricao`, `classificacao`. Vale apenas dentro daquela implantação.

**`auditoria`** — `usuario_id`, `acao`, `entidade`, `entidade_id`, `detalhes` (JSON), `ip`, `criado_em`.

### Regras de integridade

1. **Uma implantação em andamento por pessoa.** "Iniciar nova implantação" fecha a mesa anterior: a anterior vira `descartada` (sai da vista, permanece no histórico), ou `concluida` se a pessoa concluir.
2. O `codigo_reduzido` de um sinônimo deve existir no `plano_conta` da mesma versão de plano **ou** o sinônimo é marcado `fora_do_padrao` — nunca fica inconsistente em silêncio.
3. O de-para aponta para uma **versão** de plano. Ao publicar versão nova, o sistema lista os sinônimos órfãos (código que deixou de existir) para revalidação.
4. `tempo_ativo_segundos` é **derivado** da auditoria da implantação (somatório dos intervalos com atividade), não de contador no navegador.
5. Arquivo de origem e TXT gerado são guardados, para reproduzir qualquer implantação depois.

## 9. Telas

1. **Entrar** — um botão: "Entrar com a conta Microsoft". Sem cadastro e sem senha nova.
2. **Minha mesa** — a implantação em andamento com o cronômetro, ou o botão "Iniciar nova implantação". Atalhos para Sinônimos, Implantações concluídas e, para revisores, as tabelas de regra.
3. **Implantação** (tela principal, uma página só):
   - dados da empresa (código, CNPJ com validação de 14 dígitos, data, tipo do lote, histórico, incluir cabeçalho);
   - área de arrastar o arquivo, com a resposta do que foi reconhecido;
   - painel de conferência fixo no alto, com o semáforo;
   - tabela de linhas, pendências no topo, filtro por status; em cada pendência, busca de conta por nome ou código mostrando classificação e natureza, com os botões **"usar só aqui"** e **"ensinar para todos"** (este pede motivo);
   - **"Registrar conta criada"** (código reduzido, descrição, classificação), válida para aquela implantação;
   - **aviso de aprendizado alheio**: quando alguém ensina um sinônimo enquanto a implantação está aberta, as linhas **pendentes** são reresolvidas sozinhas e aparece um aviso discreto (*"2 pendências resolvidas pelo que a Karen acabou de ensinar"*). O que a pessoa já decidiu à mão não é tocado, a lista não se reordena durante a digitação e a posição da tela é preservada;
   - **Gerar TXT** e **Concluir** — travados com pendência ou diferença, liberáveis com justificativa.
4. **Sinônimos** — busca; filtros "criados por mim", "apontam para conta fora do padrão", "alterados nos últimos dias"; criação; pedido de alteração; fila de revisão; histórico com desfazer. Alteração concorrente avisa *"alguém alterou isso há 3 minutos"* em vez de sobrescrever calado.
5. **Implantações concluídas** — empresa, data, quem fez, tempo total, tempo ativo, se houve liberação justificada. Exporta Excel.
6. **Tabelas de regra** (revisor) — Normalização, Natureza COSIF e Plano padrão, com importação de versão nova e relatório do que ficou órfão.
7. **Operação** (administrador) — acessos, ações e erros.

Idioma: português, com os nomes de campo da planilha. Público: desktop.

## 10. Garantia de equivalência com a planilha

Não é promessa, é teste automático que roda a cada mudança:

- **Massa real**, extraída da planilha atual (números conferidos célula por célula): o balancete com **113 linhas, das quais 27 analíticas** e 86 sintéticas ignoradas; os **1.387 sinônimos**; o plano padrão com **711 contas** (529 analíticas, 182 sintéticas); **182 regras de normalização** (50 na etapa 1, 132 na etapa 2); **25 regras de natureza**.
- **Resultado esperado**, também da planilha: 27 contas analíticas mapeadas, **22 lançamentos** (cinco contas caem fora por saldo zero), R$ 22.003.884,50 em débito e em crédito, diferença zero, e um TXT de **24 linhas** — 1 registro `02`, 22 registros `03` com sequência de `0000002` a `0000023`, e 1 registro `99`.
- **Asserções:** mesmo código resolvido por linha, mesmo texto de status por linha, mesmas linhas agregadas, e **TXT idêntico caractere por caractere**.
- **Testes de unidade** por etapa: normalização (as 199 regras em cadeia), precedência da natureza (específico antes de genérico), cada um dos 12 status, o limite dos 25 caracteres, descarte de saldo zero, sinal → débito/crédito, e as larguras de cada campo do leiaute.

Se alguém mexer numa regra e o resultado divergir, o teste falha antes de chegar no cliente.

## 11. Acesso

- **Registro de aplicativo no Entra ID**, de um único tenant, com **uma permissão delegada: `User.Read`** (ler o próprio perfil). Nenhum acesso a e-mail, arquivos ou Teams.
- **Papéis** no site: usuário, revisor, administrador. Victor é o primeiro administrador.
- Opcional, se a TI aceitar: restringir a entrada a um grupo do Entra ID.
- **Desligamento automático:** conta desativada pelo RH deixa de entrar imediatamente, sem ação de ninguém.
- **Entregável:** o texto pronto do pedido à TI, explicando o que é, por que é seguro e o que precisa ser clicado.
- **Plano B, se vetarem:** lista de e-mails autorizados com código de acesso por pessoa. Funciona, mas **perde o desligamento automático** — exige remover à mão quem sai da empresa. É pior, e está registrado como pior.

> **Dependência externa:** verificar se o tenant permite que um usuário comum registre aplicativo (portal do Entra ID → Registros de aplicativo → Novo registro). O desenho não depende da resposta: o acesso é uma peça trocável.

## 12. Monitoramento e operação

Três perguntas, cada uma com lugar próprio:

1. **Quem está usando?** Tela de acessos: pessoa, horário, origem, ações.
2. **O que quebrou?** Captura automática de erro com alerta por e-mail, e tela de **Erros** dentro do site (hora, pessoa, tela, arquivo em uso). Sem precisar entrar em ferramenta de programador no dia a dia.
3. **Está no ar?** Monitor externo de disponibilidade, com aviso em caso de queda.

Cada implantação guarda **o arquivo que entrou e o TXT que saiu**, o que permite reproduzir exatamente qualquer problema relatado.

**Manual de operação** (entregável do projeto, em português, para quem não é programador): subir versão nova; voltar atrás; ler um erro e o que fazer nos cinco casos mais prováveis; restaurar backup; promover revisor; conferir o custo mensal.

## 13. LGPD e retenção

- Dado pessoal no sistema: **nome e e-mail corporativo** de quem usa. O restante é dado de pessoa jurídica (CNPJ, balancete).
- Entrada somente por SSO; criptografia em trânsito e no banco em repouso; backup diário; auditoria de quem viu o quê.
- **Retenção dos arquivos de balancete: 12 meses**, configurável, com descarte automático. Quem bate o martelo sobre o prazo é a Corp Service.
- Quando a hospedagem for decidida, entra na documentação uma página com: onde o dado mora, qual o fornecedor, o que o contrato dele garante e quem tem acesso — é o que a TI vai pedir.

## 14. Hospedagem

Construção portátil (Docker + Postgres gerenciado). Desenvolvimento e testes em nuvem gerenciada de baixo custo, com dados de exemplo. **A decisão oficial da Corp Service entra antes de subir balancete real de cliente**, e trocar de casa — inclusive para a Azure da empresa — não significa refazer o sistema.

Custo estimado do piloto: entre zero e R$ 150 por mês.

## 15. Riscos

| Risco | Mitigação |
|---|---|
| Plano padrão muda e sinônimos passam a apontar para conta inexistente | De-para preso a uma versão de plano + relatório de órfãos na publicação de versão nova |
| Sinônimo ensinado apontando para conta criada só numa empresa | Aviso no momento de ensinar, marcação `fora_do_padrao` e aparição na revisão |
| TI vetar o registro no Entra ID | Acesso é peça trocável; plano B documentado, com a perda explicitada |
| Alguém gerar TXT com pendência ou diferença | Trava com liberação justificada e registrada na implantação |
| Duas pessoas alterando o mesmo sinônimo | Detecção de alteração concorrente, revisão para alterações e desfazer |
| Balancete com layout inesperado | Mapeamento manual de colunas |
| Divergência silenciosa em relação à planilha | Teste de equivalência com massa real, rodando a cada mudança |

## 16. Dependências externas (não bloqueiam o início)

1. Amostras reais de balancete Domínio e INFOBANK, para confirmar e estender o reconhecimento de layout.
2. A versão mais recente das planilhas, para conferir regras que mudaram desde a cópia analisada (em especial o registro de contas criadas).
3. Verificação de permissão de registro de aplicativo no Entra ID.
4. Decisão da Corp Service sobre hospedagem, antes do primeiro dado real.
