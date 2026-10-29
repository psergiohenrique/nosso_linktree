// Gera as artes de "midia externa" a partir de HTML, com o Chrome headless.
// Uso (na raiz do projeto): node "midia externa/_fonte/gerar.mjs"
// Precisa de internet (fontes do Google Fonts) e do google-chrome no PATH (ou CHROME=/caminho).
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CHROME = process.env.CHROME ?? "google-chrome";
const TMP = join(tmpdir(), "linkbio-midia");
mkdirSync(TMP, { recursive: true });

const C = {
  ink: "#17181a",
  inkSoft: "#2a2c2f",
  muted: "#6b6d70",
  paper: "#f4f2ec",
  sand: "#e8e4d8",
  lime: "#c8f169",
  whats: "#1f9d55",
};
const HOST = "linkbio.dev.br";

// ───────── Peças ─────────

const MARK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="${C.ink}"/><rect x="18" y="14" width="10" height="36" rx="5" fill="${C.lime}"/><rect x="18" y="40" width="28" height="10" rx="5" fill="${C.lime}"/></svg>`;
const MARK_SVG_LIME = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="${C.lime}"/><rect x="18" y="14" width="10" height="36" rx="5" fill="${C.ink}"/><rect x="18" y="40" width="28" height="10" rx="5" fill="${C.ink}"/></svg>`;

const mark = (size, svg = MARK_SVG) =>
  `<span style="display:inline-flex;width:${size}px;height:${size}px">${svg.replace("<svg ", `<svg width="${size}" height="${size}" `)}</span>`;

/** Logo horizontal: símbolo + "Linkbio" + "by CodePath". */
const brand = (size = 56, dark = false) => `
  <div class="brand" style="gap:${size * 0.3}px">
    ${mark(size, dark ? MARK_SVG_LIME : MARK_SVG)}
    <span class="brand-name" style="font-size:${size * 0.56}px;color:${dark ? "#fff" : C.ink}">Linkbio</span>
    <span class="brand-by" style="font-size:${size * 0.36}px;color:${dark ? "rgba(255,255,255,.6)" : C.muted}">by CodePath</span>
  </div>`;

const LINKS_PADRAO = ["Ver tabela de preços", "Como chegar", "Instagram"];

/** Celular com uma página de exemplo (mesmo visual do Hero do site). */
const phone = ({
  zoom = 1,
  rotate = 3,
  inicial = "B",
  nome = "Barbearia do Zé",
  bio = "Corte, barba e cerveja gelada. Seg a sáb, 9h às 20h.",
  whats = "💬 Agendar pelo WhatsApp",
  links = LINKS_PADRAO,
  bg = "linear-gradient(180deg,#ffe9d6 0%,#fbdde4 50%,#d9dcf6 100%)",
} = {}) => `
  <div class="phone" style="zoom:${zoom};transform:rotate(${rotate}deg)">
    <div class="phone-screen" style="background:${bg}">
      <div class="phone-avatar">${inicial}</div>
      <p class="phone-name">${nome}</p>
      <p class="phone-bio">${bio}</p>
      <div class="phone-link phone-link-whats">${whats}</div>
      ${links.map((l) => `<div class="phone-link">${l}</div>`).join("")}
      <p class="phone-foot">Feito com Linkbio</p>
    </div>
  </div>`;

const pill = (txt, dark = false, center = false) =>
  `<p class="pill${dark ? " pill-dark" : ""}"${center ? ' style="align-self:center"' : ""}><span class="pill-dot"></span>${txt}</p>`;

const url = (dark = false) => `<p class="url${dark ? " url-dark" : ""}">${HOST}</p>`;

// ───────── Página base ─────────

