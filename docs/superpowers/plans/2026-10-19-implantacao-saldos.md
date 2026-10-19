# Implantação de Saldos — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir a planilha `INTEGRAÇÃO INFOBANK` por um site privado onde várias pessoas convertem balancetes de origem em arquivo de importação de saldos do Domínio, alimentando ao mesmo tempo uma única base de sinônimos.

**Architecture:** Um aplicativo Next.js (App Router) com Postgres. O núcleo de conversão vive em `src/motor/**` e `src/leitores/**` como funções puras — sem banco, sem rede, sem Next — o que permite prová-lo contra a planilha atual com massa real. O resto (telas, ações de servidor, acesso, auditoria) é casca em volta desse núcleo. As regras de negócio (normalização, natureza, plano de contas) são dados no banco, nunca código.

**Tech Stack:** TypeScript, Next.js 15 (App Router) + React 19, Postgres 16, Drizzle ORM, Auth.js v5 com provider `microsoft-entra-id`, Vitest + Testing Library, SheetJS (`xlsx`) para ler e escrever planilha, Docker.

**Spec:** `docs/superpowers/specs/2026-10-19-implantacao-saldos-design.md`

## Global Constraints

- Node ≥ 22.11 (LTS); Postgres ≥ 16; TypeScript em modo `strict`.
- Versões exatas fixadas no `package.json` no momento da instalação; nenhuma dependência `alpha`/`rc`. Exceção única: `next-auth@5`, que é a linha atual para App Router.
- `src/motor/**` e `src/leitores/**` **não podem importar** banco, rede, Next, `process.env` ou qualquer módulo de I/O. Regra verificada por teste (Task 2, Step 6).
- Toda a interface em português, usando os termos da planilha (`código reduzido`, `classificação`, `balancete`, `de-para`, `sinônimo`, `lote`, `histórico`, `complemento`).
- Os **12 textos de status** da §6.5 da spec são reproduzidos **literalmente**, incluindo acentuação, maiúsculas e o hífen simples ` - `. Nenhum texto novo é inventado.
- **Ajuste manual sempre vence** sobre sinônimo, nome igual e nome cortado.
- Entram **apenas contas analíticas** (`tipo_cta` que não começa com `S`).
- **Sinônimos são globais.** Não existe sinônimo por empresa nem por grupo.
- Larguras dos registros do leiaute 19: `01` = 54, `02` = 150, `03` = 664, `99` = 100 caracteres.
- **Fixtures não contêm CNPJ, código de empresa nem nome de empresa reais.** Os registros `02`, `03` e `99` da planilha não carregam esses dados; o registro `01` é testado com valores fictícios (CNPJ `11.222.333/0001-81`, empresa `9999999`).
- Limiar de inatividade para o **tempo ativo**: **10 minutos** sem nenhuma ação registrada.
- Mensagens de commit em português, no imperativo, uma por task.

## Review Focus

Classes de entrada que a spec implica e que nenhuma task exerceria por conta própria. Cada linha tem a task que a cobre.

1. **Saldo em formato brasileiro** (`"1.234,56"`, `"1.234,56-"`, `"(1.234,56)"`) ou número guardado como texto — erro aqui gera TXT errado em silêncio. → Task 7, Step 5.
2. **Cabeçalho que não está na primeira linha** (balancete exportado com título, CNPJ e período acima da tabela) — o detector não pode assumir linha 1. → Task 7, Step 3.
3. **Descrição de conta maior que 512 caracteres**, ou com `CHAR(160)`, `|`, CR ou LF — o complemento tem que ser cortado sem estourar as 664 posições do registro `03`. → Task 6, Step 3.
4. **Valor que arredonda para zero** (`0,004`) e saldo exatamente zero — não pode gerar partida. → Task 5, Step 5.
5. **Duas pessoas ensinando o mesmo nome normalizado ao mesmo tempo** — a violação de unicidade tem que virar mensagem legível, não erro 500. → Task 12, Step 7.

## File Structure

| Arquivo | Responsabilidade |
|---|---|
| `scripts/extrair-fixtures.ts` | Lê o `.xlsm` original e escreve as fixtures JSON. Roda uma vez por versão da planilha |
| `src/motor/tipos.ts` | Tipos do núcleo: conta, regra, linha, sinônimo, lançamento, resultado |
| `src/motor/normalizar.ts` | `normalizarNome` — as duas etapas de substituição em cadeia |
| `src/motor/natureza.ts` | `resolverNatureza` — prefixo da classificação → natureza e grupos permitidos |
| `src/motor/resolver.ts` | `criarIndicePlano`, `resolverConta` — a cascata de resolução e os 12 status |
| `src/motor/agregar.ts` | `agregarLancamentos` — agrupa, descarta zero, ordena, define D/C |
| `src/motor/leiaute-dominio.ts` | `gerarRegistro01/02/03/99`, `gerarTxt` — o leiaute posicional |
| `src/motor/converter.ts` | `converter` — orquestra o núcleo inteiro e devolve linhas, lançamentos, TXT e painel |
| `src/leitores/perfis.ts` | Perfis de leitura (apelidos de coluna por campo) |
| `src/leitores/ler-arquivo.ts` | `lerArquivo` — bytes → matriz de células |
| `src/leitores/detectar.ts` | `detectarPerfil`, `extrairLinhas` — matriz → linhas de balancete |
| `src/dados/schema.ts` | Schema Drizzle de todas as tabelas da §8 da spec |
| `src/dados/*.ts` | Um módulo de acesso por agregado: `plano`, `regras`, `sinonimos`, `implantacoes`, `usuarios`, `auditoria` |
| `src/acesso/auth.ts` | Configuração do Auth.js e provider Entra ID |
| `src/acesso/papeis.ts` | `podeRevisar`, `podeAdministrar`, `exigirPapel` |
| `src/observabilidade/*.ts` | `auditar`, `registrarErro` |
| `src/app/**` | Telas e ações de servidor |
| `fixtures/*.json` | Massa real extraída da planilha |
| `docs/operacao.md` | Manual de operação para quem não é programador |
| `docs/pedido-ti-entra-id.md` | Texto pronto do pedido à TI |

