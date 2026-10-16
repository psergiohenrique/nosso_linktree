# Linkbio — Briefing para o líder técnico

Versão 1.0 · 2026-10-15 · Rascunho para alinhamento (nome da marca provisório)

Este documento reúne (1) a análise de mercado feita no início, (2) o produto do MVP e (3) o que precisa de revisão técnica. O PRD completo está em [PRD.md](PRD.md). A personalização por cliente e os módulos opcionais (barbearia x arquiteta) estão em [PERSONALIZACAO-POR-CLIENTE.md](PERSONALIZACAO-POR-CLIENTE.md).

---

## 1. Contexto

Queremos criar um "link na bio" próprio para **vender como produto** (assinatura). É um projeto pessoal, independente da Cozimax, mas pensado para conversar com o que já temos: a plataforma de venda de sites e o robô de lead management.

## 2. Análise de mercado

### Preços praticados (USD/mês)

| Produto | Free | Pagos (mensal; anual por mês) | Comissão sobre vendas |
|---|---|---|---|
| Linktree | Sim | Starter $8 ($6) · Pro $15 ($12) · Premium $35 ($30) | 12% Free, 9% Starter/Pro, 0% Premium |
| Beacons | Sim | $10 · $30 · $90 | 9% no Free e no Creator |
| Stan Store | Não | $29 | 0% |
| Taplink | Sim | $8 · $16 (anual: $4 · $8) | 0% |
| Bio.link | Sim | $5 | n/d |
| Lnk.Bio | Sim | $0,99/mês ou $9,99–$24,99 vitalício | n/d |
| Carrd | Não | $9–49/ano | n/d |
| Shorby (agências) | Não | $15 · $29 · $99 (Agency) | n/d |

- Ticket padrão para quem só quer links: **US$ 6–15/mês**. Acima de US$ 30 só quando o produto vende.
- Brasil: Tecnoblog e Remessa Online citam o Linktree a R$ 60 / R$ 116 / R$ 340 por mês, sem data confiável. Abre.bio tem plano para agências e "Bio Premium" sob consulta. Linkr.bio estava em reformulação.

**Aviso:** os números vêm de blogs de comparação, que divergem entre si, e os valores em reais dos concorrentes brasileiros não foram confirmados. Conferir nas páginas oficiais antes de decidir preço.

### Dores dos usuários do Linktree
- Contas derrubadas sem aviso e sem suporte humano (quebra QR codes impressos).
- Plano grátis limitado em personalização e analytics.
- Comissão de 9–12% sobre vendas nos planos baixos.
- Problemas de login/captcha e suporte lento.
- Marca do Linktree na página, a menos que se pague.

### Onde podemos ser melhores
**Para o cliente (dono da página):**
1. WhatsApp em primeiro lugar: botão com mensagem pré-pronta, horário de atendimento, vários atendentes.
2. Pix nativo e 0% de comissão.
3. Lead capturado vai direto para o robô de leads (diferencial que concorrente nenhum tem).
4. Analytics que mostra o que gera conversa/lead, não só cliques.
5. Templates por nicho e montagem por IA (Instagram / Google Meu Negócio).
6. Domínio próprio e sem marca d'água no plano pago.
7. Confiança: suporte humano em português, aviso antes de suspender, exportação de dados.

**Para o visitante final:** carrega em menos de 1 s no celular, sem captcha nem pop-up, acha cardápio/agenda/localização em 1 toque, acessível.

**Ecossistema:** site + link na bio + robô de leads vendidos em pacote; painel multi-cliente e white-label para agências.

### Modelo de venda (hipótese a validar)
| Plano | Preço | Destaques |
|---|---|---|
| Grátis | R$ 0 | Links ilimitados, marca d'água, analytics de 7 dias |
| Pro | R$ 19/mês (R$ 15 anual) | Sem marca, analytics 90 dias, agendamento de links |
| Business | R$ 49/mês (R$ 39 anual) | Domínio próprio, leads → robô, Pix, vários atendentes, 3 páginas |
| Agência | R$ 149–199/mês | 10–25 páginas, white-label, painel multi-cliente |

- Cobrança em reais (Pix e cartão); anual com 2 meses grátis; 0% de taxa sobre vendas.
- Bundle: Pro grátis por 12 meses para quem compra site; Business junto do robô de leads.
- Foco de receita: pequenos negócios com WhatsApp e leads, e agências. Criadores de conteúdo têm baixa disposição de pagar.

### Riscos
- Mercado commoditizado com opções gratuitas → diferenciar por WhatsApp, Pix e leads.
- Baixa disposição de pagar de criadores → focar em negócios locais e agências.
- Dependência de regras do Instagram e do WhatsApp.