const CSS = `
*{box-sizing:border-box;margin:0;padding:0}
html,body{background:transparent}
body{font-family:'Manrope',system-ui,sans-serif;color:${C.ink};-webkit-font-smoothing:antialiased;overflow:hidden}
.canvas{position:relative;overflow:hidden;background:${C.paper}}
.canvas.dark{background:${C.ink};color:#fff}
.canvas.lime{background:${C.lime}}
.blob{position:absolute;border-radius:50%;background:radial-gradient(circle,${C.lime} 0%,rgba(200,241,105,0) 65%)}
.d{font-family:'Bricolage Grotesque',system-ui,sans-serif;font-weight:800;letter-spacing:-.04em;line-height:.98}
.em{background:${C.lime};color:${C.ink};padding:0 .1em;border-radius:.1em;-webkit-box-decoration-break:clone;box-decoration-break:clone}
.muted{color:${C.muted}}
.dark .muted{color:rgba(255,255,255,.7)}
.brand{display:flex;align-items:center}
.brand-name{font-family:'Bricolage Grotesque',sans-serif;font-weight:800;letter-spacing:-.02em}
.brand-by{font-weight:600;margin-top:.35em}
.pill{align-self:flex-start;display:inline-flex;align-items:center;gap:.6em;background:#fff;border:2px solid rgba(23,24,26,.1);border-radius:999px;padding:.55em 1.1em;font-weight:700;font-size:30px}
.pill-dark{background:rgba(255,255,255,.08);border-color:rgba(255,255,255,.15);color:#fff}
.pill-dot{width:.5em;height:.5em;border-radius:50%;background:${C.whats}}
.url{font-weight:800;font-size:30px;letter-spacing:-.01em}
.url-dark{color:${C.lime}}
.btn{display:inline-flex;align-items:center;justify-content:center;border-radius:999px;font-weight:800;padding:.8em 1.5em}
.btn-ink{background:${C.ink};color:#fff}
.btn-lime{background:${C.lime};color:${C.ink}}
.phone{width:320px;border-radius:44px;background:${C.ink};padding:12px;box-shadow:0 40px 90px rgba(23,24,26,.28)}
.dark .phone{box-shadow:0 40px 90px rgba(0,0,0,.5);outline:2px solid rgba(255,255,255,.12)}
.phone-screen{border-radius:34px;padding:44px 20px 28px;display:flex;flex-direction:column;align-items:center;gap:10px;min-height:560px;color:${C.ink}}
.phone-avatar{width:76px;height:76px;border-radius:50%;background:${C.ink};color:${C.lime};display:flex;align-items:center;justify-content:center;font-family:'Bricolage Grotesque',sans-serif;font-weight:800;font-size:30px}
.phone-name{font-family:'Bricolage Grotesque',sans-serif;font-weight:800;font-size:19px;margin-top:4px}
.phone-bio{font-size:12.5px;color:#4a4b4e;text-align:center;margin-bottom:14px}
.phone-link{width:100%;border-radius:12px;background:rgba(255,255,255,.85);padding:14px;font-size:13.5px;font-weight:700;text-align:center}
.phone-link-whats{background:${C.whats};color:#fff}
.phone-foot{margin-top:auto;font-size:11px;color:${C.muted}}
.abs{position:absolute}
.col{display:flex;flex-direction:column}
.card{background:#fff;border-radius:36px;border:2px solid rgba(23,24,26,.08)}
.dark .card{background:${C.inkSoft};border-color:rgba(255,255,255,.08)}
`;

const page = (w, h, body, extraCss = "") => `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700;12..96,800&family=Manrope:wght@400;500;600;700;800&display=block" rel="stylesheet">
<style>${CSS}body{width:${w}px;height:${h}px}.canvas{width:${w}px;height:${h}px}${extraCss}</style></head>
<body>${body}</body></html>`;

function render(file, w, h, body, { transparent = false, extraCss = "" } = {}) {
  const out = join(ROOT, file);
  mkdirSync(dirname(out), { recursive: true });
  const html = join(TMP, file.replace(/[\/ ]/g, "_") + ".html");
  writeFileSync(html, page(w, h, body, extraCss));
  const args = [
    "--headless=new",
    "--disable-gpu",
    "--hide-scrollbars",
    "--force-device-scale-factor=1",
    `--window-size=${w},${h}`,
    "--virtual-time-budget=8000",
    `--screenshot=${out}`,
  ];
  if (transparent) args.push("--default-background-color=00000000");
  execFileSync(CHROME, [...args, `file://${html}`], { stdio: "ignore" });
  console.log("✓", file, `${w}x${h}`);
}

// ───────── Logo ─────────