---

### Task 1: Projeto e fixtures da planilha

**Files:**
- Create: `package.json`, `tsconfig.json`, `vitest.config.ts`
- Create: `src/motor/tipos.ts`
- Create: `scripts/extrair-fixtures.ts`
- Create: `fixtures/plano.json`, `fixtures/sinonimos.json`, `fixtures/normalizacao.json`, `fixtures/natureza.json`, `fixtures/balancete.json`, `fixtures/txt-esperado.json`
- Test: `tests/fixtures/integridade.test.ts`

**Interfaces:**
- Consumes: a planilha original em `C:\Users\Pichau\OneDrive\Desktop\Projetos de trabalho\INTEGRAÇÃO INFOBANK - 27.09.xlsm` (caminho passado por argumento, não fixado no código).
- Produces: os tipos abaixo, em `src/motor/tipos.ts`, usados por todas as tasks seguintes.

```ts
export type Tipo = 'A' | 'S';
export type ContaPlano = { codigoReduzido: string; classificacao: string; descricao: string; tipo: Tipo; descricaoNormalizada: string };
export type RegraNormalizacao = { etapa: 1 | 2; ordem: number; de: string; para: string };
export type RegraNatureza = { ordem: number; prefixo: string; grupoCosif: string; natureza: string; gruposDominio: string[]; naoMigrar: boolean };
export type SinonimoFixture = { nomeOriginal: string; chaveNormalizada: string; codigoReduzido: string };
export type LinhaBalancete = { codiCta: string; nomeCta: string; clasCta: string; tipoCta: string; saldoAnterior: number; totalDebito: number; totalCredito: number; saldoAtual: number };
```

A fixture do balancete guarda também, por linha, os valores que a planilha calculou — `nomeNormalizadoEsperado` (coluna K), `naturezaEsperada` (Q), `gruposEsperados` (R), `codigoEsperado` (M) e `statusEsperado` (P) — que são o gabarito das Tasks 2, 3, 4 e 6.

- [ ] **Step 1: Criar o projeto**

`npm init`, `typescript`, `vitest`, `xlsx`, `tsx`. `tsconfig.json` com `strict: true`, `module: nodenext`. Script `test` apontando para `vitest run`.

- [ ] **Step 2: Escrever o teste de integridade das fixtures (vai falhar)**

```ts
// tests/fixtures/integridade.test.ts
it('plano tem 711 contas, 529 analíticas e 182 sintéticas', ...)
it('sinônimos tem 1387 linhas, todas com chave e código', ...)
it('normalização tem 78 regras na etapa 1 e 104 na etapa 2, com ordem sem buraco', ...)
it('natureza tem 25 regras, com NÃO MIGRAR em 5.9.9.99, 3 e 9', ...)
it('balancete tem 113 linhas, 27 analíticas e 86 sintéticas', ...)
it('TXT esperado tem 24 linhas: 1 registro 02, 22 registros 03, 1 registro 99', ...)
it('registros do TXT têm 150, 664 e 100 caracteres', ...)
it('sequência dos registros 03 vai de 0000002 a 0000023 sem pular', ...)
it('nenhuma fixture contém CNPJ ou código de empresa', ...)  // regex de 14 dígitos e do código 20354
```

- [ ] **Step 3: Rodar e confirmar que falha**

Run: `npm test -- tests/fixtures` · Expected: FAIL, fixtures não existem.

- [ ] **Step 4: Escrever `scripts/extrair-fixtures.ts`**

Lê as abas `Plano Domínio`, `Balancete importado`, `Importação` (coluna H, linhas 12 a 35), `Natureza COSIF`, `Normalização` e `Sinônimos`, usando os **valores em cache** das fórmulas. Grava os seis JSON formatados com 2 espaços. Os campos da empresa (CNPJ, código, nome) são descartados na extração.

- [ ] **Step 5: Gerar as fixtures e rodar o teste**

Run: `npx tsx scripts/extrair-fixtures.ts "<caminho do .xlsm>"` e `npm test -- tests/fixtures` · Expected: PASS nos 9 testes.

- [ ] **Step 6: Commit**

```bash
git add package.json tsconfig.json vitest.config.ts src/motor/tipos.ts scripts/ fixtures/ tests/
git commit -m "Extrai da planilha a massa real de teste"
```

---

### Task 2: Normalização de nomes

**Files:**
- Create: `src/motor/normalizar.ts`
- Test: `tests/motor/normalizar.test.ts`, `tests/motor/pureza.test.ts`

**Interfaces:**
- Consumes: `RegraNormalizacao`, `ContaPlano`, `SinonimoFixture` (Task 1).
- Produces: `normalizarNome(nome: string, regras: RegraNormalizacao[]): string`.

A planilha usa esta mesma função em três lugares (descrição do plano, nome do balancete e chave do de-para), o que dá **2.125 casos reais de gabarito**.

- [ ] **Step 1: Escrever os testes (vão falhar)**

```ts
it('maiúsculas, espaço não separável e espaços das pontas', () =>
  expect(normalizarNome(' caixa\u00A0geral ', regras)).toBe('CAIXA GERAL'));
it('etapa 1 remove acento', () => expect(normalizarNome('Disponível', regras)).toBe('DISPONIVEL'));
it('etapa 2 remove palavra inteira', () => expect(normalizarNome('EMPRESA LTDA', regras)).toBe('EMPRESA'));
it('etapa 2 não corta palavra parcial', () => expect(normalizarNome('DEPOSITOS', regras)).toBe('DEPOSITOS'));
it.each(sinonimos)('sinônimo %#: $nomeOriginal', ({ nomeOriginal, chaveNormalizada }) =>
  expect(normalizarNome(nomeOriginal, regras)).toBe(chaveNormalizada));      // 1387 casos
it.each(plano)('conta do plano %#', ({ descricao, descricaoNormalizada }) =>
  expect(normalizarNome(descricao, regras)).toBe(descricaoNormalizada));      // 711 casos
it.each(analiticas)('linha do balancete %#', ({ nomeCta, nomeNormalizadoEsperado }) =>
  expect(normalizarNome(nomeCta, regras)).toBe(nomeNormalizadoEsperado));     // 27 casos
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npm test -- tests/motor/normalizar` · Expected: FAIL, `normalizarNome` não existe.

