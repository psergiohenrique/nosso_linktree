# Linkbio by CodePath — O que já está feito

Retrato do projeto em 2026-10-16. Produto e escopo em [PRD.md](PRD.md); como rodar em [../README.md](../README.md).

**Resumo:** o MVP funciona de ponta a ponta: cadastro → criação da página → links → aparência → página pública → métricas, com recuperação de senha e limite de tentativas. **Publicado em https://bio.codepath.dev.br** (2026-10-16). Há testes automatizados (Vitest) para validação, origem do tráfego, limite de tentativas, recuperação de senha e cobrança. Plano Grátis + Pro com cobrança pelo Asaas **ligada em produção** (2026-10-21).

**Marca e endereço:** produto da CodePath — "Linkbio by CodePath" no logo, rodapé, SEO/JSON-LD (`Organization` CodePath como publisher) e imagem de compartilhamento. Endereço de produção: `https://bio.codepath.dev.br` (via `NEXT_PUBLIC_SITE_URL`; o prefixo do endereço no painel sai dessa variável).

**Banco de produção:** Postgres no Neon, com as migrações 0001–0006 aplicadas (sem seed).

**Hospedagem:** projeto `nosso_linktree` na Vercel, ligado ao repositório (push na `main` publica). Domínio `bio.codepath.dev.br` (DNS de codepath.dev.br já é da Vercel). Variáveis só no ambiente Production: `DATABASE_URL`, `APP_SECRET`, `NEXT_PUBLIC_SITE_URL`, `RESEND_API_KEY`, `MAIL_FROM`, `BILLING_ENABLED` (`true`), `ASAAS_API_URL` (produção), `ASAAS_API_KEY` (a de produção, compartilhada com o Ambiento), `ASAAS_WEBHOOK_TOKEN`, `CRON_SECRET`. A Vercel trata as variáveis de produção como sensíveis: `vercel env pull` as traz vazias. Previews não têm banco (de propósito, para não tocar no de produção). `.vercelignore` impede que o `vercel deploy` envie arquivos `.env*`.

**E-mail:** Resend, na mesma conta usada pelo Ambiento (chave compartilhada com o `ambiento-backend`), onde `codepath.dev.br` já está verificado (região sa-east-1). Remetente: `Linkbio by CodePath <nao-responda@codepath.dev.br>`. Envio de recuperação de senha testado em produção.

**Cobrança (paywall):** ligada em produção desde 2026-10-21, na conta Asaas do Ambiento. Antes, testada de ponta a ponta contra o sandbox. Primeiro pagamento real em 2026-10-21 (Pro mensal de `leticiamoraes`, mantido como assinatura de verdade): eventos processados na primeira tentativa, Pro ativo e selo removido. Ver seção 11.

---

## 1. Stack e infraestrutura

- Next.js 16 (App Router) · React 19 · TypeScript · CSS global com variáveis (Tailwind v4 instalado, mas não usado para estilo).
- PostgreSQL 16 via `pg` com SQL puro; backend dentro do repositório (`src/server/`).
- Postgres local em Docker (`docker-compose.yml`, porta 5435).
- Scripts: `db:up`, `db:migrate` (aplica `db/migrations/*.sql` em ordem, controlado por `schema_migrations`), `db:seed` (conta de teste com página e 30 dias de acessos), `test` (testes de unidade) e `test:db` (inclui os testes com o Postgres local).
- Variáveis de ambiente: `DATABASE_URL`, `APP_SECRET`, `NEXT_PUBLIC_SITE_URL` e, para enviar e-mail, `RESEND_API_KEY` e `MAIL_FROM` (`.env.example`).
- Vercel Analytics e Speed Insights já integrados; cabeçalhos de segurança centralizados em `next.config.ts`.

## 2. Site de marketing (`/`)

- Landing com seções: Nav, Hero, StatsBar, Recursos, Como funciona, Planos, CTA e Footer.
- **Seção de preços** (`#planos`, link no menu e no rodapé): três cartões (Grátis R$ 0, Pro mensal R$ 9,90/mês, Pro anual R$ 5,90/mês = R$ 70,80/ano, “Mais vantajoso”, economia de 40%), tabela comparativa Grátis × Pro e 7 perguntas frequentes. Preços e limites vêm de `src/lib/billing.ts`. Com a cobrança desligada, mostra o aviso “Lançamento: todos os recursos do Pro liberados sem custo”. Os três planos também estão no JSON-LD (`offers`). Posicionamento definido a partir de Linktree, Beacons, Taplink, Lnk.bio, Abre.bio, Viber.Bio, Linkme e Linkhiver (out/2026). Preço baixado para R$ 9,90 / R$ 5,90 (2026-10-16): abaixo do Abre.bio (R$ 19,90/R$ 189,90) e do Linkhiver (R$ 17), na faixa do Linkme.
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

