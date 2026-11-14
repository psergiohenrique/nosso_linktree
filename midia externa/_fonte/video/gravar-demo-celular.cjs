// Grava o playground (/demo) num celular (390x844), quadro a quadro: toques com o dedo, teclado na tela
// e a prévia em tela cheia. Saída: ./quadros-celular/00000.png … e marcas.json.
// Uso: DEMO_URL=http://localhost:3000/demo node gravar-demo-celular.cjs   (com `npm run dev` rodando)
const { chromium } = require("playwright-core");
const path = require("node:path");
const { prepararSaida, ease, criarQuadros, finalizar } = require("./comum.cjs");

const URL_DEMO = process.env.DEMO_URL ?? "http://localhost:3000/demo";
const CHROME = process.env.CHROME ?? "/usr/bin/google-chrome";
const OUT = path.join(__dirname, "quadros-celular");
const W = 390, H = 844;
const KB_H = 276; // altura do teclado
const TOPO = 150; // onde o campo fica depois de rolar

const CSS = `
nextjs-portal{display:none!important}
body{padding-bottom:${KB_H + 40}px}
*{caret-color:#17181a}
#toque{position:fixed;left:0;top:0;width:52px;height:52px;margin:-26px 0 0 -26px;border-radius:50%;background:rgba(23,24,26,.25);border:3px solid rgba(255,255,255,.95);box-shadow:0 4px 14px rgba(0,0,0,.25);z-index:2147483647;pointer-events:none;opacity:0}
#teclado{position:fixed;left:0;right:0;bottom:0;height:${KB_H}px;z-index:2147483600;background:#d3d5db;padding:0 3px;transform:translateY(100%);font-family:-apple-system,'Helvetica Neue',system-ui,sans-serif;box-shadow:0 -1px 0 rgba(0,0,0,.08)}
.kb-sug{height:40px;display:flex;align-items:center;justify-content:space-around;color:#888;font-size:15px}
.kb-sug i{width:1px;height:22px;background:#b4b6bc}
.kb-row{display:flex;justify-content:center;gap:6px;margin-bottom:11px}
.kb-k{flex:0 0 32px;height:42px;border-radius:5px;background:#fff;box-shadow:0 1px 0 #8a8b8f;display:flex;align-items:center;justify-content:center;font-size:22px;color:#111;transition:none}
.kb-k.s{background:#abb0ba;font-size:16px;flex-basis:44px}
.kb-k.esp{flex:1 1 auto;font-size:16px}
.kb-k.ok{flex-basis:84px;background:#17181a;color:#c8f169;font-weight:700;font-size:16px}
.kb-k.on{background:#c8f169;transform:translateY(-6px) scale(1.25);box-shadow:0 6px 14px rgba(0,0,0,.25);z-index:2}
`;
const LINHAS = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];
const TECLADO = `<div id="teclado"><div class="kb-sug"><span></span><i></i><span></span><i></i><span></span></div>
${LINHAS.map((l, i) => `<div class="kb-row">${i === 2 ? '<span class="kb-k s" data-k="shift">⇧</span>' : ""}${[...l].map((c) => `<span class="kb-k" data-k="${c}">${c}</span>`).join("")}${i === 2 ? '<span class="kb-k s" data-k="del">⌫</span>' : ""}</div>`).join("")}
<div class="kb-row"><span class="kb-k s" data-k="123">123</span><span class="kb-k s" data-k="emoji">🙂</span><span class="kb-k esp" data-k=" ">espaço</span><span class="kb-k" data-k=".">.</span><span class="kb-k ok" data-k="ok">OK</span></div></div>
<div id="toque"></div>`;

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME });
  const img = await prepararSaida(browser, OUT);

  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await page.goto(URL_DEMO, { waitUntil: "networkidle" });
  await page.addStyleTag({ content: CSS });
  await page.evaluate((html) => document.body.insertAdjacentHTML("beforeend", html), TECLADO);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(800);

  const q = criarQuadros(page, OUT);
  const { frame, hold, marca } = q;
  let tecladoAberto = false;

  const dedo = (x, y, opacity, scale = 1) =>
    page.evaluate(([x, y, o, s]) => {
      const d = document.getElementById("toque");
      d.style.left = x + "px"; d.style.top = y + "px"; d.style.opacity = o; d.style.transform = `scale(${s})`;
    }, [x, y, opacity, scale]);

  const tecla = (k) =>
    page.evaluate((k) => {
      document.querySelectorAll(".kb-k.on").forEach((e) => e.classList.remove("on"));
      if (k) document.querySelector(`.kb-k[data-k="${CSS.escape(k)}"]`)?.classList.add("on");
    }, k);

  /** Arrasta a página com o dedo até o scroll indicado. */
  async function arrastar(alvoY, frames = 16) {
    const de = await page.evaluate(() => window.scrollY);
    if (Math.abs(alvoY - de) < 4) return;
    const x = 300, y0 = alvoY > de ? 560 : 260, y1 = alvoY > de ? 260 : 560;
    await dedo(x, y0, 0.9, 1.1);
    await frame();
    for (let i = 1; i <= frames; i++) {
      const k = ease(i / frames);
      await page.evaluate((v) => window.scrollTo(0, v), de + (alvoY - de) * k);
      await dedo(x, y0 + (y1 - y0) * k, 0.9);
      await frame();
    }
    await dedo(x, y1, 0);
    await frame(2);
  }

  /** Garante que o elemento está visível (acima do teclado, se aberto). */
  async function mostrar(loc, comTeclado = tecladoAberto) {
    const b = await loc.boundingBox();
    const limite = H - (comTeclado ? KB_H : 0) - 90;
    if (b.y < 90 || b.y + b.height > limite) {
      const y = await page.evaluate(() => window.scrollY);
      await arrastar(Math.max(0, y + b.y - TOPO));
    }
  }

  async function tocar(loc, depois) {
    await mostrar(loc);
    const b = await loc.boundingBox();
    const x = b.x + Math.min(b.width / 2, 70), y = b.y + b.height / 2;
    await frame(3);
    await dedo(x, y, 0.95, 1.25);
    await frame();
    await dedo(x, y, 0.95, 0.9);
    await frame(2);
    await loc.tap();
    await page.waitForTimeout(150);
    if (depois) await depois();
    await frame(2);
    await dedo(x, y, 0.4, 1.15);
    await frame();
    await dedo(x, y, 0);
    await frame(2);
  }

  async function abrirTeclado() {
    if (tecladoAberto) return;
    for (let i = 1; i <= 8; i++) {
      await page.evaluate((p) => (document.getElementById("teclado").style.transform = `translateY(${p}%)`), 100 * (1 - ease(i / 8)));
      await frame();
    }
    tecladoAberto = true;
  }
  async function fecharTeclado() {
    if (!tecladoAberto) return;
    await tecla("ok");
    await frame(3);
    await tecla(null);
    await page.evaluate(() => document.activeElement?.blur());
    for (let i = 1; i <= 8; i++) {
      await page.evaluate((p) => (document.getElementById("teclado").style.transform = `translateY(${p}%)`), 100 * ease(i / 8));
      await frame();
    }
    tecladoAberto = false;
  }

  async function digitar(loc, texto, porLetra = 2) {
    await mostrar(loc, true); // já deixa o campo acima de onde o teclado vai abrir
    await tocar(loc);
    await abrirTeclado();
    await mostrar(loc);
    await page.keyboard.press("Control+A");
    await tecla("del");
    await page.keyboard.press("Backspace");
    await frame(3);
    for (const ch of texto) {
      const base = ch.normalize("NFD")[0].toLowerCase();
      const k = ch === " " ? " " : /[a-z]/.test(base) ? base : /[.,]/.test(ch) ? "." : /\p{Extended_Pictographic}/u.test(ch) ? "emoji" : "123";
      await tecla(k);
      await page.keyboard.type(ch);
      await frame(porLetra);
    }
    await tecla(null);
    await frame(6);
  }

  async function escolherArquivo(loc, arquivo) {
    await mostrar(loc);
    const [fc] = await Promise.all([page.waitForEvent("filechooser"), tocar(loc)]);
    await fc.setFiles(arquivo);
    await page.waitForTimeout(800);
    await frame(14);
  }

  let rolagemAntes = 0;
  async function abrirPrevia(seg) {
    rolagemAntes = await page.evaluate(() => window.scrollY);
    await tocar(page.locator(".preview-fab"));
    await page.waitForTimeout(250);
    await hold(seg);
  }
  async function fecharPrevia() {
    // como num celular de verdade, a página volta para onde estava
    await tocar(page.locator(".preview-close"), () => page.evaluate((y) => window.scrollTo(0, y), rolagemAntes));
    await frame(4);
  }

  // ── Abertura: o exemplo pronto
  marca("inicio");
  await hold(0.8);

  // ── 1. Perfil: nome, bio e foto
  marca("perfil");
  await tocar(page.getByRole("button", { name: "Aparência", exact: true }));
  await page.waitForTimeout(300);
  await frame(4);
  await digitar(page.getByLabel("Nome", { exact: true }), "Doces da Ana");
  await digitar(page.getByLabel("Bio", { exact: true }), "Bolos e doces por encomenda. Entregamos em toda a cidade 🎂", 1);
  await fecharTeclado();
  await escolherArquivo(page.locator("label.file-btn").first(), img.avatar);
  await abrirPrevia(1.4);
  await fecharPrevia();

  // ── 2. Tema
  marca("tema");
  await tocar(page.locator(".preset", { hasText: "Escuro" }));
  await frame(6);
  await abrirPrevia(1.1);
  await fecharPrevia();
  await tocar(page.locator(".preset", { hasText: "Claro" }));
  await frame(8);

  // ── 3. Links
  marca("links");
  await arrastar(0, 18);
  await tocar(page.getByRole("button", { name: "Links", exact: true }));
  await page.waitForTimeout(300);
  await frame(4);
  const titulos = page.getByLabel("Título");
  await digitar(titulos.nth(0), "Encomendar pelo WhatsApp", 1);
  await digitar(titulos.nth(1), "Cardápio de bolos", 1);
  await fecharTeclado();
  await escolherArquivo(page.locator(".link-thumb-pick").nth(1), img.capa);

  // ── 4. Resultado: abre a prévia e rola a página com o dedo
  marca("pronto");
  await abrirPrevia(0.8);
  const tela = page.locator(".phone-live-screen");
  const max = await tela.evaluate((el) => el.scrollHeight - el.clientHeight);
  const tb = await tela.boundingBox();
  const rolar = async (de, ate, frames) => {
    const x = tb.x + tb.width * 0.75, ya = tb.y + tb.height * (ate > de ? 0.75 : 0.3), yb = tb.y + tb.height * (ate > de ? 0.3 : 0.75);
    for (let i = 1; i <= frames; i++) {
      const k = ease(i / frames);
      await tela.evaluate((el, v) => (el.scrollTop = v), de + (ate - de) * k);
      await dedo(x, ya + (yb - ya) * k, 0.9);
      await frame();
    }
    await dedo(x, yb, 0);
    await frame(4);
  };
  await rolar(0, max, 36);
  await hold(0.5);
  await rolar(max, 0, 24);
  await hold(1.6);
  marca("fim");

  // Posição da prévia do celular (imagem da cena final do vídeo).
  const celular = await page.locator(".phone-live").boundingBox();
  finalizar(OUT, q, { versao: "celular", largura: W, altura: H, celular }, img);
  await browser.close();
})();