- [ ] **Step 3: Implementar `normalizarNome` em `src/motor/normalizar.ts`**

Maiúsculas e `\u00A0` → espaço; envolve em espaços; aplica as regras da etapa 1 **em cadeia, na ordem**, cada uma sobre o resultado da anterior, substituindo **todas** as ocorrências; `trim`, envolve em espaços de novo; aplica a etapa 2 do mesmo jeito; `trim` final. Regra com `de` vazio é ignorada.

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npm test -- tests/motor/normalizar` · Expected: PASS, 2.125+ casos.

- [ ] **Step 5: Escrever o teste de pureza do núcleo**

```ts
it('motor e leitores não importam banco, rede, Next nem env', ...)
// varre src/motor/** e src/leitores/**: nenhum import de 'next', 'drizzle', 'pg', 'fs', 'node:*', e nenhum process.env
```

- [ ] **Step 6: Rodar e commitar**

Run: `npm test` · Expected: PASS.

```bash
git add src/motor/normalizar.ts tests/motor/
git commit -m "Normaliza nome de conta pelas duas etapas da tabela"
```

---

### Task 3: Natureza e grupos permitidos

**Files:**
- Create: `src/motor/natureza.ts`
- Test: `tests/motor/natureza.test.ts`

**Interfaces:**
- Produces: `resolverNatureza(classificacao: string, regras: RegraNatureza[]): ResultadoNatureza | null`, com
  `type ResultadoNatureza = { natureza: string; gruposDominio: string[]; naoMigrar: boolean }`.

- [ ] **Step 1: Escrever os testes (vão falhar)**

```ts
it('prefixo mais específico vence o genérico', () =>
  expect(resolverNatureza('1.1.0.00.00.00.00000', regras)?.natureza).toBe('ATIVO CIRCULANTE'));
it('cai no genérico quando não há específico', () =>
  expect(resolverNatureza('1.0.0.00.00.00.00000', regras)?.gruposDominio).toEqual(['11', '12']));
it('totalizador P.L.A. é NÃO MIGRAR', () =>
  expect(resolverNatureza('5.9.9.99', regras)?.naoMigrar).toBe(true));
it('classificação desconhecida devolve null', () =>
  expect(resolverNatureza('X.Y', regras)).toBeNull());
it('ignora espaços nas pontas da classificação', ...);
it.each(balancete)('linha %#', ({ clasCta, naturezaEsperada, gruposEsperados }) => ...);  // 113 casos
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npm test -- tests/motor/natureza` · Expected: FAIL.

- [ ] **Step 3: Implementar `resolverNatureza` em `src/motor/natureza.ts`**

Percorre as regras **na ordem do campo `ordem`** e devolve a primeira cujo `prefixo` seja igual ao início da classificação com espaços removidos. `gruposDominio` vem da regra; `naoMigrar` é `true` quando o campo de grupos da planilha é `NÃO MIGRAR`.

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npm test -- tests/motor/natureza` · Expected: PASS, 118 casos.

- [ ] **Step 5: Commit**

```bash
git add src/motor/natureza.ts tests/motor/natureza.test.ts
git commit -m "Resolve natureza e grupos permitidos pelo prefixo da classificação"
```

---

### Task 4: Resolução do código e os 12 status

**Files:**
- Create: `src/motor/resolver.ts`
- Test: `tests/motor/resolver.test.ts`

**Interfaces:**
- Consumes: `normalizarNome` (Task 2), `resolverNatureza` (Task 3).
- Produces:

```ts
export type Origem = 'manual' | 'sinonimo' | 'nome_igual' | 'nome_cortado' | 'nao_migrar' | 'nao_encontrado';
export type IndicePlano = { porCodigo: Map<string, ContaPlano>; porNomeNormalizado: Map<string, ContaPlano[]>; analiticas: ContaPlano[] };
export function criarIndicePlano(contas: ContaPlano[]): IndicePlano;
export function resolverConta(entrada: {
  nomeNormalizado: string; natureza: ResultadoNatureza | null; ajusteManual: string | null;
  indice: IndicePlano; sinonimos: Map<string, string>;
}): { codigo: string | null; origem: Origem; status: string };
```

Contas criadas na implantação entram no índice como contas analíticas comuns, por quem chama.

- [ ] **Step 1: Escrever um teste por status (vão falhar)**

Doze testes, um por texto da §6.5, com o texto literal na asserção. Mais:

```ts
it('ajuste manual vence sinônimo válido', ...);
it('ajuste manual de outra natureza é aceito, com aviso', () =>
  expect(r.status).toBe('Código da coluna L é de outra natureza - conferir'));
it('sinônimo para conta de outra natureza é descartado', ...);
it('nome cortado só é tentado com 25 caracteres ou mais', ...);   // 24 → nao_encontrado, 25 → nome_cortado
it('conta sintética nunca é candidata', ...);
it.each(analiticas)('linha %#', ({ codigoEsperado, statusEsperado }) => ...);   // 27 casos reais
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npm test -- tests/motor/resolver` · Expected: FAIL.

- [ ] **Step 3: Implementar `criarIndicePlano` e `resolverConta`**

