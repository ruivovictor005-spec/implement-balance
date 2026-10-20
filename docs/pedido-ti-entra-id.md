# Pedido à TI — registro do app no Microsoft Entra ID

O sistema **Implantação de Saldos** vai usar a conta Microsoft da empresa para o login (ninguém cria
senha nova). Para isso, a TI precisa **registrar o aplicativo no Entra ID** e devolver três valores.
Este documento explica o que é, por que é seguro, o passo a passo e o que precisa voltar.

## O que estamos pedindo

Um registro de aplicativo (App registration) no Entra ID da empresa, do tipo **web**, com login só
para contas **deste diretório** (single tenant), e a permissão **`User.Read`** (delegada).

## Por que é inofensivo

- **`User.Read`** deixa o app ler **apenas o perfil básico de quem fez login** (nome, e-mail, id) — e
  só dessa pessoa, com o consentimento dela. **Não** lê e-mails, arquivos, calendário, nem dados de
  outras pessoas.
- O login é sempre na tela da **Microsoft**; o sistema nunca vê a senha.
- A identidade usada internamente é o **`oid`** (id imutável da conta no Entra), não o e-mail.

## Passo a passo (portal do Entra ID / Azure)

1. **Microsoft Entra ID → App registrations → New registration.**
2. **Name:** `Implantação de Saldos`.
3. **Supported account types:** *Accounts in this organizational directory only (single tenant).*
4. **Redirect URI:** plataforma **Web**, com a URL de retorno:
   - Produção: `https://SEU-DOMINIO/api/auth/callback/microsoft-entra-id`
   - Teste local (se quiserem testar antes de publicar): `http://localhost:3000/api/auth/callback/microsoft-entra-id`
5. **Register.**
6. Em **Certificates & secrets → New client secret**, crie um segredo e **copie o valor na hora**
   (ele só aparece uma vez).
7. Em **API permissions**, confirme **Microsoft Graph → Delegated → `User.Read`** (costuma já vir).
   Se a empresa exigir, clique em **Grant admin consent**.

## O que a TI precisa devolver

| Valor | Onde achar | Vai na variável |
|---|---|---|
| **Application (client) ID** | tela Overview do app | `AUTH_MICROSOFT_ENTRA_ID_ID` |
| **Client secret (value)** | Certificates & secrets | `AUTH_MICROSOFT_ENTRA_ID_SECRET` |
| **Directory (tenant) ID** | tela Overview do app | compõe o `AUTH_MICROSOFT_ENTRA_ID_ISSUER` |

O `issuer` fica assim, trocando o tenant:
`https://login.microsoftonline.com/<DIRECTORY_TENANT_ID>/v2.0`

## Observações

- A **URL de retorno** precisa bater exatamente com a de produção quando o site for publicado; dá
  para cadastrar mais de uma (produção e teste).
- Restringir o acesso a um **grupo específico** do Entra (só o time de contabilidade, por exemplo) é
  opcional e se configura no próprio provedor depois, sem mudança de código.
- Enquanto esses valores não chegam, o site roda em **modo de desenvolvimento**, sem exigir login —
  então dá para continuar testando o produto normalmente.