Abas: **Links**, **Aparência**, **Resultados** e **Plano** (esta só com a cobrança ligada). Todas as alterações são Server Actions e revalidam a página pública.

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
- **Conversas no WhatsApp** (cliques em links do tipo WhatsApp) em destaque e variação de cada número contra o período anterior de mesmo tamanho (taxa de clique em pontos percentuais).
- **Só no Pro** (`getAdvancedStats`): origem de quem clica em cada link (o clique herda origem e UTM da última visualização do mesmo visitante), horários de pico (dia da semana × hora, fuso de Brasília), cidades (cabeçalhos `x-vercel-ip-*` da Vercel), campanhas (`utm_source`/`utm_medium`/`utm_campaign` da URL da página) e exportação CSV (`/dashboard/resultados/csv?days=`, separador `;` com BOM para o Excel). No Grátis aparece um cartão de upsell.
- **Resumo semanal por e-mail** (Grátis e Pro): cron `/api/cron/weekly-report` toda segunda às 9h de Brasília (`0 12 * * 1`, `CRON_SECRET`) manda os 7 dias até ontem comparados à semana anterior, link mais clicado e principal origem, para contas com visitas na semana. Ligado por padrão (`users.weekly_report`); `weekly_report_sent_at` impede envio duplicado. Desliga pelo painel ou pelo link do e-mail (`/api/resumo/sair`, assinado com HMAC do `APP_SECRET`, com `List-Unsubscribe` de um clique).

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
- Cidade, estado e país vêm dos cabeçalhos de geolocalização da Vercel e são guardados só como nome (sem IP). Migração `0005_metrics.sql`.
- **PostHog** (analytics do produto, para nós): no navegador só carrega no site (`/`, `/login`, `/demo`) e no painel (`instrumentation-client.ts`); o painel identifica o usuário e captura eventos dos formulários. As páginas públicas dos clientes ficam sem PostHog e sem cookie: cada visita e clique que entra no banco também vai ao PostHog pelo servidor (`bio_page_viewed` / `bio_link_clicked`, `src/server/posthog-events.ts`, via `after()`), com `distinct_id` = dono da página, sem IP nem código do visitante e com GeoIP desligado. Logs OTLP de checkout/cancelamento em `src/server/posthog-logs.ts`. Variáveis: `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN` e `NEXT_PUBLIC_POSTHOG_HOST`.

## 8. Playground (`/demo`)

- Testa temas, cores, botões, fontes, formatos, tamanhos e imagens dos links com prévia ao vivo, sem login e sem banco (nada é salvo). Imagens de exemplo em `public/demo/`.

## 9. Banco de dados

- `0001_init.sql`: `users`, `sessions`, `media`, `profiles` (com colunas de aparência), `links` (com `thumbnail_id`) e `events`.
- `0002_link_layout_size.sql`: `links.layout` e `links.size`.
- `0003_auth_security.sql`: `auth_attempts` e `password_resets`.
- `0004_billing.sql`: `subscriptions`, `invoices` e `billing_events`.

## 10. Documentação

- [PRD.md](PRD.md) — produto, MVP, requisitos e monetização.
- [BRIEFING-PARCEIRO.md](BRIEFING-PARCEIRO.md) — análise de mercado e pontos para revisão técnica.
- [PERSONALIZACAO-POR-CLIENTE.md](PERSONALIZACAO-POR-CLIENTE.md) e [exemplos/](exemplos/) (barbearia, arquiteta) — personalização por cliente e módulos opcionais.
- `CLAUDE.md` / `AGENTS.md` — arquitetura e convenções para agentes de código.

## 11. Planos e cobrança (paywall)

Mesmo desenho do Ambiento (Asaas, checkout hospedado, só o webhook muda o estado), adaptado para Grátis + Pro.

| | Grátis | Pro |
|---|---|---|
| Preço | R$ 0 | R$ 9,90/mês ou R$ 70,80/ano = R$ 5,90/mês (cartão, renovação automática) |
| Links | até 5 (a página mostra os 5 primeiros ativos) | ilimitados |
| Formatos Destaque e Bloco | não (aparecem como botão) | sim |
| Resultados | 7 dias | 7, 30 e 90 dias |
| Conversas no WhatsApp, comparação e resumo semanal | sim | sim |
| Origem por link, horários de pico, cidades, campanhas e CSV | não | sim |
| Selo “Feito com Linkbio” | sim | não |