A cascata da §6.4, nesta ordem: ajuste manual → sinônimo → nome igual → nome cortado (só com ≥ 25 caracteres) → `N/A`. Candidata é válida quando `tipo === 'A'` e o primeiro **ou** os dois primeiros caracteres da classificação estão em `gruposDominio`. Com nome repetido, vale a primeira conta e o status é `Nome repetido no plano - conferir` — a contagem de repetição olha todas as analíticas de mesmo nome normalizado, sem filtrar por natureza, como na planilha.

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npm test -- tests/motor/resolver` · Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/motor/resolver.ts tests/motor/resolver.test.ts
git commit -m "Resolve o código do Domínio pela cascata e produz os 12 status"
```

---

### Task 5: Agregação em lançamentos

**Files:**
- Create: `src/motor/agregar.ts`
- Test: `tests/motor/agregar.test.ts`

**Interfaces:**
- Consumes: `IndicePlano` (Task 4).
- Produces:

```ts
export type Lancamento = { contaDebito: string | null; contaCredito: string | null; valor: number; complemento: string };
export function agregarLancamentos(
  resolvidas: { codigo: string; saldoAtual: number }[], indice: IndicePlano
): Lancamento[];
```

- [ ] **Step 1: Escrever os testes (vão falhar)**

```ts
it('soma saldos do mesmo código', ...);
it('saldo negativo vira débito e positivo vira crédito', ...);
it('valor é o módulo do saldo', ...);
it('descarta saldo zero', ...);
it('ordena pela classificação da conta no plano', ...);
it('complemento é " | " mais a descrição, sem CR nem LF', ...);
it('gera 22 lançamentos do balancete real, com 22003884.50 em débito e em crédito', ...);
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npm test -- tests/motor/agregar` · Expected: FAIL.

- [ ] **Step 3: Implementar `agregarLancamentos`**

Agrupa por código, soma, arredonda em 2 casas, descarta zero, ordena pela classificação (comparação de texto crescente), define D/C pelo sinal.

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npm test -- tests/motor/agregar` · Expected: PASS.

- [ ] **Step 5: Escrever o teste do Review Focus 4 e fazê-lo passar**

```ts
it('saldo que arredonda para zero não gera partida', () =>
  expect(agregarLancamentos([{ codigo: '1', saldoAtual: 0.004 }], indice)).toEqual([]));
it('saldos que se anulam entre si não geram partida', ...);  // +100 e -100 no mesmo código
```

O arredondamento acontece **antes** do descarte, não depois.

- [ ] **Step 6: Commit**

```bash
git add src/motor/agregar.ts tests/motor/agregar.test.ts
git commit -m "Agrega saldos em lançamentos de débito e crédito"
```

---

### Task 6: Leiaute do TXT, orquestrador e teste de equivalência

**Files:**
- Create: `src/motor/leiaute-dominio.ts`, `src/motor/converter.ts`
- Test: `tests/motor/leiaute-dominio.test.ts`, `tests/equivalencia.test.ts`

**Interfaces:**
- Consumes: tudo das Tasks 2 a 5.
- Produces:

```ts
export type ParametrosLote = {
  dataSaldo: Date; cnpj: string; codigoEmpresa: string; tipoLote: string;
  codigoHistorico: string; incluirCabecalho: boolean;
};
export function gerarTxt(lancamentos: Lancamento[], p: ParametrosLote): string[];

export type Painel = {
  analiticas: number; mapeadas: number; pendentes: number; saldoPendente: number;
  totalDebito: number; totalCredito: number; diferenca: number;
  pronto: boolean; status: string;
};
export function converter(entrada: {
  balancete: LinhaBalancete[]; plano: ContaPlano[]; contasCriadas: ContaPlano[];
  sinonimos: Map<string, string>; regrasNormalizacao: RegraNormalizacao[];
  regrasNatureza: RegraNatureza[]; ajustesManuais: Map<string, string>; parametros: ParametrosLote;
}): { linhas: LinhaResolvida[]; lancamentos: Lancamento[]; txt: string[]; painel: Painel };
```

`LinhaResolvida` é `LinhaBalancete` mais `nomeNormalizado`, `natureza`, `gruposDominio`, `codigo`, `origem` e `status`. `ajustesManuais` é indexado por `codiCta`.

- [ ] **Step 1: Escrever os testes do leiaute (vão falhar)**

```ts
it('registro 01 tem 54 caracteres e os campos nas posições certas', ...);   // CNPJ fictício
it('registro 02 tem 150 caracteres', ...);
it('registro 03 tem 664 caracteres', ...);
it('registro 99 tem 100 caracteres e 98 noves', ...);
it('CNPJ entra só com dígitos, completado com espaços à direita', ...);
it('conta ausente vira 0000000', ...);
it('valor entra multiplicado por 100 em 15 dígitos', ...);          // 29341.66 → 000000002934166
it('sequência dos registros 03 começa em 2', ...);
it('cabeçalho 01 só aparece quando pedido', ...);
it('data sai como dd/mm/aaaa', ...);
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npm test -- tests/motor/leiaute` · Expected: FAIL.

- [ ] **Step 3: Implementar os quatro geradores e `gerarTxt`, e o teste do Review Focus 3**

Composição exata na §6.7 da spec. O complemento passa por: CR e LF → espaço, depois corte/preenchimento em 512 posições.

```ts
it('descrição de 600 caracteres não estoura o registro 03', () =>
  expect(gerarRegistro03({ ...l, complemento: 'A'.repeat(600) }, p, 2)).toHaveLength(664));
it('descrição com CHAR(160), pipe e quebra de linha mantém 664', ...);
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npm test -- tests/motor/leiaute` · Expected: PASS.

- [ ] **Step 5: Escrever o teste de equivalência com a planilha (vai falhar)**

```ts
// tests/equivalencia.test.ts — o teste que protege a migração
it('resolve o mesmo código que a planilha em todas as 27 analíticas', ...);
it('produz o mesmo texto de status que a planilha em todas as 27 analíticas', ...);
it('produz 22 lançamentos, com 22003884.50 em débito e em crédito e diferença zero', ...);
it('produz TXT idêntico ao da planilha, linha por linha', () =>
  expect(txt).toEqual(txtEsperado));                       // 24 linhas, igualdade exata