function logos() {
  writeFileSync(join(ROOT, "logo/linkbio-simbolo.svg"), MARK_SVG + "\n");
  writeFileSync(join(ROOT, "logo/linkbio-simbolo-lima.svg"), MARK_SVG_LIME + "\n");

  render("logo/linkbio-simbolo-1024.png", 1024, 1024, mark(1024), { transparent: true });
  render("logo/linkbio-simbolo-lima-1024.png", 1024, 1024, mark(1024, MARK_SVG_LIME), { transparent: true });

  const horiz = (dark) =>
    `<div style="width:1600px;height:400px;display:flex;align-items:center;justify-content:center">${brand(200, dark)}</div>`;
  render("logo/linkbio-horizontal-fundo-claro.png", 1600, 400, horiz(false), { transparent: true });
  render("logo/linkbio-horizontal-fundo-escuro.png", 1600, 400, horiz(true), { transparent: true });

  // Foto de perfil: as redes recortam em círculo, então o símbolo fica centralizado e sem cantos.
  const avatar = (bg, fg) => `
    <div class="canvas" style="background:${bg};display:flex;align-items:center;justify-content:center">
      <svg width="1080" height="1080" viewBox="0 0 64 64">
        <rect x="21" y="17" width="9" height="30" rx="4.5" fill="${fg}"/>
        <rect x="21" y="38" width="23" height="9" rx="4.5" fill="${fg}"/>
      </svg>
    </div>`;
  render("logo/foto-de-perfil-escura-1080.png", 1080, 1080, avatar(C.ink, C.lime));
  render("logo/foto-de-perfil-lima-1080.png", 1080, 1080, avatar(C.lime, C.ink));
}

// ───────── Instagram ─────────

