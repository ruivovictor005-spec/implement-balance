# Deploy em produção — Vercel + Neon (Postgres)

Objetivo: deixar o **Implement Balance** sempre no ar, com um **link público (HTTPS)**, acessível de
qualquer lugar e por vários usuários — sem depender de nenhuma máquina do escritório ficar ligada.

Arquitetura em produção:

- **Neon** hospeda o **PostgreSQL** (o banco onde ficam usuários, implantações, plano de contas etc.).
- **Vercel** hospeda a aplicação **Next.js** e faz o deploy automático a cada `git push` no GitHub.

> Em desenvolvimento nada disso é necessário: `npm run dev` sobe um Postgres embutido (PGlite).
> Isto aqui é só para o ambiente de produção.

---

## 1. Criar o banco no Neon

1. Crie uma conta grátis em https://neon.tech e um **projeto** (região mais próxima, ex.: São Paulo).
2. No painel do projeto, em **Connection string**, copie **duas** URLs:
   - a **Pooled** (tem `-pooler` no host) → vai para a aplicação (`DATABASE_URL` na Vercel).
   - a **Direct** (sem `-pooler`) → usada só para rodar as migrações.
3. Guarde as duas. Elas têm o formato `postgresql://usuario:senha@host/db?sslmode=require`.

## 2. Criar o schema e carregar os dados (uma vez)

No seu computador, com a URL **Direct** do Neon, rode a migração e a carga inicial (plano de contas,
regras e sinônimos). No PowerShell:

```powershell
$env:DATABASE_URL = "COLE_AQUI_A_URL_DIRECT_DO_NEON"
npm run db:migrate
npm run db:seed
```

(`db:migrate` cria as tabelas; `db:seed` carrega o plano de contas padrão e as regras. Rode o seed
**uma vez** — ele popula os dados de referência.)

## 3. Publicar na Vercel

1. Crie uma conta grátis em https://vercel.com e conecte sua conta do **GitHub**.
2. **Add New → Project** e importe o repositório `ruivovictor005-spec/implement-balance`.
3. A Vercel detecta Next.js sozinha. Em **Environment Variables**, adicione:

   | Variável | Valor |
   | --- | --- |
   | `DATABASE_URL` | a URL **Pooled** do Neon (com `-pooler`) |
   | `AUTH_SECRET` | um segredo forte (gere com `npx auth secret`) |
   | `AUTH_TRUST_HOST` | `true` |
   | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | opcional — para o e-mail de recuperação de senha |

4. Em **Settings → General**, confira que a versão do **Node.js** é **22.x**.
5. Clique em **Deploy**. Ao fim, a Vercel dá a URL pública (ex.: `https://implement-balance.vercel.app`).

A primeira conta criada no sistema vira **admin**.

## 4. Atualizações no futuro

- **Código:** cada `git push` na branch `main` faz a Vercel publicar sozinha.
- **Mudança no banco (nova migração):** rode `npm run db:migrate` com a URL **Direct** antes (ou logo
  depois) do deploy. As migrações são idempotentes — só aplicam o que falta.

## 5. Observações

- O **PGlite** (banco embutido) é usado só em desenvolvimento; em produção, com `DATABASE_URL`
  definido, ele nem é carregado.
- A Vercel roda em **serverless**; por isso usamos a conexão **Pooled** do Neon na aplicação (aguenta
  muitas conexões curtas) e a **Direct** apenas para DDL/migração.
- Dados que **não podem sair da empresa** mudam a conta: nesse caso, prefira hospedar no servidor da
  própria empresa (ver a opção de VPS/servidor interno) em vez de Neon/Vercel.