it('painel mostra 27 analíticas, 27 mapeadas, 0 pendentes e PRONTO PARA IMPORTAR', ...);
```

- [ ] **Step 6: Implementar `converter` e fazer a equivalência passar**

Encadeia: ignora linhas `tipo_cta` começando com `S` → normaliza → natureza → resolve → agrega → gera TXT → monta o painel. O painel segue a §6.8: `pronto` exige CNPJ e código de empresa preenchidos, zero pendentes e diferença zero; `status` é `PRONTO PARA IMPORTAR` ou `ATENÇÃO: revisar pendências / diferença`.

- [ ] **Step 7: Rodar a suíte inteira e commitar**

Run: `npm test` · Expected: PASS, equivalência inclusa.

```bash
git add src/motor/ tests/
git commit -m "Gera o TXT do leiaute 19 e prova equivalência com a planilha"
```

---

### Task 7: Leitura e reconhecimento de arquivos

**Files:**
- Create: `src/leitores/perfis.ts`, `src/leitores/ler-arquivo.ts`, `src/leitores/detectar.ts`
- Test: `tests/leitores/detectar.test.ts`
- Create: `fixtures/arquivos/balancete-dominio.xlsx`, `fixtures/arquivos/balancete-com-titulo.xlsx`, `fixtures/arquivos/balancete-virgula-decimal.csv`

**Interfaces:**
- Produces:

```ts
export type Celula = string | number | null;
export type Matriz = Celula[][];
export function lerArquivo(bytes: Uint8Array, nomeArquivo: string): Matriz;

export type Perfil = { id: 'dominio' | 'infobank'; nome: string; apelidos: Record<keyof LinhaBalancete, string[]> };
export function detectarPerfil(m: Matriz): { perfil: Perfil; linhaCabecalho: number; colunas: Record<string, number> } | null;
export function extrairLinhas(m: Matriz, linhaCabecalho: number, colunas: Record<string, number>): LinhaBalancete[];
export function converterNumero(valor: Celula): number;
```

O perfil `infobank` entra com os apelidos conhecidos hoje e será completado quando a amostra chegar (dependência externa 1 da spec). `extrairLinhas` aceita o mapa de colunas vindo do perfil detectado **ou** montado à mão na tela.

- [ ] **Step 1: Gerar as três fixtures de arquivo**

Script que escreve, a partir de `fixtures/balancete.json`: o arquivo normal; uma variante com três linhas de título antes do cabeçalho; e um CSV com decimal por vírgula e milhar por ponto.

- [ ] **Step 2: Escrever os testes (vão falhar)**

```ts
it('reconhece o perfil Domínio pelos nomes de coluna', ...);
it('extrai 113 linhas, 27 analíticas', ...);
it('layout desconhecido devolve null', ...);
it('aceita .xlsx, .xlsm, .csv e .txt delimitado', ...);
```

- [ ] **Step 3: Escrever o teste do Review Focus 2 e o do CSV**

```ts
it('acha o cabeçalho quando não está na primeira linha', () =>
  expect(detectarPerfil(matrizComTitulo)?.linhaCabecalho).toBe(4));
it('ignora linhas vazias e de total acima do cabeçalho', ...);
```

Procura o cabeçalho nas primeiras 20 linhas, escolhendo a que casa mais apelidos de campo.

- [ ] **Step 4: Rodar e confirmar que falha**

Run: `npm test -- tests/leitores` · Expected: FAIL.

- [ ] **Step 5: Implementar, com `converterNumero` cobrindo o Review Focus 1**

```ts
it.each([['1.234,56', 1234.56], ['1,234.56', 1234.56], ['1.234,56-', -1234.56],
         ['(1.234,56)', -1234.56], ['-1.234,56', -1234.56], ['', 0], [1234.56, 1234.56]])
  ('converte %s em %s', ...);