function instagram() {
  const W = 1080, H = 1350;
  const pad = 80;

  // 01 — Lançamento
  render("instagram/feed-01-lancamento.png", W, H, `
    <div class="canvas">
      <div class="blob" style="width:1100px;height:1100px;right:-420px;top:280px"></div>
      <div class="abs" style="left:${pad}px;top:${pad}px">${brand(64)}</div>
      <div class="abs col" style="left:${pad}px;top:230px;width:920px;gap:34px">
        ${pill("Chegou o Linkbio")}
        <h1 class="d" style="font-size:104px">Seu link na bio, feito para <span class="em">vender</span> no WhatsApp</h1>
      </div>
      <div class="abs" style="right:90px;bottom:-150px">${phone({ zoom: 1.25, rotate: 6 })}</div>
      <div class="abs col" style="left:${pad}px;bottom:${pad}px;gap:18px;width:480px">
        <p class="muted" style="font-size:32px;line-height:1.4;font-weight:600">Crie sua página em minutos. Grátis para começar.</p>
        ${url()}
      </div>
    </div>`);

  // 02 — WhatsApp
  render("instagram/feed-02-whatsapp.png", W, H, `
    <div class="canvas dark">
      <div class="abs" style="left:${pad}px;top:${pad}px">${brand(64, true)}</div>
      <div class="abs col" style="left:${pad}px;top:240px;width:920px;gap:36px">
        <h1 class="d" style="font-size:112px">Um clique e o cliente já está no seu <span class="em">WhatsApp</span></h1>
        <p class="muted" style="font-size:36px;line-height:1.45;font-weight:500;max-width:820px">Botão em destaque, mensagem pronta e nada de comissão sobre as suas vendas.</p>
      </div>
      <div class="abs col" style="left:${pad}px;right:${pad}px;bottom:200px;gap:22px">
        <div class="btn" style="background:${C.whats};color:#fff;font-size:44px;padding:36px;border-radius:28px;width:100%">💬 Chamar no WhatsApp</div>
        <div class="btn" style="background:rgba(255,255,255,.1);color:#fff;font-size:36px;padding:30px;border-radius:28px;width:100%;font-weight:700">Ver cardápio</div>
      </div>
      <div class="abs" style="left:${pad}px;bottom:${pad}px">${url(true)}</div>
    </div>`);

  // 03 — Métricas
  const barras = [38, 52, 44, 70, 62, 88, 100];
  render("instagram/feed-03-metricas.png", W, H, `
    <div class="canvas">
      <div class="abs" style="left:${pad}px;top:${pad}px">${brand(64)}</div>
      <div class="abs col" style="left:${pad}px;top:230px;width:920px;gap:30px">
        <h1 class="d" style="font-size:108px">Saiba qual link <span class="em">vende</span> mais</h1>
        <p class="muted" style="font-size:34px;line-height:1.45;font-weight:500">Visitas, cliques e de onde vem cada pessoa: Instagram, TikTok, Google…</p>
      </div>
      <div class="abs card col" style="left:${pad}px;right:${pad}px;bottom:190px;padding:48px;gap:34px">
        <div style="display:flex;justify-content:space-between;align-items:flex-end">
          <div class="col" style="gap:6px"><span class="muted" style="font-size:26px;font-weight:700">Cliques no WhatsApp</span><span class="d" style="font-size:84px">342</span></div>
          <span class="muted" style="font-size:26px;font-weight:700">últimos 7 dias</span>
        </div>
        <div style="display:flex;align-items:flex-end;gap:22px;height:260px">
          ${barras.map((b, i) => `<div style="flex:1;height:${b}%;border-radius:16px;background:${i === barras.length - 1 ? C.lime : C.sand}"></div>`).join("")}
        </div>
      </div>
      <div class="abs" style="left:${pad}px;bottom:${pad}px">${url()}</div>
    </div>`);

  // 04 — Preços
  render("instagram/feed-04-precos.png", W, H, `
    <div class="canvas lime">
      <div class="abs" style="left:${pad}px;top:${pad}px">${brand(64)}</div>
      <div class="abs col" style="left:${pad}px;top:230px;width:920px;gap:30px">
        <h1 class="d" style="font-size:118px">0% de comissão. Sempre.</h1>
        <p style="font-size:36px;line-height:1.45;font-weight:600;color:${C.inkSoft}">O que você vende é seu. Pague só se quiser mais recursos.</p>
      </div>
      <div class="abs" style="left:${pad}px;right:${pad}px;bottom:190px;display:flex;gap:28px">
        <div class="card col" style="flex:1;padding:44px;gap:14px;border:0">
          <span style="font-size:30px;font-weight:800">Grátis</span>
          <span class="d" style="font-size:96px">R$ 0</span>
          <span class="muted" style="font-size:26px;font-weight:600;line-height:1.4">Até 5 links e botão de WhatsApp</span>
        </div>
        <div class="card col" style="flex:1;padding:44px;gap:14px;background:${C.ink};color:#fff;border:0">
          <span style="font-size:30px;font-weight:800;color:${C.lime}">Pro</span>
          <span class="d" style="font-size:96px">R$ 5,90</span>
          <span style="font-size:26px;font-weight:600;line-height:1.4;color:rgba(255,255,255,.7)">por mês no plano anual · links ilimitados</span>
        </div>
      </div>
      <div class="abs" style="left:${pad}px;bottom:${pad}px">${url()}</div>
    </div>`);

  // 05 — Como funciona
  const passos = [
    ["Crie sua conta", "Só e-mail e senha. Sem cartão de crédito."],
    ["Escolha seu endereço", `${HOST}/<b>seunegocio</b>`],
    ["Adicione links e publique", "WhatsApp, cardápio, localização, Instagram."],
  ];
  render("instagram/feed-05-como-funciona.png", W, H, `
    <div class="canvas">
      <div class="blob" style="width:900px;height:900px;left:-380px;bottom:-380px"></div>
      <div class="abs" style="left:${pad}px;top:${pad}px">${brand(64)}</div>
      <div class="abs" style="left:${pad}px;top:230px;width:920px">
        <h1 class="d" style="font-size:108px">Pronta em <span class="em">3 passos</span></h1>
      </div>
      <div class="abs col" style="left:${pad}px;right:${pad}px;top:470px;gap:28px">
        ${passos.map(([t, d], i) => `
          <div class="card" style="display:flex;align-items:center;gap:40px;padding:44px">
            <span class="d" style="flex:none;width:110px;height:110px;border-radius:50%;background:${C.ink};color:${C.lime};display:flex;align-items:center;justify-content:center;font-size:56px">${i + 1}</span>
            <div class="col" style="gap:10px"><span class="d" style="font-size:50px;letter-spacing:-.02em">${t}</span><span class="muted" style="font-size:28px;font-weight:600">${d}</span></div>
          </div>`).join("")}
      </div>
      <div class="abs" style="left:${pad}px;bottom:${pad}px;display:flex;align-items:center;gap:28px">
        <span class="btn btn-ink" style="font-size:32px">Criar minha página</span>${url()}
      </div>
    </div>`);

  // Stories (1080x1920). As faixas de ~250px no topo e embaixo ficam sob a interface do app.
  const SW = 1080, SH = 1920;
  render("instagram/story-01-lancamento.png", SW, SH, `
    <div class="canvas">
      <div class="blob" style="width:1300px;height:1300px;right:-500px;top:620px"></div>
      <div class="abs" style="left:0;right:0;top:260px;display:flex;justify-content:center">${brand(64)}</div>
      <div class="abs col" style="left:90px;right:90px;top:400px;gap:30px;align-items:center;text-align:center">
        <h1 class="d" style="font-size:108px">Seu link na bio, feito para <span class="em">vender</span></h1>
      </div>
      <div class="abs" style="left:0;right:0;top:760px;display:flex;justify-content:center">${phone({ zoom: 1.2, rotate: 0 })}</div>
      <div class="abs col" style="left:0;right:0;bottom:240px;align-items:center;gap:20px">
        <span class="btn btn-ink" style="font-size:38px">Crie grátis 👉 link na bio</span>
      </div>
    </div>`);

  render("instagram/story-02-precos.png", SW, SH, `
    <div class="canvas dark">
      <div class="abs" style="left:0;right:0;top:260px;display:flex;justify-content:center">${brand(64, true)}</div>
      <div class="abs col" style="left:90px;right:90px;top:460px;gap:40px;align-items:center;text-align:center">
        ${pill("Sem comissão sobre vendas", true, true)}
        <h1 class="d" style="font-size:124px">Grátis para começar</h1>
        <p class="muted" style="font-size:40px;line-height:1.45;font-weight:500">Botão de WhatsApp, métricas de cliques e sua página no ar em minutos.</p>
      </div>
      <div class="abs card col" style="left:90px;right:90px;top:1130px;padding:56px;gap:12px;align-items:center;text-align:center">
        <span style="font-size:34px;font-weight:800;color:${C.lime}">Quer mais? Pro por</span>
        <span class="d" style="font-size:140px">R$ 5,90<span style="font-size:48px;letter-spacing:0">/mês</span></span>
        <span class="muted" style="font-size:30px;font-weight:600">no plano anual · links ilimitados</span>
      </div>
      <div class="abs col" style="left:0;right:0;bottom:250px;align-items:center;gap:24px">
        <span class="btn btn-lime" style="font-size:38px">Toque no link da bio</span>
        ${url(true)}
      </div>
    </div>`);
}

