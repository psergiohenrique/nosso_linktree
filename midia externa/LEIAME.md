# Mídia externa — Linkbio by CodePath

Logo e artes prontas para publicar. Cores: grafite `#17181a`, papel `#f4f2ec`, verde-lima `#c8f169`, verde WhatsApp `#1f9d55`. Fontes: Bricolage Grotesque (títulos) e Manrope (texto).

## logo/

| Arquivo | Uso |
| --- | --- |
| `linkbio-simbolo.svg` / `-1024.png` | Símbolo (grafite), fundo transparente |
| `linkbio-simbolo-lima.svg` / `-1024.png` | Símbolo invertido (lima) |
| `linkbio-horizontal-fundo-claro.png` | Logo completa para fundos claros (transparente) |
| `linkbio-horizontal-fundo-escuro.png` | Logo completa para fundos escuros (transparente) |
| `foto-de-perfil-escura-1080.png` | Foto de perfil (Instagram, TikTok, X): as redes recortam em círculo |
| `foto-de-perfil-lima-1080.png` | Variação da foto de perfil |

## instagram/

- `feed-01` a `feed-05`: 1080×1350 (4:5, retrato do feed). Dá para postar como carrossel na ordem.
- `story-01`, `story-02`: 1080×1920. Topo e base (~250 px) ficam livres para a interface do app.

## tiktok/

- `capa-01` a `capa-03`: 1080×1920, capa de vídeo / post de foto. O texto evita a base e a lateral direita, onde ficam os botões do app.

## twitter/ (X)

- `header-1500x500.png`: capa do perfil (o lado esquerdo fica livre para a foto de perfil).
- `post-01`, `post-02`: 1600×900 (16:9), imagem de post.

## video/

Dois vídeos verticais 9:16 (1080×1920, H.264, 30 fps), para Reels, TikTok, Shorts e Stories (no Stories, corte em trechos de até 60 s). Mesmo roteiro: gancho ("Seu link na bio está perdendo clientes?") → problemas → revelação da marca → **demonstração real do `/demo`** montando a página "Doces da Ana" (nome, foto, bio, tema e links) → benefícios → preço e chamada para ação.

- `linkbio-video-vendas-celular-1080x1920.mp4` (51 s): uso **no celular**, dentro de um aparelho, com toques do dedo, teclado na tela e a "Prévia" em tela cheia. Melhor para quem vai criar a página pelo celular, que é a maior parte do público.
- `linkbio-video-vendas-computador-1080x1920.mp4` (46 s): uso **no computador**, com cursor e a prévia do celular atualizando ao lado, e zoom no resultado.
- `linkbio-video-15s-celular-1080x1920.mp4` e `linkbio-video-15s-computador-1080x1920.mp4` (15 s cada): versões curtas para anúncio e Stories (cabem num Story só). Gancho (2 s) → demonstração acelerada com o resultado final mais devagar (9 s) → "Grátis para começar" e chamada final (4 s).
- O áudio é mudo de propósito: adicione uma música em alta no próprio app (Instagram/TikTok), o que também ajuda no alcance.

### video/variacoes/

Variações dos dois vídeos de texto sobre imagem (originais em `_fonte/variacoes/originais/`). A imagem e o áudio são os originais; a legenda antiga fica escondida sob um cartão novo (vidro fosco ou caixa branca, fonte TikTok Sans). As marcadas com ⇄ estão espelhadas, para o vídeo não parecer repetido no feed.

| Arquivo | Duração | Ângulo |
| --- | --- | --- |
| `rapaz-1-pov-direct.mp4` | 3,4 s | POV: parou de responder "onde fica?" no direct |
| `rapaz-2-baloes-direct.mp4` ⇄ | 3,4 s | Balões de direct aparecendo, resposta "tá tudo no link da bio" |
| `rapaz-3-clicar-e-resolver.mp4` | 3,4 s | "Seu cliente quer clicar e resolver" (caixa branca) |
| `moca-1-numeros.mp4` | 6 s | 10 posts → 7 cliques → 3 conversas, linha a linha |
| `moca-2-post-curtido.mp4` ⇄ | 6 s | Meme: "achando que o post mais curtido era o que mais vendia" |
| `moca-3-achismo.mp4` | 6 s | "Pare de investir no achismo" + origem, horário e UTM |

