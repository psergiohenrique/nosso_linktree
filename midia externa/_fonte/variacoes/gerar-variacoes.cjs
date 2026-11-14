// Gera variações dos vídeos de texto sobre imagem (UGC) de ./originais.
// Cada variação cobre a legenda original (gravada no vídeo) com um cartão novo: o ffmpeg desfoca a área
// e o Chrome desenha o cartão com o texto (animado quadro a quadro), mantendo a imagem e o áudio originais.
// Uso: FFMPEG=/caminho/ffmpeg node gerar-variacoes.cjs [id…]   (precisa de playwright-core: veja o LEIAME)
const { chromium } = require("playwright-core");
const { spawn, execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const CHROME = process.env.CHROME ?? "/usr/bin/google-chrome";
const FFMPEG = process.env.FFMPEG ?? "ffmpeg";
const FFPROBE = process.env.FFPROBE ?? FFMPEG.replace(/ffmpeg$/, "ffprobe");
const DIR = __dirname;
const SAIDA = path.join(DIR, "..", "..", "video", "variacoes");
const W = 1080, H = 1920;

// Área que cobre a legenda original (medida nos quadros) com folga, e simétrica no eixo x,
// para cobrir também quando o vídeo é espelhado.
const ORIGINAIS = {
  rapaz: { arquivo: "originais/rapaz-suco.mp4", cartao: { x: 105, y: 750, w: 870, h: 610 } },
  moca: { arquivo: "originais/moca-selfie.mp4", cartao: { x: 95, y: 640, w: 890, h: 560 } },
};

const VARIACOES = [
  {
    id: "rapaz-1-pov-direct",
    origem: "rapaz",
    estilo: "vidro",
    html: `
      <p class="t" data-in="0">POV: você parou de responder “onde fica?”, “qual o preço?” e “como agendo?” no direct 😮‍💨</p>
      <p class="s" data-in="0.5">Tá tudo num link só: serviços, localização, Instagram e WhatsApp. 🔗 Linkbio</p>`,
  },
  {
    id: "rapaz-2-baloes-direct",
    origem: "rapaz",
    estilo: "vidro",
    espelhar: true,
    html: `
      <p class="rotulo" data-in="0">seu direct todo santo dia:</p>
      <p class="bolha rec" data-in="0.25">oi, onde fica?</p>
      <p class="bolha rec" data-in="0.7">qual o cardápio??</p>
      <p class="bolha rec" data-in="1.15">como faço pra agendar?</p>
      <p class="bolha env" data-in="1.8">tá tudo no link da bio 😉</p>`,
  },
  {
    id: "rapaz-3-clicar-e-resolver",
    origem: "rapaz",
    estilo: "branco",
    html: `
      <p class="t" data-in="0">Seu cliente não quer mandar mensagem perguntando. Ele quer clicar e resolver.</p>
      <p class="s" data-in="0.6">Cardápio, endereço e WhatsApp num link só → Linkbio</p>`,
  },
  {
    id: "moca-1-numeros",
    origem: "moca",
    estilo: "vidro",
    html: `
      <p class="linha" data-in="0"><b>10</b> posts publicados</p>
      <p class="linha" data-in="1.0"><b>7</b> geraram cliques</p>
      <p class="linha" data-in="1.8"><b>3</b> viraram conversa no WhatsApp</p>
      <p class="t destaque" data-in="3.0">Agora eu sei onde investir 📊</p>
      <p class="s" data-in="3.8">origem, horário e taxa de clique na Linkbio</p>`,
  },
  {
    id: "moca-2-post-curtido",
    origem: "moca",
    estilo: "branco",
    espelhar: true,
    html: `
      <p class="t" data-in="0">eu achando que o post mais curtido era o que mais vendia 🤡</p>
      <p class="s" data-in="1.6">a Linkbio me mostrou de onde vem cada clique que vira conversa no WhatsApp</p>`,
  },
  {
    id: "moca-3-achismo",
    origem: "moca",
    estilo: "vidro",
    html: `
      <p class="t grande" data-in="0">Pare de investir no achismo.</p>
      <p class="s" data-in="0.8">Veja de onde vem cada visita, em que horário clicam e qual campanha (UTM) leva pro seu WhatsApp. 🔗 Linkbio</p>`,
  },
];

const CSS = `
*{box-sizing:border-box;margin:0;padding:0}
html,body{background:transparent;width:${W}px;height:${H}px;overflow:hidden}
body{font-family:'TikTok Sans',sans-serif;-webkit-font-smoothing:antialiased}
.cartao{position:absolute;border-radius:44px;display:flex;flex-direction:column;justify-content:center;gap:26px;padding:48px 54px;text-align:center}
.vidro{background:rgba(12,12,14,.42);color:#fff;box-shadow:inset 0 0 0 2px rgba(255,255,255,.12)}
.vidro p{text-shadow:0 2px 10px rgba(0,0,0,.35)}
.branco{background:#fff;color:#111;box-shadow:0 18px 50px rgba(0,0,0,.25)}
.t{font-size:54px;font-weight:700;line-height:1.22;letter-spacing:-.01em}
.t.grande{font-size:76px;line-height:1.08;font-weight:800}
.t.destaque{font-size:50px;margin-top:6px}
.s{font-size:38px;font-weight:500;line-height:1.3;opacity:.92}
.branco .s{color:#444}
.branco .t{font-size:64px;line-height:1.15}
.branco .s{font-size:42px}
.linha{font-size:46px;font-weight:600}
.linha b{display:inline-block;min-width:1.4em;padding:0 .2em;margin-right:.2em;border-radius:.2em;background:#c8f169;color:#17181a;font-weight:800}
.rotulo{font-size:36px;font-weight:600;opacity:.85;text-align:left}
.bolha{max-width:80%;padding:20px 32px;border-radius:38px;font-size:44px;font-weight:600;text-align:left;line-height:1.2}
.rec{align-self:flex-start;background:rgba(255,255,255,.94);color:#111;border-bottom-left-radius:10px;text-shadow:none!important}
.env{align-self:flex-end;background:#c8f169;color:#17181a;border-bottom-right-radius:10px;text-shadow:none!important}
.vidro .cartao-gap{gap:18px}
`;

const page = (v) => {
  const c = ORIGINAIS[v.origem].cartao;
  const gap = v.html.includes("bolha") ? "gap:18px;" : "";
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=TikTok+Sans:wght@500;600;700;800&display=block" rel="stylesheet">
<style>${CSS}</style></head><body>
<div class="cartao ${v.estilo}" style="left:${c.x}px;top:${c.y}px;width:${c.w}px;height:${c.h}px;${gap}">${v.html}</div>
<script>
const cl=(x)=>Math.min(1,Math.max(0,x));
const out3=x=>1-Math.pow(1-x,3);
const back=x=>{const c=1.7;return 1+(c+1)*Math.pow(x-1,3)+c*Math.pow(x-1,2)};
window.seek=t=>{
  document.querySelectorAll('[data-in]').forEach(el=>{
    const k=+el.dataset.in<=0?1:cl((t-(+el.dataset.in))/.32); // data-in 0: já visível no 1º quadro (capa)
    el.style.opacity=cl(k*2);
    el.style.transform='translateY('+(1-out3(k))*26+'px) scale('+(.9+.1*back(k))+')';
  });
};
</script></body></html>`;
};

function sonda(arquivo) {
  const out = execFileSync(FFPROBE, ["-v", "error", "-select_streams", "v", "-count_frames", "-show_entries", "stream=nb_read_frames,r_frame_rate", "-of", "json", arquivo]);
  const s = JSON.parse(out).streams[0];
  const [a, b] = s.r_frame_rate.split("/").map(Number);
  return { quadros: Number(s.nb_read_frames), fps: a / b };
}

(async () => {
  const filtro = process.argv.slice(2);
  fs.mkdirSync(SAIDA, { recursive: true });
  const browser = await chromium.launch({ executablePath: CHROME });
  const pg = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });

  for (const v of VARIACOES) {
    if (filtro.length && !filtro.includes(v.id)) continue;
    const orig = ORIGINAIS[v.origem];
    const src = path.join(DIR, orig.arquivo);
    const { quadros, fps } = sonda(src);
    const html = path.join(DIR, `_${v.id}.html`);
    fs.writeFileSync(html, page(v));
    await pg.goto("file://" + html, { waitUntil: "networkidle" });
    await pg.evaluate(() => document.fonts.ready);

    // Fundo: espelha (opcional) e desfoca só a área do cartão (com máscara arredondada), onde estava a legenda original.
    const c = orig.cartao;
    const mascara = path.join(DIR, `_${v.id}-mascara.png`);
    execFileSync("convert", ["-size", `${c.w}x${c.h}`, "xc:black", "-fill", "white", "-draw", `roundrectangle 0,0 ${c.w - 1},${c.h - 1} 44,44`, mascara]);
    const base = v.espelhar ? "[0:v]hflip,split[a][b]" : "[0:v]split[a][b]";
    const filter = `${base};[b]crop=${c.w}:${c.h}:${c.x}:${c.y},gblur=sigma=40:steps=3,format=rgba[bl0];[2:v]format=gray[m];[bl0][m]alphamerge[bl];[a][bl]overlay=${c.x}:${c.y}[bg];[bg][1:v]overlay=0:0:format=auto,format=yuv420p[v]`;
    const out = path.join(SAIDA, `${v.id}.mp4`);
    const ff = spawn(FFMPEG, [
      "-y", "-v", "error", "-i", src, "-f", "image2pipe", "-framerate", String(fps), "-i", "-", "-loop", "1", "-i", mascara,
      "-filter_complex", filter, "-map", "[v]", "-map", "0:a?",
      "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-r", String(fps), "-c:a", "copy", "-shortest", "-movflags", "+faststart", out,
    ], { stdio: ["pipe", "inherit", "inherit"] });

    for (let f = 0; f < quadros; f++) {
      await pg.evaluate((t) => window.seek(t), f / fps);
      const buf = await pg.screenshot({ type: "png", omitBackground: true });
      if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once("drain", r));
    }
    ff.stdin.end();
    await new Promise((r) => ff.on("close", r));
    fs.rmSync(html);
    fs.rmSync(mascara);
    console.log("✓", path.relative(path.join(DIR, "..", ".."), out), `${(quadros / fps).toFixed(1)} s`);
  }
  await browser.close();
})();
