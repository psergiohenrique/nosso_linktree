// Monta o vídeo de vendas (1080x1920, 30 fps): cenas em HTML animadas quadro a quadro + a gravação real do /demo.
// Antes: grave a demonstração (gravar-demo-computador.cjs ou gravar-demo-celular.cjs).
// Uso: VERSAO=computador|celular [CURTO=1] FFMPEG=/caminho/ffmpeg node renderizar.cjs [segundos-para-prévia…]
// CURTO=1 gera a versão de 15 s: gancho, demonstração acelerada e chamada final.
const { chromium } = require("playwright-core");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const CHROME = process.env.CHROME ?? "/usr/bin/google-chrome";
const FFMPEG = process.env.FFMPEG ?? "ffmpeg";
const DIR = __dirname;
const VERSAO = process.env.VERSAO ?? "computador";
const QUADROS = `quadros-${VERSAO}`;
const CURTO = process.env.CURTO === "1";
const SAIDA = path.join(DIR, "..", "..", "video", `linkbio-video-${CURTO ? "15s" : "vendas"}-${VERSAO}-1080x1920.mp4`);
const FPS = 30, W = 1080, H = 1920;

const demo = JSON.parse(fs.readFileSync(path.join(DIR, QUADROS, "marcas.json"), "utf8"));
const CEL = VERSAO === "celular";
// No celular, a tela gravada aparece dentro de um aparelho: escala da tela e posição do aparelho.
const CEL_S = 1.6, CEL_BORDA = 22, CEL_TOPO = 300;
const DEMO_DUR = demo.quadros / FPS;

// Na versão curta a demonstração é acelerada: a edição (até "pronto") cabe no tempo que sobra e o resultado
// final roda a 2x, para dar tempo de ver a página pronta.
const DEMO_CURTO = 9;
const A = demo.marcas.pronto, B = demo.quadros - A;
const S2 = CURTO ? 2 : 1;
const TB = B / FPS / S2;
const TA = CURTO ? DEMO_CURTO - TB : A / FPS;
const S1 = A / FPS / TA;

// Linha do tempo (segundos)
const T = {};
let t0 = 0;
const CENAS = CURTO
  ? [["gancho", 2.2], ["demo", DEMO_CURTO], ["cta", 3.8]]
  : [["gancho", 3], ["problema", 3.8], ["marca", 3.2], ["pratica", 1.6], ["demo", DEMO_DUR], ["b1", 1.5], ["b2", 1.5], ["b3", 1.5], ["cta", 6]];
for (const [id, dur] of CENAS) {
  T[id] = { inicio: t0, fim: t0 + dur };
  t0 += dur;
}
const TOTAL = t0;
// Cortinas (cor, momento da troca de cena)
const CORTINAS = CURTO
  ? [["#c8f169", T.demo.inicio], ["#17181a", T.cta.inicio]]
  : [
      ["#c8f169", T.problema.inicio],
      ["#17181a", T.marca.inicio],
      ["#c8f169", T.demo.inicio],
      ["#17181a", T.b1.inicio],
      ["#c8f169", T.cta.inicio],
    ];
const LEGENDAS = [
  ["inicio", "", "Comece por um exemplo pronto"],
  ["perfil", "1", "Nome, foto e bio"],
  ["tema", "2", "Escolha um tema"],
  ["links", "3", "Monte seus links"],
  ["pronto", "✓", "Pronto! Sua página no ar"],
]
  .filter(([m]) => !(CURTO && m === "inicio"))
  .map(([m, n, txt]) => ({ q: demo.marcas[m], n, txt }));

const MARK = (s, fundo = "#17181a", traco = "#c8f169") =>
  `<svg width="${s}" height="${s}" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="${fundo}"/><rect x="18" y="14" width="10" height="36" rx="5" fill="${traco}"/><rect x="18" y="40" width="28" height="10" rx="5" fill="${traco}"/></svg>`;

// Palavras que entram uma a uma
const words = (txt, d0, step = 0.09, cls = "") =>
  txt.split(" ").map((w, i) => `<span class="w ${cls}" data-in="${(d0 + i * step).toFixed(2)}">${w}</span>`).join(" ");