Como são curtos, funcionam em loop (as pessoas releem o texto). Horários de pico, taxa de clique e UTM são do plano Pro.

**Legenda do vídeo** — Seu link na bio está perdendo clientes? 👀 Veja como montar uma página com botão de WhatsApp, tema da sua marca e todos os seus links em poucos minutos. Grátis para começar, 0% de comissão. Crie a sua: linkbio.dev.br

## Legendas sugeridas

**Lançamento** — Chegou o Linkbio: seu link na bio feito para vender no WhatsApp. Botão de WhatsApp em destaque, métricas de cliques e 0% de comissão. Grátis para começar 👉 linkbio.dev.br

**WhatsApp** — Um clique e o cliente já está na conversa. Sem formulário, sem intermediário, sem comissão. Crie a sua página: linkbio.dev.br

**Métricas** — Qual link traz mais cliente: o cardápio, a localização ou o WhatsApp? No Linkbio você vê visitas, cliques e de onde vem cada pessoa, sem guardar IP nem cookies de rastreio.

**Preços** — Grátis com até 5 links. Pro por R$ 5,90/mês no plano anual (ou R$ 9,90 no mensal), com links ilimitados. E 0% de comissão sempre.

**Como funciona** — 1) Crie sua conta 2) Escolha seu endereço 3) Adicione links e publique. Pronto em minutos, sem código e sem designer.

Hashtags: #linknabio #pequenosnegocios #empreendedorismo #whatsappbusiness #vendasonline

As imagens e vídeos já gerados podem conter o endereço antigo; gere novamente e revise as peças antes de publicá-las.

## Editar e gerar de novo

As artes vêm de `_fonte/gerar.mjs` (HTML renderizado pelo Chrome headless; precisa de internet para as fontes):

```bash
node "midia externa/_fonte/gerar.mjs"            # tudo
node "midia externa/_fonte/gerar.mjs" instagram  # só uma parte: logos | instagram | tiktok | twitter
```

Se os preços mudarem em `src/lib/billing.ts`, atualize os textos de `feed-04`, `story-02`, da cena final do vídeo e as legendas.

### Vídeo

Os vídeos são gerados por `_fonte/video/` e precisam de `playwright-core` (não é dependência do projeto), do Chrome e de um `ffmpeg` com libx264:

```bash
npm run dev -- -p 3123                                  # em outro terminal
npm i --no-save --prefix /tmp/vtools playwright-core     # uma vez
cd "midia externa/_fonte/video"
export NODE_PATH=/tmp/vtools/node_modules DEMO_URL=http://localhost:3123/demo

node gravar-demo-celular.cjs                             # grava o /demo no celular (quadros-celular/)
VERSAO=celular FFMPEG=ffmpeg node renderizar.cjs         # gera o MP4 do celular

node gravar-demo-computador.cjs                          # grava o /demo no computador (quadros-computador/)
VERSAO=computador FFMPEG=ffmpeg node renderizar.cjs      # gera o MP4 do computador

VERSAO=celular CURTO=1 FFMPEG=ffmpeg node renderizar.cjs # versão de 15 s (usa os mesmos quadros)
VERSAO=celular node renderizar.cjs 12 30                 # só prévias desses segundos em /tmp
```

O roteiro de cada demonstração fica em `gravar-demo-celular.cjs` e `gravar-demo-computador.cjs` (partes comuns em `comum.cjs`); os textos, a duração das cenas e as transições ficam em `renderizar.cjs`. Depois de gerar, `quadros-*/` (~120 MB cada) e `palco.html` podem ser apagados.

### Variações dos vídeos de texto

Os textos, o estilo e o espelhamento de cada variação ficam na lista `VARIACOES` de `_fonte/variacoes/gerar-variacoes.cjs`; a área coberta de cada original fica em `ORIGINAIS`. Para criar outra, copie um item e troque o `id` e o texto:

```bash
cd "midia externa/_fonte/variacoes"
NODE_PATH=/tmp/vtools/node_modules FFMPEG=ffmpeg node gerar-variacoes.cjs              # todas
NODE_PATH=/tmp/vtools/node_modules FFMPEG=ffmpeg node gerar-variacoes.cjs moca-3-achismo  # só uma
```
