# Implantação de Saldos

Converte o **balancete de origem** no **arquivo de importação posicional do Domínio** (leiaute 19).
É a versão web do implantador que antes vivia nas planilhas `INTEGRAÇÃO DOMÍNIO` e `INTEGRAÇÃO INFOBANK`.

A conta é feita por um motor que foi testado contra a própria planilha: para o balancete de
referência, ele produz o **mesmo TXT, linha por linha** (24 linhas, R$ 22.003.884,50 em débito e em
crédito, diferença zero).

## Como instalar (uma vez)

1. Instale o [Node.js](https://nodejs.org) versão 22 ou mais nova.
2. Abra o terminal nesta pasta e rode:

```bash
npm install
```

## Como rodar

```bash
npm run dev
```

Depois abra o navegador em **http://localhost:3000**.

## Como usar

1. Preencha os **dados da empresa e do lote** (data do saldo, CNPJ, código da empresa no Domínio,
   tipo do lote, código do histórico e se inclui o cabeçalho).
2. **Arraste o balancete** (`.xlsx`, `.xlsm`, `.csv` ou `.txt`) para a área indicada, ou clique para
   escolher. A tela diz o que reconheceu — por exemplo: *"Reconheci balancete Domínio — 113 linhas,
   27 analíticas, 86 sintéticas ignoradas"*.
3. Confira o **painel**: contas analíticas, mapeadas, pendentes, saldo pendente, total de débito e
   crédito e a diferença. O semáforo fica **PRONTO PARA IMPORTAR** só quando há CNPJ e código da
   empresa, zero pendências e diferença zero.
4. **Resolva as pendências**: em cada conta pendente, busque a conta certa por nome ou código
   (a busca mostra a classificação e a natureza, para não escolher conta de natureza errada) e clique
   em **usar só aqui**. Se precisar de uma conta que ainda não existe no plano, registre-a em
   *"Registrar conta criada"* (vale só nesta sessão).
5. Clique em **Gerar TXT do Domínio** para baixar o arquivo. Com pendência ou diferença, o botão fica
   bloqueado até você escrever uma justificativa.

## O que ainda não existe (vem depois)

- **Banco, login e base compartilhada.** Hoje o plano de contas, os sinônimos e as regras vêm dos
  arquivos em `fixtures/`. Por isso o botão **"ensinar para todos"** aparece desabilitado: o que você
  ensina ainda não é guardado para a equipe — isso chega junto com a base compartilhada.
- **Perfil Infobank (COSIF).** O layout é reconhecido, mas a convenção de sinal do saldo precisa ser
  confirmada com uma amostra real antes de usar em produção.
- **Gravação em ANSI.** O download sai em UTF-8; o ajuste fino de codificação para o Domínio é um
  passo posterior.

## Para quem desenvolve

- `npm test` — roda a suíte (motor, leitores e tela).
- `npm run typecheck` — confere os tipos.
- `npm run exemplos` — regera os arquivos de exemplo em `fixtures/arquivos/`.
- O **motor** (`src/motor/`) e os **leitores** (`src/leitores/`) são puros: sem banco, rede, Next nem
  arquivo. A borda que lê os dados fica em `src/dados/` e `src/app/acoes.ts`.