- **Paywalls (só no Grátis com a cobrança ligada):** o recurso aparece e, ao tentar usar, abre um aviso (`src/components/Paywall.tsx`, montado no layout do painel; textos em `src/lib/paywall.ts`) com o que o Pro inclui, os preços e botões Anual/Mensal que já abrem o checkout. Gatilhos: formatos Destaque/Bloco (com prévia do formato num celular), botão Adicionar no 6º link, 30/90 dias, Exportar CSV, métricas avançadas (aparecem borradas com dados de exemplo) e o interruptor do selo em Aparência (a prévia fica sem selo enquanto o aviso está aberto). O servidor continua barrando tudo. Eventos PostHog: `paywall_viewed` (com `feature`) e `pro_checkout_started`.
- **Checkout:** `/dashboard/plano` → “Assinar mensal/anual” abre o checkout do Asaas (cartão recorrente, `externalReference = linkbio:<userId>`). Na volta, a tela recarrega sozinha até o webhook confirmar.
- **Webhook:** `POST /api/asaas/webhook`, autenticado pelo cabeçalho `asaas-access-token` (`ASAAS_WEBHOOK_TOKEN`). Cada evento entra em `billing_events` (id único = entrega repetida ignorada) e é processado na hora; falhas são tentadas de novo (1 min, 5 min, 30 min, 2 h, 6 h) nas próximas entregas e no cron.
- **De quem é o evento:** customer do Asaas já conhecido, `externalReference`, id do checkout e id da assinatura. Em produção, a cobrança e a assinatura nascidas do checkout chegam com `externalReference` null, e o `CHECKOUT_PAID` com `customer` null: o primeiro pagamento só se liga ao usuário pelo `checkoutSession`. Por isso `billing_checkouts` (migração `0006`) guarda todo checkout aberto, e não só o último: o link de um checkout anterior ainda pode ser pago.
- **Conta Asaas compartilhada com o Ambiento** (mesma chave de API), e todo webhook recebe os eventos da conta inteira. Evento com referência sem `linkbio:` ou com checkout que não está em `billing_checkouts` é do outro produto: marcado como processado, sem efeito e sem erro. O Ambiento faz o mesmo com os eventos do Linkbio. Revogar a chave derruba a cobrança dos dois.
- **Estados:** ativo até o fim do período pago (+3 dias de folga para a renovação); cobrança recusada → 7 dias de carência ainda no Pro; cancelado → Pro até o fim do período; depois, volta ao Grátis sem apagar nada. Calculados na leitura.
- **Trocar de ciclo ou de cartão / reativar:** novo checkout; a primeira cobrança só acontece quando o período pago acaba, e a assinatura antiga é encerrada no Asaas quando a nova nasce (nunca cobra duas vezes).
- **Cortesia:** `subscriptions.courtesy_until` dá Pro grátis até uma data (ex.: pacote com site), definido por SQL.
- **E-mails:** pagamento confirmado e cobrança recusada (com prazo da carência).
- **Cron diário** (`vercel.json`, 06h de Brasília): reprocessa eventos pendentes e encerra carências vencidas (cancela no Asaas).
- **Testado em produção (sandbox), 2026-10-16:** limite de 5 links, página com selo, checkout aberto no Asaas, eventos reais (`PAYMENT_CONFIRMED` antes de `SUBSCRIPTION_CREATED`) ativando o Pro, 6º link e Destaque liberados, 90 dias de resultados, selo removido, cancelamento pelo painel refletido no Asaas (`SUBSCRIPTION_DELETED`). O preenchimento do checkout em si não pôde ser automatizado (reCAPTCHA); a assinatura foi criada pela API com os mesmos dados.

**Em produção desde 2026-10-21:**
1. Na Vercel (Production): `ASAAS_API_KEY` = chave de produção do Asaas (a mesma do Ambiento), `ASAAS_API_URL=https://api.asaas.com/v3`, `ASAAS_WEBHOOK_TOKEN` novo e `BILLING_ENABLED=true`.
2. Webhook "Linkbio - produção" cadastrado no Asaas: URL `https://bio.codepath.dev.br/api/asaas/webhook`, token = `ASAAS_WEBHOOK_TOKEN`, eventos `CHECKOUT_PAID`, `SUBSCRIPTION_CREATED/DELETED/INACTIVATED` e `PAYMENT_CREATED/CONFIRMED/RECEIVED/CREDIT_CARD_CAPTURE_REFUSED/OVERDUE/REFUNDED/DELETED`.
3. Conferido: o webhook responde 401 sem token e 200 com o token; no Asaas, os webhooks do Linkbio e do Ambiento estão ativos e sem pausa.

**Ordem importa:** com `BILLING_ENABLED` diferente de `true`, o webhook responde 404, e o Asaas pausa a fila (`interrupted`) depois de falhas seguidas. Se a cobrança for desligada, desative o webhook no Asaas antes; ao religar, ligue a cobrança primeiro e o webhook depois. Fila pausada se retoma pelo painel ou com `PUT /v3/webhooks/{id}` (`interrupted: false`).

---

## Ainda não feito

- **Primeiro pagamento real em produção:** feito em 2026-10-21 (ver o resumo no topo). Falta ver uma renovação (20/11) e, um dia, um estorno e um cancelamento reais.
- **Chave do Asaas própria** para o Linkbio, se quiser revogar uma sem derrubar o outro produto (hoje é a mesma do Ambiento).
- Plano Business (domínio próprio, leads → robô, Pix) e Agência.
- **Chave própria do Resend** para o Linkbio (hoje usa a do Ambiento; revogar uma afeta os dois produtos).
- Banco separado para os previews (ex.: branch do Neon), se for usar deploys de preview.
- Testes de ponta a ponta (navegador) e de componentes.
- Ícones de redes sociais, arrastar para reordenar, QR code.
- Login por link mágico (o PRD cita, mas hoje é e-mail + senha).
- V2+: captura de leads → robô de leads, Pix/vendas, domínio próprio, painel de agência/white-label, templates por nicho, blocos (vídeo, mapa, cardápio), agendamento de links.