Fontes consultadas: [Replug — preços do Linktree](https://replug.io/blog/linktree-pricing) · [OptimizePress](https://www.optimizepress.com/linktree-alternatives/) · [QR-Verse](https://qr-verse.com/en/blog/linktree-alternative-guide) · [Stan Store](https://stan.store/blog/linktree-alternatives/) · [Tecnoblog](https://tecnoblog.net/responde/o-que-e-e-como-funciona-o-linktree/) · [Abre.bio](https://lp.abre.bio/) · [HopperHQ](https://hopperhq.com/blog/the-top-5-linktree-alternatives-to-consider)

---

## 3. Produto do MVP

**Dentro do MVP**
1. Cadastro e login por e-mail e senha.
2. Escolha do endereço `dominio/slug` (3–30 caracteres `a-z0-9-`, com lista de nomes reservados).
3. Perfil: nome, bio e foto (upload). Aparência: temas prontos, fundo sólido ou degradê, cores de texto e botões, estilo do botão e fonte, com prévia ao vivo no painel.
4. Links: criar, editar, ativar/desativar, reordenar, excluir. Tipos `link` e `whatsapp` (mensagem pré-preenchida), com imagem opcional por link.
5. Página pública renderizada no servidor, rápida, sem captcha nem pop-up.
6. Analytics: visualizações, visitantes únicos, cliques e taxa de clique por link (7/30/90 dias), gráfico diário, origem das visitas e dispositivo.
7. Validação de URLs (http, https, tel, mailto).

**Fora do MVP (V2+)**
Captura de lead → robô de leads (webhook/API) · Pix e vendas · assinatura e cobrança · domínio próprio e remoção de marca · painel de agência/white-label · templates por nicho e IA · blocos extras (vídeo, mapa, cardápio) · agendamento de links.

**Metas:** primeira página publicada em menos de 5 min · ≥ 60% dos cadastros publicam 1 link · LCP < 1,5 s em 4G · retenção D30 ≥ 40% · conversão free → pago ≥ 4% (hipóteses).

---

## 4. Visão técnica (para revisão)

**Stack:** Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4 · PostgreSQL 16 (`pg`, SQL puro) · Vercel (planejado). Backend dentro do repositório; localmente o Postgres roda em Docker.

**Como funciona**
- `src/app/[slug]` — página pública com cache de 60 s; o painel chama `revalidatePath` ao salvar.
- `src/app/go/[id]` — redireciona (302) e registra o clique.
- `src/app/api/view` — registra a visualização.
- `src/app/media/[id]` — serve as imagens enviadas (guardadas no Postgres).
- `src/app/dashboard` — painel (Links, Aparência, Resultados) via Server Actions.
- `src/server/` — banco, autenticação (senha com scrypt, sessão em cookie httpOnly), upload e analytics.
- `db/migrations/` — `0001_init.sql`: tabelas `users`, `sessions`, `media`, `profiles`, `links`, `events`.

**Decisões de segurança e privacidade**
- Sem RLS: toda consulta filtra pelo dono no código do servidor.
- Upload só de PNG, JPG, WEBP e GIF até 2 MB, com tipo conferido pelo conteúdo (SVG bloqueado).
- Não guardamos IP nem cookie de rastreio: cada visitante vira um hash diário, usado só para contar únicos e descartar repetições (LGPD).
- Eventos filtram robôs, descartam repetições (visualização: 30 min; clique: 30 s) e têm teto por visitante.
- URLs de destino são validadas por protocolo antes do redirecionamento.

**Estado atual — importante**
- `npm run lint` e `npm run build` passam; o fluxo foi testado localmente com dados de exemplo.
- Nenhum teste automatizado. Nada foi implantado ainda.
- Sem recuperação de senha nem limite de tentativas de login.

**Pontos que pedimos para revisar**
1. Autenticação própria (sessões, senha) versus usar um provedor.
2. Imagens no Postgres versus storage de objetos quando o volume crescer.
3. Cache da página pública (ISR) versus registro de visualização via `fetch` no cliente.
4. Estrutura para a V2: webhook para o robô de leads e modelo multi-página para agências.

**Para rodar:** Node.js 20.9+ e Docker, `npm install`, `cp .env.example .env.local`, `npm run db:up`, `npm run db:migrate`, `npm run db:seed` (opcional), `npm run dev`. `/demo` funciona sem banco. Detalhes no [README](../README.md).

---

## 5. Decisões em aberto
- Nome da marca e domínio.
- Gateway de cobrança (Asaas, Pagar.me ou Stripe).
- Integração com o robô de leads: webhook simples ou API compartilhada.
- Hospedagem: Vercel + Postgres gerenciado (Neon, Supabase…) ou VPS própria.
- Validar preços e proposta com cerca de 10 clientes da base atual.

## 6. Sugestão de fluxo de trabalho com o líder técnico
Como ele aprovará os pushes: proteger a branch `main` no GitHub (*Settings → Branches → Add rule*), exigir Pull Request com 1 aprovação, e trabalhar sempre em branches (`feat/...`) com PR para a `main`.
