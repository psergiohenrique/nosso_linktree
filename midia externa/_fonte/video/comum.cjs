// Partes comuns aos gravadores do /demo (computador e celular).
const fs = require("node:fs");
const path = require("node:path");

// Imagens de exemplo da "Doces da Ana" (feitas em SVG e convertidas para PNG pelo próprio Chrome).
const AVATAR_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><rect width="200" height="200" fill="#ffd6e0"/>
<rect x="45" y="105" width="110" height="55" rx="10" fill="#7a3e2a"/><rect x="45" y="105" width="110" height="18" rx="9" fill="#fff4f6"/>
<path d="M45 118q14 14 27 0t28 0t27 0t28 0" fill="#fff4f6"/><rect x="58" y="70" width="84" height="40" rx="10" fill="#ff8fab"/>
<rect x="96" y="40" width="8" height="30" rx="4" fill="#ffd166"/><path d="M100 22c8 8 8 16 0 18c-8-2-8-10 0-18z" fill="#ff9f1c"/></svg>`;
const CAPA_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffb3c6"/><stop offset="1" stop-color="#e05780"/></linearGradient></defs>
<rect width="640" height="360" fill="url(#g)"/><g transform="translate(220 50)"><rect x="20" y="120" width="160" height="90" rx="14" fill="#7a3e2a"/><rect x="20" y="120" width="160" height="26" rx="13" fill="#fff"/>
<rect x="45" y="60" width="110" height="64" rx="12" fill="#fff4f6"/><rect x="45" y="60" width="110" height="18" rx="9" fill="#ff8fab"/><circle cx="100" cy="46" r="14" fill="#d00000"/></g>
<text x="320" y="320" fill="#fff" font-family="sans-serif" font-size="30" font-weight="700" text-anchor="middle">Bolos a partir de R$ 60</text></svg>`;

async function svgToPng(browser, svg, w, h, file) {
  const p = await browser.newPage({ viewport: { width: w, height: h } });
  await p.setContent(`<style>*{margin:0}svg{display:block;width:${w}px;height:${h}px}</style>${svg}`);
  await p.screenshot({ path: file });
  await p.close();
}

/** Cria a pasta de saída e as imagens de exemplo (_avatar.png e _capa.png). */
async function prepararSaida(browser, out) {
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(out, { recursive: true });
  const avatar = path.join(out, "_avatar.png");
  const capa = path.join(out, "_capa.png");
  await svgToPng(browser, AVATAR_SVG, 400, 400, avatar);
  await svgToPng(browser, CAPA_SVG, 640, 360, capa);
  return { avatar, capa };
}

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/** Salva quadros numerados (00000.png…) e as marcas de início de cada etapa. */
function criarQuadros(page, out) {
  const q = { n: 0, marcas: {} };
  q.frame = async (repeat = 1) => {
    const file = path.join(out, String(q.n).padStart(5, "0") + ".png");
    await page.screenshot({ path: file });
    q.n++;
    for (let i = 1; i < repeat; i++) {
      fs.copyFileSync(file, path.join(out, String(q.n).padStart(5, "0") + ".png"));
      q.n++;
    }
  };
  q.hold = (s) => q.frame(Math.round(s * 30));
  q.marca = (nome) => (q.marcas[nome] = q.n);
  return q;
}

/** Grava marcas.json e apaga as imagens de exemplo. */
function finalizar(out, q, extra, arquivos) {
  fs.writeFileSync(path.join(out, "marcas.json"), JSON.stringify({ quadros: q.n, marcas: q.marcas, ...extra }, null, 2));
  for (const f of Object.values(arquivos)) fs.rmSync(f);
  console.log(`✓ ${q.n} quadros (${(q.n / 30).toFixed(1)} s)`, q.marcas);
}

module.exports = { prepararSaida, ease, criarQuadros, finalizar };
