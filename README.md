# Linkbio (nome provisório)

Plataforma de link na bio para pequenos negócios e agências. Veja o produto e o escopo em [docs/PRD.md](docs/PRD.md).

**Estado:** `npm run lint` e `npm run build` passam. Roda localmente com PostgreSQL em Docker. **Nada foi publicado.**

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

`/demo` mostra uma página de exemplo e funciona sem banco.

## Estrutura
- `src/app/[slug]` — página pública (cache de 60 s, atualizada ao salvar no painel)
- `src/app/go/[id]` — redireciona o link e registra o clique
- `src/app/api/view` — registra a visualização
- `src/app/media/[id]` — serve as imagens enviadas (guardadas no Postgres)
- `src/app/dashboard` — painel: Links, Aparência (prévia ao vivo) e Resultados
- `src/server/` — banco, autenticação, upload, analytics
- `db/migrations` — SQL aplicado por `scripts/migrate.mjs`

## Trocar para um banco real
Qualquer PostgreSQL 14+ serve (Neon, Supabase, RDS…): aponte `DATABASE_URL` para ele e rode `npm run db:migrate`. As imagens ficam na tabela `media`; se o volume crescer, dá para mover para um storage de objetos mudando só `src/server/media.ts` e a rota `/media/[id]`.

## Privacidade
Não guarda IP nem cookies de rastreio. Cada visitante vira um hash diário (IP + navegador + perfil + dia + segredo), usado só para contar únicos e descartar repetições. Guarda origem (Instagram, Google…) e tipo de dispositivo.

## Próximos passos
Ícones de redes sociais, arrastar para reordenar, QR code; depois leads → robô de leads, Pix, assinatura, domínio próprio, painel de agência.