```

Decide o separador decimal pela **última** ocorrência de `,` ou `.`; sinal à direita e parênteses viram negativo; texto não numérico lança erro com o valor original na mensagem.

- [ ] **Step 6: Rodar e commitar**

Run: `npm test` · Expected: PASS.

```bash
git add src/leitores/ tests/leitores/ fixtures/arquivos/ scripts/
git commit -m "Lê o arquivo do balancete e reconhece o layout"
```

---

### Task 8: Banco — schema, migrações e carga inicial

**Files:**
- Create: `src/dados/schema.ts`, `src/dados/cliente.ts`, `src/dados/plano.ts`, `src/dados/regras.ts`, `src/dados/sinonimos.ts`
- Create: `drizzle.config.ts`, `compose.yaml`, `.env.example`
- Create: `scripts/semear.ts`
- Test: `tests/dados/schema.test.ts`

**Interfaces:**
- Produces: as tabelas da §8 da spec e, por módulo, as funções de leitura usadas pelas telas: `carregarPlanoVigente()`, `carregarRegras()`, `carregarSinonimos()` → `Map<string, string>`.

- [ ] **Step 1: Subir o Postgres de teste**

`compose.yaml` com Postgres 16 e `DATABASE_URL`/`DATABASE_URL_TESTE` no `.env.example`.

- [ ] **Step 2: Escrever os testes (vão falhar)**

```ts
it('migrações aplicam em banco vazio', ...);
it('só uma versão de plano pode estar vigente', ...);
it('sinônimo ativo é único por chave normalizada e versão de plano', ...);
it('sinônimo arquivado não conflita com o ativo de mesma chave', ...);
it('só uma implantação em andamento por pessoa', ...);
it('carga inicial grava 711 contas, 1387 sinônimos, 182 regras de normalização e 25 de natureza', ...);
```

- [ ] **Step 3: Rodar e confirmar que falha**

Run: `npm test -- tests/dados` · Expected: FAIL.

- [ ] **Step 4: Implementar schema, migrações e `scripts/semear.ts`**

Unicidade parcial com índice condicional (`where status = 'ativo'`, `where vigente`, `where status = 'em_andamento'`). `sinonimo_evento` sem `UPDATE`/`DELETE` concedidos.

- [ ] **Step 5: Rodar e commitar**

Run: `npx drizzle-kit migrate && npx tsx scripts/semear.ts && npm test -- tests/dados` · Expected: PASS.

```bash
git add src/dados/ drizzle.config.ts compose.yaml .env.example scripts/semear.ts tests/dados/
git commit -m "Cria o banco e carrega plano, sinônimos e regras da planilha"
```

---

### Task 9: Acesso pelo Entra ID e papéis

**Files:**
- Create: `src/acesso/auth.ts`, `src/acesso/papeis.ts`, `src/dados/usuarios.ts`, `src/observabilidade/auditar.ts`
- Create: `src/app/entrar/page.tsx`, `src/middleware.ts`
- Create: `docs/pedido-ti-entra-id.md`
- Test: `tests/acesso/papeis.test.ts`, `tests/acesso/entrada.test.ts`

**Interfaces:**
- Produces: `podeRevisar(u)`, `podeAdministrar(u)`, `exigirPapel(papel)`, `registrarEntrada(perfilEntra)`, `auditar(acao)`.

- [ ] **Step 1: Escrever os testes (vão falhar)**

```ts
it('usuário comum não revisa nem administra', ...);
it('revisor revisa mas não administra', ...);
it('primeira pessoa a entrar vira administradora', ...);
it('entrada cria o usuário na primeira vez e atualiza na segunda', ...);
it('entrada grava registro de auditoria com data e origem', ...);
it('conta sem oid é recusada', ...);
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npm test -- tests/acesso` · Expected: FAIL.

- [ ] **Step 3: Implementar `papeis.ts`, `usuarios.ts`, `auditar.ts`**

Chave de identidade é o `oid` do Entra ID, nunca o e-mail. `papel` nasce `usuario`, exceto na primeira entrada do banco vazio.

- [ ] **Step 4: Configurar o Auth.js com o provider Entra ID**

Provider `microsoft-entra-id`, um único tenant, escopo `openid profile email User.Read`. `middleware.ts` exige sessão em tudo menos `/entrar` e `/api/saude`. Nenhum segredo no código: `.env.example` documenta `AUTH_MICROSOFT_ENTRA_ID_ID`, `_SECRET` e `_ISSUER`.

- [ ] **Step 5: Escrever `docs/pedido-ti-entra-id.md`**

O que é, por que a permissão `User.Read` é inofensiva, o passo a passo do registro, a URL de retorno a cadastrar, e o que a TI precisa devolver.

- [ ] **Step 6: Rodar e commitar**

Run: `npm test` · Expected: PASS.

```bash
git add src/acesso/ src/app/entrar/ src/middleware.ts src/dados/usuarios.ts src/observabilidade/ docs/pedido-ti-entra-id.md tests/acesso/
git commit -m "Entra pela conta Microsoft e controla papéis no site"
```

---

### Task 10: Ações da implantação

**Files:**
- Create: `src/dados/implantacoes.ts`, `src/app/implantacao/acoes.ts`
- Test: `tests/implantacao/acoes.test.ts`

**Interfaces:**
- Consumes: `converter` (Task 6), `lerArquivo`/`detectarPerfil`/`extrairLinhas` (Task 7), `carregar*` (Task 8).
- Produces: `iniciarImplantacao(usuarioId)`, `salvarDadosEmpresa(id, dados)`, `anexarBalancete(id, arquivo)`, `definirAjusteManual(id, codiCta, codigo | null)`, `registrarContaCriada(id, conta)`, `recalcular(id)` → `{ painel, linhas }`.

- [ ] **Step 1: Escrever os testes (vão falhar)**

```ts
it('iniciar uma nova descarta a anterior em andamento, sem apagá-la', ...);
it('anexar balancete grava linhas resolvidas e o painel', ...);
it('ajuste manual vence e muda o status da linha', ...);
it('conta criada passa a valer para o ajuste manual da mesma implantação', ...);
it('conta criada não vale para outra implantação', ...);
it('recalcular com CNPJ e empresa vazios deixa o painel fora de PRONTO', ...);
it('arquivo de layout desconhecido devolve erro pedindo mapeamento manual', ...);
it('cada ação grava auditoria com usuário e implantação', ...);
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npm test -- tests/implantacao` · Expected: FAIL.

- [ ] **Step 3: Implementar as ações**

Cada ação confirma que a implantação pertence a quem está chamando e está `em_andamento`. `recalcular` chama `converter` com o plano vigente, as contas criadas da implantação, os sinônimos de agora e os ajustes manuais gravados; grava `implantacao_linha` e os totais do painel; guarda o arquivo de origem.

- [ ] **Step 4: Rodar e commitar**

Run: `npm test -- tests/implantacao` · Expected: PASS.

```bash
git add src/dados/implantacoes.ts src/app/implantacao/acoes.ts tests/implantacao/
git commit -m "Cria a implantação como unidade de trabalho no servidor"
```

---

### Task 11: Tela da implantação

**Files:**
- Create: `src/app/page.tsx` (minha mesa), `src/app/implantacao/[id]/page.tsx`
- Create: `src/app/implantacao/_componentes/{DadosEmpresa,AreaArquivo,PainelConferencia,TabelaLinhas,LinhaPendente,MapeamentoColunas,RegistrarContaCriada}.tsx`
- Test: `tests/implantacao/tela.test.tsx`

**Interfaces:**
- Consumes: as ações da Task 10.
- Produces: o componente `LinhaPendente`, com os botões `usar só aqui` e `ensinar para todos`, consumido pela Task 12.

- [ ] **Step 1: Escrever os testes de componente (vão falhar)**

```ts
it('minha mesa mostra o botão de iniciar quando não há implantação aberta', ...);
it('área de arquivo informa o que reconheceu, com as contagens', ...);   // "27 analíticas, 86 sintéticas ignoradas"
it('painel mostra os sete números e o semáforo', ...);
it('pendências aparecem antes das resolvidas', ...);
it('busca de conta mostra classificação e natureza de cada candidata', ...);
it('CNPJ com menos de 14 dígitos acusa antes de enviar', ...);
it('layout desconhecido abre o mapeamento de colunas', ...);
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npm test -- tests/implantacao/tela` · Expected: FAIL.

- [ ] **Step 3: Implementar as telas e os componentes**

Uma página só, com o painel fixo no alto. Rótulos iguais aos da planilha. A tabela não reordena enquanto há campo em foco.

- [ ] **Step 4: Rodar e commitar**

Run: `npm test` · Expected: PASS.

```bash
git add src/app/ tests/implantacao/tela.test.tsx
git commit -m "Monta a tela de implantação com painel e resolução de pendências"
```

---

### Task 12: Sinônimos — ensinar, revisar, desfazer

**Files:**
- Create: `src/app/sinonimos/{page.tsx,acoes.ts}`, `src/app/sinonimos/_componentes/{Busca,FilaRevisao,Historico}.tsx`
- Modify: `src/dados/sinonimos.ts`
- Test: `tests/sinonimos/acoes.test.ts`

**Interfaces:**
- Produces: `ensinarSinonimo({ nomeOriginal, codigo, motivo, usuarioId })`, `solicitarAlteracao(...)`, `decidirAlteracao(id, aprovada, observacao)`, `desfazer(eventoId)`.

- [ ] **Step 1: Escrever os testes (vão falhar)**

```ts
it('ensinar cria o sinônimo e um evento de criação', ...);
it('ensinar sem motivo é recusado', ...);
it('ensinar código fora do plano vigente marca fora_do_padrao e devolve aviso', ...);
it('ensinar código que não existe em lugar nenhum é recusado', ...);
it('alterar sinônimo existente não altera direto: cria pedido pendente', ...);
it('usuário comum não decide pedido; revisor decide', ...);
it('aprovar aplica o novo código e registra evento', ...);
it('desfazer volta ao código anterior e registra evento', ...);
it('chave normalizada é calculada com as regras vigentes, não com o texto digitado', ...);
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npm test -- tests/sinonimos` · Expected: FAIL.

- [ ] **Step 3: Implementar as ações e as telas**

Criar é direto; alterar e arquivar passam por `alteracao_sinonimo`. Todo efeito grava `sinonimo_evento`.

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npm test -- tests/sinonimos` · Expected: PASS.

