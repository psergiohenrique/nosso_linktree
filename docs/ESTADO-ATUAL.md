# Linkbio by CodePath — O que já está feito

Retrato do projeto em 2026-10-16. Produto e escopo em [PRD.md](PRD.md); como rodar em [../README.md](../README.md).

**Resumo:** o MVP funciona de ponta a ponta: cadastro → criação da página → links → aparência → página pública → métricas, com recuperação de senha e limite de tentativas. **Publicado em https://bio.codepath.dev.br** (2026-10-16). Há testes automatizados (Vitest) para validação, origem do tráfego, limite de tentativas e recuperação de senha.

**Marca e endereço:** produto da CodePath — "Linkbio by CodePath" no logo, rodapé, SEO/JSON-LD (`Organization` CodePath como publisher) e imagem de compartilhamento. Endereço de produção: `https://bio.codepath.dev.br` (via `NEXT_PUBLIC_SITE_URL`; o prefixo do endereço no painel sai dessa variável).

**Banco de produção:** Postgres no Neon, com as migrações 0001–0003 aplicadas (sem seed).

**Hospedagem:** projeto `nosso_linktree` na Vercel, ligado ao repositório (push na `main` publica). Domínio `bio.codepath.dev.br` (DNS de codepath.dev.br já é da Vercel). Variáveis só no ambiente Production: `DATABASE_URL`, `APP_SECRET`, `NEXT_PUBLIC_SITE_URL`, `RESEND_API_KEY`, `MAIL_FROM`. Previews não têm banco (de propósito, para não tocar no de produção). `.vercelignore` impede que o `vercel deploy` envie arquivos `.env*`.

**E-mail:** Resend, na mesma conta usada pelo Ambiento (chave compartilhada com o `ambiento-backend`), onde `codepath.dev.br` já está verificado (região sa-east-1). Remetente: `Linkbio by CodePath <nao-responda@codepath.dev.br>`. Envio de recuperação de senha testado em produção.

---

## 1. Stack e infraestrutura

- Next.js 16 (App Router) · React 19 · TypeScript · CSS global com variáveis (Tailwind v4 instalado, mas não usado para estilo).
- PostgreSQL 16 via `pg` com SQL puro; backend dentro do repositório (`src/server/`).
- Postgres local em Docker (`docker-compose.yml`, porta 5435).
- Scripts: `db:up`, `db:migrate` (aplica `db/migrations/*.sql` em ordem, controlado por `schema_migrations`), `db:seed` (conta de teste com página e 30 dias de acessos), `test` (testes de unidade) e `test:db` (inclui os testes com o Postgres local).
- Variáveis de ambiente: `DATABASE_URL`, `APP_SECRET`, `NEXT_PUBLIC_SITE_URL` e, para enviar e-mail, `RESEND_API_KEY` e `MAIL_FROM` (`.env.example`).
- Vercel Analytics e Speed Insights já integrados; cabeçalhos de segurança centralizados em `next.config.ts`.

## 2. Site de marketing (`/`)

- Landing com seções: Nav, Hero, StatsBar, Recursos, Como funciona, CTA e Footer.
- Animação de entrada ao rolar (`RevealWrapper`).
- SEO: metadata global, JSON-LD (`SoftwareApplication` + `WebSite`), `sitemap.ts`, `robots.ts`, imagem Open Graph gerada (`opengraph-image.tsx`) e ícone.

## 3. Contas e login (`/login`)

- Cadastro e login por **e-mail e senha** (`?modo=cadastro` para criar conta) e logout.
- Senhas com scrypt; sessão em tabela `sessions` guardando só o sha256 do token do cookie httpOnly.
- **Recuperação de senha** (`/login/recuperar`): envia por e-mail (Resend) um link de uso único válido por 1 hora; a resposta é a mesma exista ou não a conta. O link passa por `/api/redefinir-senha`, que guarda o token num cookie httpOnly e abre `/login/redefinir` sem o token na URL. Trocar a senha encerra todas as sessões. Sem Resend configurado, em dev o link aparece no terminal.
- **Limite de tentativas** (`auth_attempts`, chaves em hash): login 5 falhas por e-mail e 30 por IP a cada 15 min; cadastro 5 por IP por hora; recuperação 3 por e-mail e 10 por IP por hora.
- `src/proxy.ts` barra `/dashboard` sem cookie; a validação real é feita por `requireUser` em páginas e actions.
- Sem RLS: toda consulta filtra pelo dono no código.