// ───────── TikTok ─────────
// Capas 1080x1920. Texto mantido no centro: a interface do TikTok cobre ~400px embaixo e ~160px à direita.

function tiktok() {
  const W = 1080, H = 1920;

  render("tiktok/capa-01-perdendo-clientes.png", W, H, `
    <div class="canvas dark">
      <div class="abs" style="left:90px;top:220px">${brand(60, true)}</div>
      <div class="abs col" style="left:90px;right:170px;top:400px;gap:40px">
        <h1 class="d" style="font-size:136px">Você está <span class="em">perdendo cliente</span> no link da bio?</h1>
        <p class="muted" style="font-size:42px;line-height:1.4;font-weight:600">Veja como resolver em 3 minutos 👇</p>
      </div>
      <div class="abs" style="left:90px;top:1180px">${phone({ zoom: 1.05, rotate: -5 })}</div>
    </div>`);

  render("tiktok/capa-02-3-minutos.png", W, H, `
    <div class="canvas lime">
      <div class="abs" style="left:90px;top:220px">${brand(60)}</div>
      <div class="abs col" style="left:90px;right:170px;top:400px;gap:36px">
        <h1 class="d" style="font-size:150px">Link na bio em 3 minutos</h1>
        <p style="font-size:44px;line-height:1.4;font-weight:700;color:${C.inkSoft}">Com botão de WhatsApp e de graça.</p>
      </div>
      <div class="abs" style="right:140px;top:1060px">${phone({ zoom: 1.15, rotate: 6, inicial: "D", nome: "Doces da Ana", bio: "Bolos e doces por encomenda. Entrega em toda a cidade.", whats: "💬 Encomendar pelo WhatsApp", links: ["Cardápio de bolos", "Preços e sabores", "Onde estamos"] })}</div>
    </div>`);

  render("tiktok/capa-03-zero-comissao.png", W, H, `
    <div class="canvas">
      <div class="blob" style="width:1300px;height:1300px;left:-300px;top:500px"></div>
      <div class="abs" style="left:90px;top:220px">${brand(60)}</div>
      <div class="abs col" style="left:90px;right:170px;top:420px;gap:40px">
        <span class="d" style="font-size:340px;letter-spacing:-.06em;line-height:.85">0%</span>
        <h1 class="d" style="font-size:118px">de comissão sobre as suas vendas</h1>
        <p class="muted" style="font-size:42px;line-height:1.4;font-weight:600">O cliente clica, cai no seu WhatsApp e o dinheiro é todo seu.</p>
      </div>
    </div>`);
}