const HTML = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,700;12..96,800&family=Manrope:wght@500;600;700;800&display=block" rel="stylesheet">
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{width:${W}px;height:${H}px;overflow:hidden;font-family:Manrope,sans-serif;color:#17181a;-webkit-font-smoothing:antialiased}
.cena{position:absolute;inset:0;display:none;overflow:hidden}
.d{font-family:'Bricolage Grotesque',sans-serif;font-weight:800;letter-spacing:-.04em;line-height:1}
.w{display:inline-block;opacity:0}
.hl{background:linear-gradient(#c8f169,#c8f169) no-repeat 0 0/0% 100%;padding:0 .08em;border-radius:.08em;color:inherit}
.dark .hl{color:#17181a}
.ink{background:#17181a;color:#fff}.paper{background:#f4f2ec}.lime{background:#c8f169}
.blob{position:absolute;border-radius:50%;background:radial-gradient(circle,#c8f169 0%,rgba(200,241,105,0) 65%)}
.centro{position:absolute;left:90px;right:90px;top:0;bottom:0;display:flex;flex-direction:column;justify-content:center;gap:44px}
.muted{color:#6b6d70}.ink .muted{color:rgba(255,255,255,.7)}
.item{display:flex;align-items:center;gap:30px;background:#fff;border-radius:32px;padding:38px 40px;font-size:46px;font-weight:800;opacity:0;box-shadow:0 20px 50px rgba(23,24,26,.08)}
.x{flex:none;width:76px;height:76px;border-radius:50%;background:#c0392b;color:#fff;display:flex;align-items:center;justify-content:center;font-size:44px}
#cortina{position:absolute;left:-30%;top:-10%;width:160%;height:120%;z-index:50;transform:translateX(120%) skewX(-12deg)}
/* demo */
#demo-vp{position:absolute;left:0;right:0;top:300px;bottom:0;overflow:hidden;background:#f4f2ec}
#demo-cam{position:absolute;left:0;top:30px;width:1000px;height:1500px;transform-origin:0 0;border-radius:22px 22px 0 0;overflow:hidden;box-shadow:0 -10px 60px rgba(23,24,26,.18)}
#demo-img{display:block;width:1000px;height:1500px}
#aparelho{position:absolute;left:${(W - (demo.largura * CEL_S + CEL_BORDA * 2)) / 2}px;top:${CEL_TOPO}px;padding:${CEL_BORDA}px;border-radius:78px;background:#17181a;box-shadow:0 50px 110px rgba(23,24,26,.32),inset 0 0 0 3px #3a3c40;transform-origin:50% 50%}
#aparelho img{display:block;width:${demo.largura * CEL_S}px;height:${demo.altura * CEL_S}px;border-radius:56px}
#legenda{position:absolute;left:70px;right:70px;top:120px;display:flex;align-items:center;gap:26px}
#leg-n{flex:none;width:96px;height:96px;border-radius:50%;background:#17181a;color:#c8f169;display:flex;align-items:center;justify-content:center;font-size:52px}
#leg-txt{font-size:72px}
.btn{display:inline-flex;align-items:center;justify-content:center;border-radius:999px;font-weight:800;padding:34px 60px;font-size:46px}
#cel-final{position:absolute;overflow:hidden;border-radius:52px;box-shadow:0 50px 100px rgba(23,24,26,.3)}
</style></head><body>

<section class="cena ink dark" id="gancho">
  <div class="centro">
    <p class="d" style="font-size:150px">${words("Seu link na bio", 0.1)} ${words("está", 0.5)} <span class="hl" data-hl="0.9">${words("perdendo clientes?", 0.7)}</span></p>
    <p class="muted" style="font-size:44px;font-weight:600"><span class="w" data-in="1.6">🤔 Presta atenção…</span></p>
  </div>
</section>

<section class="cena paper" id="problema">
  <div class="centro" style="gap:30px">
    <p class="d" style="font-size:96px;margin-bottom:20px">${words("Link na bio comum:", 0.15)}</p>
    <div class="item" data-in="0.7" data-fx="slam"><span class="x">✕</span>Lista sem graça</div>
    <div class="item" data-in="1.25" data-fx="slam"><span class="x">✕</span>Cliente não acha seu WhatsApp</div>
    <div class="item" data-in="1.8" data-fx="slam"><span class="x">✕</span>Você não sabe o que funciona</div>
  </div>
</section>

<section class="cena lime" id="marca">
  <div class="centro" style="align-items:center;text-align:center;gap:40px">
    <div id="marca-mark" style="opacity:0">${MARK(260)}</div>
    <div class="w d" data-in="0.55" style="font-size:150px;letter-spacing:-.05em">Linkbio</div>
    <p class="d" style="font-size:78px;line-height:1.05">${words("Seu link na bio feito para", 1.0, 0.07)} <span class="w" data-in="1.45" style="background:#17181a;color:#c8f169;padding:0 .12em;border-radius:.1em">vender</span> ${words("no WhatsApp", 1.55, 0.07)}</p>
  </div>
</section>

<section class="cena ink dark" id="pratica">
  <div class="centro" style="align-items:center;text-align:center;gap:30px">
    <p class="d" style="font-size:130px">${words("Veja na prática", 0.05, 0.1)} <span class="w" data-in="0.4">👇</span></p>
    <p class="muted" style="font-size:46px;font-weight:600"><span class="w" data-in="0.6">${CEL ? "Tudo pelo celular, em poucos minutos" : "Uma página pronta em minutos"}</span></p>
  </div>
</section>

<section class="cena paper" id="demo">
  <div id="legenda"><span id="leg-n" class="d"></span><span id="leg-txt" class="d"></span></div>
  ${CEL ? `<div class="blob" style="width:1300px;height:1300px;left:-110px;top:420px"></div><div id="aparelho"><img id="demo-img" alt=""></div>` : `<div id="demo-vp"><div id="demo-cam"><img id="demo-img" alt=""></div></div>`}
</section>

<section class="cena ink dark" id="b1">
  <div class="centro" style="align-items:center;text-align:center">
    <div class="w" data-in="0" data-fx="slam" style="font-size:220px">💬</div>
    <p class="d" style="font-size:118px">${words("Botão de", 0.15)} <span class="hl" data-hl="0.45">${words("WhatsApp", 0.3)}</span> ${words("em destaque", 0.4)}</p>
  </div>
</section>
<section class="cena lime" id="b2">
  <div class="centro" style="align-items:center;text-align:center">
    <div class="w" data-in="0" data-fx="slam" style="font-size:220px">📊</div>
    <p class="d" style="font-size:118px">${words("Saiba qual link vende mais", 0.15)}</p>
  </div>
</section>
<section class="cena paper" id="b3">
  <div class="centro" style="align-items:center;text-align:center;gap:10px">
    <div class="w d" data-in="0" data-fx="slam" style="font-size:420px;letter-spacing:-.06em">0%</div>
    <p class="d" style="font-size:104px">${words("de comissão sobre as suas vendas", 0.2, 0.07)}</p>
  </div>
</section>

<section class="cena paper" id="cta">
  <div class="blob" style="width:1400px;height:1400px;left:-160px;top:380px"></div>
  <div style="position:absolute;left:0;right:0;top:150px;display:flex;flex-direction:column;align-items:center;gap:26px;text-align:center">
    <div class="w" data-in="0.05" style="display:flex;align-items:center;gap:20px">${MARK(84)}<span class="d" style="font-size:60px;letter-spacing:-.02em">Linkbio</span></div>
    <p class="d" style="font-size:112px">${words("Grátis para começar", 0.2, 0.1)}</p>
  </div>
  <div id="cel-final"><img id="cel-img" alt=""></div>
  <div style="position:absolute;left:0;right:0;bottom:300px;display:flex;flex-direction:column;align-items:center;gap:26px">
    <span class="w btn" data-in="0.9" id="cta-btn" style="background:#17181a;color:#fff">Crie a sua página agora</span>
    <span class="w" data-in="1.1" style="font-size:44px;font-weight:800">linkbio.dev.br</span>
    <span class="w muted" data-in="1.3" style="font-size:30px;font-weight:600">Pro a partir de R$ 5,90/mês no plano anual · sem comissão</span>
  </div>
</section>

<div id="cortina"></div>

<script>
const FPS=${FPS}, T=${JSON.stringify(T)}, CORTINAS=${JSON.stringify(CORTINAS)}, LEG=${JSON.stringify(LEGENDAS)}, DEMO=${JSON.stringify(demo)};
// tempo da cena ↔ quadro da gravação (acelerado na versão curta)
const QA=${A}, TA=${TA}, S1=${S1}, S2=${S2};
const qOf=lt=>lt<TA?lt*FPS*S1:QA+(lt-TA)*FPS*S2;
const tOf=q=>q<QA?q/FPS/S1:TA+(q-QA)/FPS/S2;
const cl=(x,a=0,b=1)=>Math.min(b,Math.max(a,x));
const prog=(t,a,d)=>cl((t-a)/d);
const out3=x=>1-Math.pow(1-x,3);
const io3=x=>x<.5?4*x*x*x:1-Math.pow(-2*x+2,3)/2;
const back=x=>{const c=1.9;return 1+(c+1)*Math.pow(x-1,3)+c*Math.pow(x-1,2)};
const lerp=(a,b,k)=>a+(b-a)*k;
const CEL=${CEL};
const frameSrc=i=>'${QUADROS}/'+String(Math.max(0,Math.min(DEMO.quadros-1,i))).padStart(5,'0')+'.png';

function anim(cena,lt){
  cena.querySelectorAll('[data-in]').forEach(el=>{
    const k=prog(lt,+el.dataset.in,el.dataset.fx==='slam'?.32:.38);
    if(el.dataset.fx==='slam'){
      el.style.opacity=k>0?1:0;
      el.style.transform='scale('+lerp(1.6,1,back(k))+') rotate('+lerp(-4,0,out3(k))+'deg)';
    }else{
      el.style.opacity=cl(k*2.2);
      el.style.transform='translateY('+(1-out3(k))*70+'px) scale('+lerp(.85,1,back(k))+')';
    }
  });
  cena.querySelectorAll('[data-hl]').forEach(el=>{
    el.style.backgroundSize=(io3(prog(lt,+el.dataset.hl,.4))*100)+'% 100%';
  });
}

const extra={
  gancho(lt){ // leve zoom contínuo
    document.querySelector('#gancho .centro').style.transform='scale('+lerp(1,1.06,lt/3)+')';
  },
  marca(lt){
    const k=prog(lt,.05,.5), m=document.getElementById('marca-mark');
    m.style.opacity=k>0?1:0;
    m.style.transform='scale('+lerp(0,1,back(k))+') rotate('+lerp(-90,0,out3(k))+'deg)';
  },
  demo(lt){
    const q=Math.floor(qOf(lt));
    const img=document.getElementById('demo-img');
    img.src=frameSrc(q);
    // legenda atual
    let i=0; LEG.forEach((l,j)=>{ if(q>=l.q) i=j; });
    const l=LEG[i], k=prog(lt,tOf(l.q),.35);
    const n=document.getElementById('leg-n'), tx=document.getElementById('leg-txt');
    n.textContent=l.n; n.style.display=l.n?'flex':'none';
    tx.textContent=l.txt;
    document.getElementById('legenda').style.cssText+=';opacity:'+cl(k*2)+';transform:translateY('+(1-out3(k))*50+'px)';
    const ke=out3(prog(lt,0,.6));
    document.getElementById('demo').style.transform='scale('+lerp(1.08,1,ke)+')';
    const kz=io3(prog(q,DEMO.marcas.pronto-6,22));
    if(CEL){
      // aparelho sobe ao entrar e dá um zoom leve no resultado
      const ap=document.getElementById('aparelho');
      ap.style.transform='translateY('+(1-ke)*120+'px) scale('+lerp(1,1.1,kz)+')';
      return;
    }
    // câmera: largura total; no fim, zoom no celular
    const cam=document.getElementById('demo-cam');
    const base=${W}/DEMO.largura, c=DEMO.celular;
    // celular centralizado entre a legenda e a faixa de baixo (onde ficam os botões do app)
    const alvo=1300/c.height;
    const s=lerp(base,alvo,kz);
    const cx=c.x+c.width/2;
    const tx1=${W}/2-cx*alvo, ty1=(1400-1300)/2-c.y*alvo-30;
    cam.style.transform='translate('+lerp(0,tx1,kz)+'px,'+lerp(0,ty1,kz)+'px) scale('+s+')';
    cam.style.borderRadius=lerp(22,0,kz)+'px';
    cam.style.boxShadow=kz>0?'none':'';
  },
  b1(lt){document.querySelector('#b1 .centro').style.transform='scale('+lerp(1,1.05,lt/1.5)+')'},
  b2(lt){document.querySelector('#b2 .centro').style.transform='scale('+lerp(1,1.05,lt/1.5)+')'},
  b3(lt){document.querySelector('#b3 .centro').style.transform='scale('+lerp(1,1.05,lt/1.5)+')'},
  cta(lt){
    const c=DEMO.celular, s=874/c.height, box=document.getElementById('cel-final');
    const w=c.width*s, h=c.height*s;
    const k=prog(lt,.35,.6);
    box.style.cssText='left:'+((${W}-w)/2)+'px;top:'+(440+(1-out3(k))*500)+'px;width:'+w+'px;height:'+h+'px;opacity:'+cl(k*2)+';transform:rotate('+lerp(10,3,out3(k))+'deg)';
    const img=document.getElementById('cel-img');
    img.src=frameSrc(DEMO.quadros-1);
    img.style.cssText='position:absolute;width:'+DEMO.largura*s+'px;left:'+(-c.x*s)+'px;top:'+(-c.y*s)+'px';
    // botão pulsando
    const p=lt>1.3?1+.04*Math.sin((lt-1.3)*Math.PI*2/0.9):1;
    const b=document.getElementById('cta-btn');
    if(lt>1.3) b.style.transform='scale('+p+')';
  },
};

window.seek=async function(t){
  for(const id in T){
    const el=document.getElementById(id), on=t>=T[id].inicio&&t<T[id].fim;
    el.style.display=on?'block':'none';
    if(on){ const lt=t-T[id].inicio; anim(el,lt); extra[id]&&extra[id](lt); }
  }
  // cortina: entra antes da troca, sai depois
  const cort=document.getElementById('cortina'); let x=120, cor='#c8f169';
  for(const [c,tc] of CORTINAS){
    const k=prog(t,tc-.28,.56);
    if(k>0&&k<1){ x=lerp(120,-120,io3(k)); cor=c; }
  }
  cort.style.background=cor;
  cort.style.transform='translateX('+x+'%) skewX(-12deg)';
  await Promise.all([...document.images].filter(i=>i.src&&i.offsetParent!==null).map(i=>i.decode().catch(()=>{})));
};
</script></body></html>`;

(async () => {
  fs.writeFileSync(path.join(DIR, "palco.html"), HTML);
  const browser = await chromium.launch({ executablePath: CHROME });
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  await page.goto("file://" + path.join(DIR, "palco.html"), { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);

  // Modo prévia: node renderizar.cjs 12.5 → salva só esse quadro em /tmp
  const previa = process.argv.slice(2).map(Number).filter((n) => !Number.isNaN(n));
  if (previa.length) {
    for (const s of previa) {
      await page.evaluate((t) => window.seek(t), s);
      await page.screenshot({ path: `/tmp/previa-${s}.png` });
    }
    console.log("prévias em /tmp/previa-*.png · duração total", TOTAL.toFixed(1), "s");
    await browser.close();
    return;
  }

  fs.mkdirSync(path.dirname(SAIDA), { recursive: true });
  const ff = spawn(FFMPEG, [
    "-y", "-f", "image2pipe", "-framerate", String(FPS), "-i", "-",
    "-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=48000",
    "-shortest", "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", SAIDA,
  ], { stdio: ["pipe", "ignore", "inherit"] });

  const N = Math.round(TOTAL * FPS);
  for (let f = 0; f < N; f++) {
    await page.evaluate((t) => window.seek(t), f / FPS);
    const buf = await page.screenshot({ type: "png" });
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once("drain", r));
    if (f % 150 === 0) console.log(`quadro ${f}/${N}`);
  }
  ff.stdin.end();
  await new Promise((r) => ff.on("close", r));
  await browser.close();
  console.log("✓", SAIDA, TOTAL.toFixed(1) + " s");
})();