- [ ] **Step 5: Escrever o teste de alteração concorrente**

```ts
it('quem salva sobre versão desatualizada recebe aviso, não sobrescreve', ...);
```

Comparação pelo `sinonimo_evento` mais recente conhecido pela tela.

- [ ] **Step 6: Rodar e confirmar que passa**

Run: `npm test -- tests/sinonimos` · Expected: PASS.

- [ ] **Step 7: Escrever o teste do Review Focus 5 e fazê-lo passar**

```ts
it('duas pessoas ensinando a mesma chave ao mesmo tempo: a segunda recebe mensagem', async () => {
  const [a, b] = await Promise.allSettled([ensinar(mesmaChave, '1', u1), ensinar(mesmaChave, '2', u2)]);
  // uma cria; a outra devolve { erro: 'Já existe sinônimo para este nome: ...' } e nenhuma exceção escapa
});
```

A colisão do índice único é capturada e traduzida em mensagem com o código já cadastrado.

- [ ] **Step 8: Commit**

```bash
git add src/app/sinonimos/ src/dados/sinonimos.ts tests/sinonimos/
git commit -m "Ensina, revisa e desfaz sinônimos na base compartilhada"
```

---

### Task 13: Reaplicação automática nas pendências

**Files:**
- Create: `src/app/implantacao/reaplicar.ts`
- Modify: `src/app/implantacao/[id]/page.tsx`
- Test: `tests/implantacao/reaplicar.test.ts`

**Interfaces:**
- Produces: `reaplicarSinonimos(implantacaoId)` → `{ resolvidas: number; porQuem: string[] }`.

- [ ] **Step 1: Escrever os testes (vão falhar)**

```ts
it('pendência vira resolvida quando alguém ensina o sinônimo', ...);
it('linha com ajuste manual não é tocada', ...);
it('linha já resolvida por nome igual não é tocada', ...);
it('devolve a contagem e os nomes de quem ensinou', ...);
it('sem sinônimo novo, não faz nada e não grava nada', ...);
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npm test -- tests/implantacao/reaplicar` · Expected: FAIL.

- [ ] **Step 3: Implementar a reaplicação e o aviso na tela**

Só linhas com `origem = 'nao_encontrado'` e sem ajuste manual. A tela consulta a cada 15 segundos, mostra o aviso e preserva rolagem e foco.

- [ ] **Step 4: Rodar e commitar**

Run: `npm test` · Expected: PASS.

```bash
git add src/app/implantacao/ tests/implantacao/reaplicar.test.ts
git commit -m "Reaplica sinônimos novos nas pendências sem mexer no resto"
```

---

### Task 14: Conclusão, cronômetro e implantações concluídas

**Files:**
- Create: `src/app/concluidas/{page.tsx,acoes.ts}`, `src/app/implantacao/concluir.ts`, `src/dados/tempo.ts`
- Test: `tests/implantacao/concluir.test.ts`, `tests/implantacao/tempo.test.ts`

**Interfaces:**
- Produces: `gerarTxtDaImplantacao(id, liberacaoMotivo?)` → `{ nomeArquivo: string; conteudo: string }`, `concluirImplantacao(id, liberacaoMotivo?)`, `tempoAtivoSegundos(id)`, `listarConcluidas(filtro)`, `exportarConcluidas()` → `Uint8Array`.

O nome do arquivo é campo da implantação, com `Importacao_Dominio.txt` como padrão — é a célula `C6` da planilha.

- [ ] **Step 1: Escrever os testes (vão falhar)**