## 4. Painel (`/dashboard`)

Abas: **Links**, **Aparência** e **Resultados**. Todas as alterações são Server Actions e revalidam a página pública.

### Página e links
- Escolha do endereço (slug): 3–30 caracteres `a-z0-9-`, único, com lista de slugs reservados (`login`, `dashboard`, `go`, `api`, `demo`, `admin`…).
- Links: criar, editar, ativar/desativar, excluir e reordenar (subir/descer).
- Dois tipos: **link** (http/https/tel/mailto validados) e **WhatsApp** (número + mensagem pré-preenchida → `wa.me`).
- Imagem por link (upload).
- **Formato** por link: Botão (miniatura opcional), Destaque (imagem grande em cima) e Bloco (quadrado; blocos seguidos ficam em grade de 2 colunas).
- **Tamanho** por link: Pequeno, Médio e Grande.

### Aparência (com prévia ao vivo num celular)
- Nome, bio e foto de perfil (upload, com opção de remover).
- 6 temas prontos: Claro, Escuro, Pôr do sol, Lima, Oceano, Papel.
- Fundo sólido ou degradê; cores do texto, do botão e do texto do botão.
- 5 estilos de botão: Arredondado, Pílula, Reto, Contorno, Sombra.
- 4 fontes: Moderna, Marcante, Elegante, Máquina.

### Resultados
- Períodos de 7, 30 e 90 dias.
- Visualizações, visitantes únicos, cliques e CTR.
- Gráfico diário (visualizações × cliques), cliques por link, origem do tráfego (Instagram, Facebook, TikTok, Google, direto…) e dispositivo (celular/computador).

## 5. Página pública (`/[slug]`)

- Renderizada no servidor com cache ISR de 60 s, atualizada na hora quando o dono salva no painel.
- Mesmo componente (`PageView`) usado na página pública, na prévia do painel e no `/demo`.
- Cliques passam por `/go/[id]` (registra e redireciona com 302); visualizações são registradas por `/api/view`.
- Imagens servidas por `/media/[id]` com cache imutável.

## 6. Imagens

- Upload de até 2 MB, tipo detectado pelos bytes (PNG, JPEG, WebP, GIF; SVG recusado).
- Guardadas no próprio Postgres (tabela `media`); imagens substituídas são apagadas.

## 7. Analytics e privacidade

- Não guarda IP nem cookies de rastreio: cada visitante vira um hash diário (`APP_SECRET` + dia + perfil + IP + navegador).
- Filtro de robôs, descarte de repetições (visualização: 30 min; clique: 30 s) e limite de 120 eventos por visitante por hora.
- Dias calculados no fuso `America/Sao_Paulo`.

## 8. Playground (`/demo`)

- Testa temas, cores, botões, fontes, formatos, tamanhos e imagens dos links com prévia ao vivo, sem login e sem banco (nada é salvo). Imagens de exemplo em `public/demo/`.

## 9. Banco de dados

- `0001_init.sql`: `users`, `sessions`, `media`, `profiles` (com colunas de aparência), `links` (com `thumbnail_id`) e `events`.
- `0002_link_layout_size.sql`: `links.layout` e `links.size`.
- `0003_auth_security.sql`: `auth_attempts` e `password_resets`.

## 10. Documentação

- [PRD.md](PRD.md) — produto, MVP, requisitos e monetização.
- [BRIEFING-PARCEIRO.md](BRIEFING-PARCEIRO.md) — análise de mercado e pontos para revisão técnica.
- [PERSONALIZACAO-POR-CLIENTE.md](PERSONALIZACAO-POR-CLIENTE.md) e [exemplos/](exemplos/) (barbearia, arquiteta) — personalização por cliente e módulos opcionais.
- `CLAUDE.md` / `AGENTS.md` — arquitetura e convenções para agentes de código.

---

## Ainda não feito

- **Chave própria do Resend** para o Linkbio (hoje usa a do Ambiento; revogar uma afeta os dois produtos).
- Banco separado para os previews (ex.: branch do Neon), se for usar deploys de preview.
- Testes de ponta a ponta (navegador) e de componentes.
- Ícones de redes sociais, arrastar para reordenar, QR code.
- Login por link mágico (o PRD cita, mas hoje é e-mail + senha).
- V2+: captura de leads → robô de leads, Pix/vendas, assinatura, domínio próprio, remoção de marca, painel de agência/white-label, templates por nicho, blocos (vídeo, mapa, cardápio), agendamento de links.
