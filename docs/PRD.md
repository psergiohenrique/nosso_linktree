# PRD — Linkbio by CodePath

Plataforma de "link na bio" para pequenos negócios e agências brasileiras. Produto da CodePath (https://codepath.dev.br), independente da Cozimax, mas pensado para integrar com o ecossistema (sites + robô de leads). Endereço: **bio.codepath.dev.br** (páginas dos clientes em `bio.codepath.dev.br/<slug>`).

Status: rascunho v0.2 · 2026-10-16 · publicado em bio.codepath.dev.br.

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
1. Cadastro/login por e-mail e senha, com recuperação de senha por e-mail e limite de tentativas.
2. Escolha do endereço `dominio/slug`.
3. Perfil: nome, bio e foto (upload). Aparência: temas prontos, fundo sólido ou degradê, cores de texto e botões, estilo do botão e fonte, com prévia ao vivo no painel.
4. Links: criar, editar, ativar/desativar, reordenar, excluir. Tipo `link` e tipo `whatsapp` (mensagem pré-preenchida). Imagem opcional por link (upload).
5. Página pública renderizada no servidor, rápida, sem captcha ou pop-up.
6. Analytics: visualizações, visitantes únicos, cliques e CTR por link (7/30/90 dias), gráfico diário, origem e dispositivo; filtro de robôs e repetições. Conversas no WhatsApp, comparação com o período anterior e resumo semanal por e-mail. No Pro: origem por link, horários de pico, cidades, campanhas UTM e CSV.
7. Slugs reservados e validação de URLs (http/https/tel/mailto).

Personalização por cliente e módulos opcionais: veja [PERSONALIZACAO-POR-CLIENTE.md](PERSONALIZACAO-POR-CLIENTE.md).

**Fora do MVP (V2+):**
- Captura de lead com envio ao robô de leads (webhook/API).
- Pix e cobrança de serviços; vendas.
- Domínio próprio (plano Business).
- Painel de agência multi-cliente, white-label.
- Templates por nicho e montagem por IA (Instagram / Google Meu Negócio).
- Login por link mágico (sem senha).
- Blocos (vídeo, mapa, cardápio), agendamento de links.

## 5. Requisitos funcionais (resumo)

| ID | Requisito | Critério de aceite |
|---|---|---|
| F1 | Login por e-mail e senha | Usuário cria conta, entra no painel e redefine a senha por um link enviado ao e-mail (válido por 1 h, uso único) |
| F2 | Criar página | Slug único, 3–30 caracteres `a-z0-9-`, não reservado |
| F3 | CRUD de links | Alterações refletem na página pública em até 60 s |
| F4 | Botão WhatsApp | Abre `wa.me/<número>?text=<mensagem>` |
| F5 | Redirecionamento rastreado | `/go/<id>` registra clique e redireciona (302) |
| F6 | Visualização | Cada abertura registra 1 visualização |
| F7 | Relatório | Painel mostra visualizações, cliques, CTR e cliques por link |

## 6. Requisitos não funcionais

- Segurança: backend próprio sem RLS — toda consulta filtra pelo dono no código do servidor; nenhuma credencial no cliente; eventos registrados só pelo servidor (`/go/[id]` e `/api/view`); limite de tentativas em login, cadastro e recuperação de senha.
- Privacidade (LGPD): não guardar IP nem cookie de rastreio; guardar só referrer e tipo de dispositivo.
- Performance: página pública com cache (ISR 60 s), zero JS pesado.
- Acessibilidade: contraste AA, navegação por teclado.

## 7. Monetização

Grátis e Pro implementados (cobrança pelo Asaas, cartão recorrente; detalhes em [ESTADO-ATUAL.md](ESTADO-ATUAL.md#11-planos-e-cobrança-paywall)). Business e Agência seguem como hipótese.

| Plano | Preço | Destaques |
|---|---|---|
| Grátis | R$ 0 | Até 5 links, selo “Feito com Linkbio”, resultados de 7 dias |
| Pro | R$ 9,90/mês ou R$ 70,80/ano (R$ 5,90/mês) | Links ilimitados, Destaque e Bloco, sem selo, resultados de 30 e 90 dias, métricas avançadas (origem por link, horários, cidades, campanhas, CSV) |
| Business (hipótese) | R$ 49/mês (R$ 39 anual) | Domínio próprio, leads → robô, Pix, 3 páginas |
| Agência (hipótese) | R$ 149–199/mês | 10–25 páginas, white-label |

Bundle: Pro grátis por 12 meses para quem compra site (já suportado por `courtesy_until`); Business junto do robô de leads. Taxa 0% sobre vendas.

## 8. Riscos

- Mercado commoditizado com opções grátis → diferenciar por WhatsApp/Pix/leads.
- Baixa disposição de pagar de criadores → focar em negócios locais e agências.
- Dependência de regras do Instagram/WhatsApp.

## 9. Marcos

1. M0 — Validar proposta e preço com ~10 clientes da base de sites.
2. M1 — MVP (este repositório): página pública + painel + analytics.
3. M2 — Assinatura Pro (feito, falta ligar em produção); leads → robô, Pix.
4. M3 — Agências / white-label.

## 10. Questões em aberto

- Nome e domínio próprios no futuro (por ora: Linkbio by CodePath em bio.codepath.dev.br).
- Gateway de cobrança: decidido Asaas (mesma conta do Ambiento).
- Modelo de integração com o robô (webhook simples vs. API compartilhada).
- Hospedagem (Vercel + Postgres gerenciado vs. VPS própria).
