# Linkbio by CodePath

Plataforma de link na bio para pequenos negócios e agências, produto da [CodePath](https://codepath.dev.br). Produção: **https://linkbio.dev.br** (páginas dos clientes em `linkbio.dev.br/<slug>`). Veja o produto e o escopo em [docs/PRD.md](docs/PRD.md).

**Estado:** `npm run lint`, `npm run build` e `npm test` passam. Publicado na Vercel (projeto `nosso_linktree`, push na `main` publica) com banco no Neon. Localmente roda com PostgreSQL em Docker.

## Stack
Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4 (CSS global com variáveis) · PostgreSQL 16 (`pg`, SQL puro) · Vercel Analytics. Backend dentro do repositório (`src/server/`). Mesmo padrão dos sites `site-moraex` e `site_leticia_moraes`; detalhes em `CLAUDE.md`.

## Rodar localmente
1. Node.js 20.9+ e Docker.
2. `npm install`
3. `cp .env.example .env.local` e troque `APP_SECRET` (`openssl rand -base64 32`).
4. `npm run db:up` — sobe o Postgres (porta 5435).
5. `npm run db:migrate` — cria as tabelas.
6. `npm run db:seed` — opcional: conta de teste com página e 30 dias de acessos (credenciais no topo de `scripts/seed.mjs`).
7. `npm run dev` e abra http://localhost:3000.

`/demo` é um playground: dá para testar temas, cores, botões, fontes, formatos, tamanhos e imagens dos links com prévia ao vivo, sem banco e sem login (nada é salvo).

**Recuperar senha:** sem `RESEND_API_KEY`/`MAIL_FROM`, em dev o e-mail com o link aparece no terminal do `npm run dev`.

## Testes
- `npm test` — testes de unidade (Vitest), sem banco.
- `npm run test:db` — inclui os testes de limite de tentativas, recuperação de senha e cobrança (webhook do Asaas simulado) no Postgres local do Docker (precisa de `db:up` e `db:migrate` com o `DATABASE_URL` do Docker).

## PostHog
A integração usa `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN` e `NEXT_PUBLIC_POSTHOG_HOST` no `.env.local` e nas variáveis de ambiente da Vercel. Configure-os com a chave pública e o host de ingestão do projeto PostHog desejado; não coloque credenciais no repositório. Alterações nas variáveis públicas exigem uma nova build/publicação para valer no navegador.

O SDK do navegador é inicializado no site e no painel, com captura de exceções; visualizações e cliques das páginas públicas dos clientes são enviados pelo servidor, sem identificador do visitante. Erros não tratados no servidor Node.js também são enviados ao Error Tracking pelo hook do Next.js. Para evitar exposição de dados pessoais, eles incluem apenas uma mensagem genérica, tipo de rota e digest numérico quando disponível, sem mensagem ou stack originais, URL, cabeçalhos ou identidade do visitante; isso limita o diagnóstico. Erros no runtime Edge não são enviados por essa integração.

Para validar a troca de projeto, confira no PostHog se uma visita de teste e erros controlados de navegador e servidor aparecem em Web Analytics e Error Tracking, respectivamente. Não inclua dados pessoais nos erros de teste.

## Planos e cobrança
Grátis (até 5 links, selo, 7 dias de resultados) e Pro (R$ 9,90/mês ou R$ 70,80/ano = R$ 5,90/mês) via Asaas. Ligada por `BILLING_ENABLED=true` (desligada, todos têm o Pro). Como funciona e como ligar em produção: [docs/ESTADO-ATUAL.md](docs/ESTADO-ATUAL.md#11-planos-e-cobrança-paywall).

## Estrutura
- `src/app/[slug]` — página pública (cache de 60 s, atualizada ao salvar no painel), com SEO próprio e imagem de compartilhamento gerada (`opengraph-image.tsx`); só vai para o Google com conteúdo mínimo e se o dono não desligar (regras em `src/lib/seo.ts`)
- `src/app/go/[id]` — redireciona o link e registra o clique
- `src/app/api/view` — registra a visualização
- `src/app/media/[id]` — serve as imagens enviadas (guardadas no Postgres)
- `src/app/dashboard` — painel: Links, Aparência (prévia ao vivo), Resultados e Plano
- `src/app/admin` — admin (só e-mails em `ADMIN_EMAILS`; os demais recebem 404): resumo com cadastros, planos, MRR e receita; lista de contas com busca; detalhe da conta (cadastro, página, links, assinatura, cobranças) e Pro de cortesia
- `src/app/api/asaas/webhook` e `src/app/api/cron/billing` — webhook do Asaas e cron diário da cobrança
- `src/server/` — banco, autenticação, upload, analytics, cobrança (Asaas)
- `db/migrations` — SQL aplicado por `scripts/migrate.mjs`

## Trocar para um banco real
Qualquer PostgreSQL 14+ serve (Neon, Supabase, RDS…): aponte `DATABASE_URL` para ele e rode `npm run db:migrate`. Produção (Neon): a URL fica só na Vercel e em `.env.neon` (fora do git, só com `DATABASE_URL=...`); migre com `npm run db:migrate:prod` **antes** de publicar código que dependa da migração nova. O `.env.local` aponta sempre para o Postgres do Docker. As imagens ficam na tabela `media`; se o volume crescer, dá para mover para um storage de objetos mudando só `src/server/media.ts` e a rota `/media/[id]`.

## Privacidade
Não guarda IP nem cookies de rastreio. Cada visitante vira um hash diário (IP + navegador + perfil + dia + segredo), usado só para contar únicos e descartar repetições. Guarda origem (Instagram, Google…) e tipo de dispositivo.

## Próximos passos
Ver a primeira renovação da cobrança (20/11); ícones de redes sociais, arrastar para reordenar, QR code; depois leads → robô de leads, Pix, domínio próprio, painel de agência.