// ───────── Twitter / X ─────────

function twitter() {
  // Header 1500x500: a foto de perfil cobre o canto inferior esquerdo, então o conteúdo fica à direita.
  render("twitter/header-1500x500.png", 1500, 500, `
    <div class="canvas">
      <div class="blob" style="width:900px;height:900px;right:-200px;top:-300px"></div>
      <div class="abs col" style="left:430px;top:110px;width:640px;gap:22px">
        <h1 class="d" style="font-size:66px">Seu link na bio, feito para <span class="em">vender</span> no WhatsApp</h1>
        <p class="url">${HOST}</p>
      </div>
      <div class="abs" style="right:90px;top:70px">${phone({ zoom: 0.95, rotate: 6 })}</div>
    </div>`);

  const W = 1600, H = 900, pad = 90;
  render("twitter/post-01-lancamento.png", W, H, `
    <div class="canvas">
      <div class="blob" style="width:1000px;height:1000px;right:-260px;top:-160px"></div>
      <div class="abs" style="left:${pad}px;top:${pad - 10}px">${brand(60)}</div>
      <div class="abs col" style="left:${pad}px;top:250px;width:900px;gap:32px">
        <h1 class="d" style="font-size:96px">Seu link na bio, feito para <span class="em">vender</span> no WhatsApp</h1>
        <p class="muted" style="font-size:30px;font-weight:600">Botão de WhatsApp · Métricas de cliques · 0% de comissão</p>
      </div>
      <div class="abs" style="left:${pad}px;bottom:${pad - 10}px">${url()}</div>
      <div class="abs" style="right:150px;top:70px">${phone({ zoom: 1.2, rotate: 5 })}</div>
    </div>`);

  const barras = [38, 52, 44, 70, 62, 88, 100];
  render("twitter/post-02-metricas.png", W, H, `
    <div class="canvas dark">
      <div class="abs" style="left:${pad}px;top:${pad - 10}px">${brand(60, true)}</div>
      <div class="abs col" style="left:${pad}px;top:250px;width:700px;gap:30px">
        <h1 class="d" style="font-size:96px">Saiba qual link <span class="em">vende</span> mais</h1>
        <p class="muted" style="font-size:30px;line-height:1.45;font-weight:500">Visitas, cliques e de onde vem cada pessoa. Sem guardar IP nem cookies de rastreio.</p>
      </div>
      <div class="abs" style="left:${pad}px;bottom:${pad - 10}px">${url(true)}</div>
      <div class="abs card col" style="right:${pad}px;top:200px;width:640px;padding:44px;gap:30px">
        <div class="col" style="gap:6px"><span class="muted" style="font-size:24px;font-weight:700">Cliques no WhatsApp · 7 dias</span><span class="d" style="font-size:80px">342</span></div>
        <div style="display:flex;align-items:flex-end;gap:18px;height:280px">
          ${barras.map((b, i) => `<div style="flex:1;height:${b}%;border-radius:14px;background:${i === barras.length - 1 ? C.lime : "rgba(255,255,255,.14)"}"></div>`).join("")}
        </div>
      </div>
    </div>`);
}

const only = process.argv[2];
for (const [name, fn] of Object.entries({ logos, instagram, tiktok, twitter })) {
  if (!only || only === name) fn();
}
rmSync(TMP, { recursive: true, force: true });