```ts
it('não gera TXT com pendência', ...);
it('não gera TXT com diferença diferente de zero', ...);
it('gera com motivo de liberação, e o motivo fica gravado na implantação', ...);
it('não conclui sem gerar nada antes', ...);
it('concluir move para concluída e preenche a data de conclusão', ...);
it('tempo total é conclusão menos início', ...);
it('tempo ativo desconta intervalo maior que 10 minutos sem ação', ...);
it('tempo ativo de implantação sem pausa é igual ao total', ...);
it('exportação traz empresa, data, pessoa, tempo total, tempo ativo e liberação', ...);
it('TXT gerado fica guardado na implantação, com hash', ...);
it('download entrega o nome de arquivo da implantação, com Importacao_Dominio.txt como padrão', ...);
it('TXT sai com quebra de linha CRLF e sem linha em branco no fim', ...);
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npm test -- tests/implantacao/concluir tests/implantacao/tempo` · Expected: FAIL.

- [ ] **Step 3: Implementar a trava, o cronômetro e a lista**

Tempo ativo é derivado da auditoria da implantação: soma dos intervalos entre ações consecutivas, ignorando os maiores que 10 minutos. Exportação em `.xlsx` com uma linha por implantação concluída.

- [ ] **Step 4: Rodar e commitar**

Run: `npm test` · Expected: PASS.

```bash
git add src/app/concluidas/ src/app/implantacao/concluir.ts src/dados/tempo.ts tests/implantacao/
git commit -m "Trava a geração, cronometra e lista as implantações concluídas"
```

---

### Task 15: Operação, empacotamento e manual

**Files:**
- Create: `src/observabilidade/erros.ts`, `src/app/operacao/page.tsx`, `src/app/regras/page.tsx`, `src/app/api/saude/route.ts`
- Create: `src/dados/retencao.ts`, `scripts/descartar-antigos.ts`
- Create: `Dockerfile`, `.dockerignore`, `docs/operacao.md`
- Test: `tests/operacao/erros.test.ts`, `tests/operacao/manual.test.ts`, `tests/operacao/retencao.test.ts`

**Interfaces:**
- Produces: `registrarErro(erro, contexto)`, `listarErros(limite)`, `listarAcessos(filtro)`, `descartarArquivosAntigos(meses)` → `{ descartados: number }`, e a rota `/api/saude`.

- [ ] **Step 1: Escrever os testes (vão falhar)**

```ts
it('erro em ação grava registro com pessoa, tela e implantação', ...);
it('mensagem de erro não vaza para a pessoa o conteúdo do banco', ...);
it('tela de operação lista os últimos erros e acessos, só para administrador', ...);
it('/api/saude responde 200 com o banco de pé e 503 sem ele', ...);
it('publicar versão de plano lista os sinônimos órfãos', ...);
it('editar regra de normalização ou natureza grava valor anterior e novo na auditoria', ...);
it('manual de operação tem as seis seções obrigatórias', ...);
```

E a retenção da §13 da spec:

```ts
// tests/operacao/retencao.test.ts
it('descarta arquivo de balancete de implantação concluída há mais de 12 meses', ...);
it('mantém a implantação, os totais e o TXT: só o arquivo de origem é descartado', ...);
it('não toca em implantação concluída há 11 meses', ...);
it('prazo é configurável por variável de ambiente, com 12 meses como padrão', ...);
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npm test -- tests/operacao` · Expected: FAIL.

- [ ] **Step 3: Implementar captura de erro, telas de operação e de regras, e o descarte por retenção**

A tela de regras permite editar Normalização e Natureza COSIF, importar versão nova de plano e ver os órfãos; cada edição grava valor anterior e novo na auditoria. `descartarArquivosAntigos` roda por `scripts/descartar-antigos.ts`, agendado fora do aplicativo (documentado no manual), e apaga **apenas** o arquivo de origem.

- [ ] **Step 4: Escrever `docs/operacao.md`**

Seis seções, em português, para quem não é programador: subir versão nova; voltar atrás; ler um erro e os cinco casos mais prováveis; restaurar backup; promover revisor; conferir o custo mensal.

- [ ] **Step 5: Empacotar**

`Dockerfile` multi-estágio (build e runtime), `compose.yaml` com aplicativo e Postgres.

- [ ] **Step 6: Verificar o pacote**

Run: `docker build -t implantacao-saldos . && docker compose up -d && curl -f localhost:3000/api/saude` · Expected: HTTP 200.

- [ ] **Step 7: Commit**

```bash
git add src/observabilidade/ src/app/operacao/ src/app/regras/ src/app/api/ Dockerfile .dockerignore docs/operacao.md tests/operacao/
git commit -m "Monitora acessos e erros, empacota e documenta a operação"
```

---

## Ordem e dependências

Tasks 1 a 6 são o núcleo puro e podem ser feitas sem banco, sem acesso e sem tela — a Task 6 já entrega a prova de que o sistema faz o que a planilha faz. A Task 7 é independente das 2 a 6. A Task 8 abre o caminho das 9 a 14. A Task 15 fecha.

Dependências externas da spec que **não** bloqueiam nenhuma task: as amostras de balancete (o perfil `infobank` entra como cadastro na Task 7), a versão mais recente das planilhas (as regras são dados; entra como nova carga), a verificação do Entra ID (a Task 9 é testada sem o provedor real) e a decisão de hospedagem (a Task 15 entrega imagem portátil).

## Deixado de fora de propósito

- **Restrição de entrada a um grupo do Entra ID** — a spec marca como opcional e depende da TI. Entra como configuração do provider depois, sem mudança de código.
- **Monitor externo de disponibilidade** — é contratação de serviço apontando para `/api/saude`, não código. Fica documentado no manual.
- **Playwright ou qualquer teste de navegador ponta a ponta** — as ações de servidor são testadas contra banco de verdade e os componentes com Testing Library. O teste que protege o que importa é o de equivalência, na Task 6.
