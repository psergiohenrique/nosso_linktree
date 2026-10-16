# PRD — Linkbio (nome provisório)

Plataforma de "link na bio" para pequenos negócios e agências brasileiras. Projeto pessoal, independente da Cozimax, mas pensado para integrar com o ecossistema (sites + robô de leads).

Status: rascunho v0.1 · 2026-10-15 · apenas local, nada publicado.

## 1. Problema

Pequenos negócios divulgam o Instagram/WhatsApp com uma página de links. As opções atuais:
- Linktree: free limitado, marca d'água, comissão de 9–12% sobre vendas nos planos baixos, suporte fraco, relatos de contas derrubadas sem aviso.
- Ferramentas nacionais: pouca clareza de preço e pouca integração com WhatsApp/Pix/CRM.

O dono do negócio quer **gerar conversa (WhatsApp) e lead**, não só "ter links". Hoje não vê qual link converte.

## 2. Público

| Persona | Necessidade |
|---|---|
| Dono de pequeno negócio (barbearia, clínica, restaurante, loja, profissional liberal) | Página bonita em minutos, botão de WhatsApp forte, saber o que gera contato |
| Agência / revendedor | Gerenciar páginas de vários clientes, white-label |
| Visitante final (vem do Instagram/TikTok) | Página rápida no celular, achar o que procura em 1 toque |

## 3. Objetivos e métricas

- Tempo para publicar a primeira página: **< 5 min**.
- Ativação: ≥ 60% dos cadastros publicam ao menos 1 link.
- LCP da página pública **< 1,5 s** em 4G.
- Retenção D30 ≥ 40%; conversão free → pago ≥ 4% (hipótese).

## 4. Escopo do MVP (V1)

**Dentro:**
1. Cadastro/login por e-mail (link mágico).
2. Escolha do endereço `dominio/slug`.
3. Perfil: nome, bio, avatar e imagem de capa (por URL), tema (claro/escuro/pôr do sol/areia), cor de destaque.
4. Links: criar, editar, ativar/desativar, reordenar, excluir. Tipo `link` e tipo `whatsapp` (mensagem pré-preenchida). Sugestões de título por segmento (serviços, portfólio, comércio, redes sociais).
5. Página pública renderizada no servidor, rápida, sem captcha ou pop-up.
6. Analytics: visualizações e cliques por link (7/30 dias), origem (referrer) e dispositivo.
7. Slugs reservados e validação de URLs (http/https/tel/mailto).

**Fora do MVP (V2+):**
- Captura de lead com envio ao robô de leads (webhook/API).
- Pix e cobrança de serviços; vendas.
- Domínio próprio, remoção de marca, assinatura (Stripe/Pagar.me/Asaas).
- Painel de agência multi-cliente, white-label.
- Templates por nicho e montagem por IA (Instagram / Google Meu Negócio).
- Upload de avatar (V1 usa URL), blocos (vídeo, mapa, cardápio), agendamento de links.

## 5. Requisitos funcionais (resumo)

| ID | Requisito | Critério de aceite |
|---|---|---|
| F1 | Login por e-mail | Usuário recebe link e entra no painel |
| F2 | Criar página | Slug único, 3–30 caracteres `a-z0-9-`, não reservado |
| F3 | CRUD de links | Alterações refletem na página pública em até 60 s |
| F4 | Botão WhatsApp | Abre `wa.me/<número>?text=<mensagem>` |
| F5 | Redirecionamento rastreado | `/go/<id>` registra clique e redireciona (302) |
| F6 | Visualização | Cada abertura registra 1 visualização |
| F7 | Relatório | Painel mostra visualizações, cliques, CTR e cliques por link |

## 6. Requisitos não funcionais

- Segurança: RLS em todas as tabelas; sem chave de serviço no cliente; registro de eventos só via função `track_event`.
- Privacidade (LGPD): não guardar IP nem cookie de rastreio; guardar só referrer e tipo de dispositivo.
- Performance: página pública com cache (ISR 60 s), zero JS pesado.
- Acessibilidade: contraste AA, navegação por teclado.

## 7. Monetização (hipótese, validar)

| Plano | Preço | Destaques |
|---|---|---|
| Grátis | R$ 0 | Links ilimitados, marca, analytics 7 dias |
| Pro | R$ 19/mês (R$ 15 anual) | Sem marca, analytics 90 dias, agendamento |
| Business | R$ 49/mês (R$ 39 anual) | Domínio próprio, leads → robô, Pix, 3 páginas |
| Agência | R$ 149–199/mês | 10–25 páginas, white-label |

Bundle: Pro grátis por 12 meses para quem compra site; Business junto do robô de leads. Taxa 0% sobre vendas.

## 8. Riscos

- Mercado commoditizado com opções grátis → diferenciar por WhatsApp/Pix/leads.
- Baixa disposição de pagar de criadores → focar em negócios locais e agências.
- Dependência de regras do Instagram/WhatsApp.

## 9. Marcos

1. M0 — Validar proposta e preço com ~10 clientes da base de sites.
2. M1 — MVP (este repositório): página pública + painel + analytics.
3. M2 — Leads → robô, Pix, assinatura.
4. M3 — Agências / white-label.

## 10. Questões em aberto

- Nome da marca e domínio.
- Gateway de cobrança (Asaas, Pagar.me, Stripe).
- Modelo de integração com o robô (webhook simples vs. API compartilhada).
- Hospedagem (Vercel + Supabase vs. VPS própria).
