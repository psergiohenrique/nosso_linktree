# Linkbio (nome provisório)

Plataforma de link na bio para pequenos negócios e agências. Veja o produto e o escopo em [docs/PRD.md](docs/PRD.md).

**Estado:** código escrito, ainda **não instalado nem executado** (Node.js não estava disponível quando foi gerado), e **nada foi publicado** em lugar nenhum. Pode haver erros de tipo/build a corrigir no primeiro `npm run build`.

## Stack
Next.js 14 (App Router) · TypeScript · Tailwind · Supabase (Auth, Postgres, RLS).

## Rodar localmente
1. Instale o Node.js 20+.
2. `npm install`
3. Crie um projeto no Supabase, rode o SQL de `supabase/migrations/0001_init.sql` e, em *Authentication → URL Configuration*, libere `http://localhost:3000/auth/callback`.
4. Copie `.env.example` para `.env.local` e preencha a URL e a chave `anon`.
5. `npm run dev` e abra http://localhost:3000.

`/demo` mostra uma página de exemplo e funciona sem Supabase.

## Estrutura
- `src/app/[slug]` — página pública (cache de 60 s, atualizada ao salvar no painel)
- `src/app/go/[id]` — redireciona o link e registra o clique
- `src/app/api/view` — registra a visualização
- `src/app/dashboard` — painel (perfil, links, resultados)
- `supabase/migrations` — tabelas, RLS e funções `track_event`, `profile_stats`, `profile_totals`

## Privacidade
Não guarda IP nem cookies de rastreio: apenas referrer e tipo de dispositivo.

## Próximos passos (V2)
Leads → robô de leads, Pix, assinatura, domínio próprio, painel de agência.
