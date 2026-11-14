// Grava o playground (/demo) no computador, quadro a quadro, com cursor falso, para o vídeo de vendas.
// Saída: ./quadros-computador/00000.png … e marcas.json (início de cada etapa, em quadros).
// Uso: DEMO_URL=http://localhost:3000/demo node gravar-demo-computador.cjs   (com `npm run dev` rodando)
const { chromium } = require("playwright-core");
const path = require("node:path");
const { prepararSaida, ease, criarQuadros, finalizar } = require("./comum.cjs");

const URL_DEMO = process.env.DEMO_URL ?? "http://localhost:3000/demo";
const CHROME = process.env.CHROME ?? "/usr/bin/google-chrome";
const OUT = path.join(__dirname, "quadros-computador");
const W = 1000, H = 1500;

const CURSOR_CSS = `
#fake-cursor{position:fixed;left:0;top:0;width:34px;height:34px;z-index:2147483647;pointer-events:none;transform-origin:4px 4px;transition:none}
#fake-cursor svg{filter:drop-shadow(0 3px 6px rgba(0,0,0,.35))}
#fake-ring{position:fixed;width:56px;height:56px;margin:-28px 0 0 -28px;border-radius:50%;border:4px solid #c8f169;z-index:2147483646;pointer-events:none;opacity:0}
nextjs-portal{display:none!important}
*{caret-color:#17181a}`;
const CURSOR_HTML = `<div id="fake-ring"></div><div id="fake-cursor"><svg width="34" height="34" viewBox="0 0 24 24"><path d="M4 2l15 11-6.5 1 3.8 7.2-2.6 1.4-3.8-7.3L4 19z" fill="#fff" stroke="#17181a" stroke-width="1.6" stroke-linejoin="round"/></svg></div>`;

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME });
  const img = await prepararSaida(browser, OUT);

  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  await page.goto(URL_DEMO, { waitUntil: "networkidle" });
  await page.addStyleTag({ content: CURSOR_CSS });
  await page.evaluate((html) => document.body.insertAdjacentHTML("beforeend", html), CURSOR_HTML);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(800);

  const q = criarQuadros(page, OUT);
  const { frame, hold, marca } = q;
  let cur = { x: 640, y: 1300 };

  const setCursor = (x, y, scale = 1) =>
    page.evaluate(([x, y, s]) => {
      const c = document.getElementById("fake-cursor");
      c.style.transform = `translate(${x - 4}px,${y - 4}px) scale(${s})`;
    }, [x, y, scale]);

  async function moveTo(loc, frames = 14) {
    await loc.scrollIntoViewIfNeeded();
    const b = await loc.boundingBox();
    const to = { x: b.x + Math.min(b.width / 2, 60), y: b.y + b.height / 2 };
    const from = { ...cur };
    for (let i = 1; i <= frames; i++) {
      const k = ease(i / frames);
      await setCursor(from.x + (to.x - from.x) * k, from.y + (to.y - from.y) * k);
      await page.mouse.move(from.x + (to.x - from.x) * k, from.y + (to.y - from.y) * k);
      await frame();
    }
    cur = to;
  }
  async function click(loc, opts) {
    await moveTo(loc);
    await setCursor(cur.x, cur.y, 0.82);
    await page.evaluate(([x, y]) => {
      const r = document.getElementById("fake-ring");
      r.style.left = x + "px"; r.style.top = y + "px"; r.style.opacity = "1";
    }, [cur.x, cur.y]);
    await loc.click(opts);
    await frame(3);
    await setCursor(cur.x, cur.y, 1);
    await page.evaluate(() => (document.getElementById("fake-ring").style.opacity = "0"));
    await page.waitForTimeout(120);
    await frame(3);
  }
  async function typeInto(loc, text, perChar = 2) {
    await click(loc);
    await page.keyboard.press("Control+A");
    await page.keyboard.press("Backspace");
    await frame(4);
    for (const ch of text) {
      await page.keyboard.type(ch);
      await frame(perChar);
    }
    await frame(6);
  }
  async function scrollTo(y, frames = 18) {
    const from = await page.evaluate(() => window.scrollY);
    for (let i = 1; i <= frames; i++) {
      await page.evaluate((v) => window.scrollTo(0, v), from + (y - from) * ease(i / frames));
      await frame();
    }
  }

  // ── Abertura: o exemplo pronto
  marca("inicio");
  await setCursor(cur.x, cur.y);
  await hold(0.8);

  // ── 1. Perfil: nome, bio e foto
  marca("perfil");
  await click(page.getByRole("button", { name: "Aparência", exact: true }));
  await page.waitForTimeout(300);
  await frame(4);
  await typeInto(page.getByLabel("Nome", { exact: true }), "Doces da Ana");
  await typeInto(page.getByLabel("Bio", { exact: true }), "Bolos e doces por encomenda. Entregamos em toda a cidade 🎂", 1);
  await moveTo(page.getByText("Trocar foto"));
  await page.locator('input[type=file][name="avatar"]').setInputFiles(img.avatar);
  await page.waitForTimeout(700);
  await frame(16);

  // ── 2. Tema
  marca("tema");
  for (const nome of ["Escuro", "Oceano", "Lima", "Claro"]) {
    await click(page.locator(".preset", { hasText: nome }));
    await page.waitForTimeout(150);
    await frame(nome === "Claro" ? 14 : 8);
  }

  // ── 3. Links
  marca("links");
  await scrollTo(0, 10);
  await click(page.getByRole("button", { name: "Links", exact: true }));
  await page.waitForTimeout(300);
  await frame(4);
  const titulos = page.getByLabel("Título");
  await typeInto(titulos.nth(0), "Encomendar pelo WhatsApp", 1);
  await typeInto(titulos.nth(1), "Cardápio de bolos", 1);
  await moveTo(page.locator(".link-thumb-pick").nth(1));
  await page.locator('input[type=file][aria-label="Imagem do link"]').nth(1).setInputFiles(img.capa);
  await page.waitForTimeout(500);
  await frame(14);
  await typeInto(titulos.nth(4), "Ver avaliações no Google", 1);
  await scrollTo(0, 16);

  // ── 4. Resultado: rola a prévia do celular
  marca("pronto");
  await moveTo(page.locator(".phone-live-screen"), 16);
  await hold(0.4);
  const tela = page.locator(".phone-live-screen");
  const max = await tela.evaluate((el) => el.scrollHeight - el.clientHeight);
  for (let i = 1; i <= 40; i++) {
    await tela.evaluate((el, v) => (el.scrollTop = v), max * ease(i / 40));
    await frame();
  }
  await hold(0.6);
  for (let i = 1; i <= 24; i++) {
    await tela.evaluate((el, v) => (el.scrollTop = v), max * (1 - ease(i / 24)));
    await frame();
  }
  await hold(0.9);
  // Sem cursor nos últimos quadros: o último vira a imagem do celular no fim do vídeo.
  await page.evaluate(() => (document.getElementById("fake-cursor").style.display = "none"));
  await hold(0.5);
  marca("fim");

  // Posição da prévia do celular (zoom no fim da demo e imagem da cena final).
  const celular = await page.locator(".phone-live").boundingBox();
  finalizar(OUT, q, { versao: "computador", largura: W, altura: H, celular }, img);
  await browser.close();
})();
