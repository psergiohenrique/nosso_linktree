// Dados de exemplo para desenvolvimento local. NÃO rode em produção.
// Cria (ou recria) a conta de teste abaixo com página, links e 30 dias de eventos.
//   e-mail: demo@linkbio.test
//   senha:  demo-linkbio-2026
import { randomBytes, scryptSync, createHash } from "node:crypto";
import pg from "pg";

const EMAIL = "demo@linkbio.test";
const PASSWORD = "demo-linkbio-2026";

const salt = randomBytes(16);
const passwordHash = `scrypt$${salt.toString("base64")}$${scryptSync(PASSWORD, salt, 64).toString("base64")}`;

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  await client.query("begin");
  await client.query("delete from users where email = $1", [EMAIL]);
  const {
    rows: [user],
  } = await client.query(
    "insert into users (email, password_hash, email_verified_at) values ($1, $2, now()) returning id",
    [EMAIL, passwordHash],
  );

  await client.query(
    `insert into profiles (id, slug, display_name, bio, bg_type, bg_color, bg_color2, button_style, font)
     values ($1, 'barbearia-demo', 'Barbearia do Zé', 'Corte, barba e cerveja gelada. Seg a sáb, 9h às 20h.',
             'gradient', '#ffe9d6', '#d9dcf6', 'pill', 'bricolage')`,
    [user.id],
  );

  const links = [
    ["whatsapp", "Agendar pelo WhatsApp", "https://wa.me/5511999999999?text=Quero%20agendar", 0.35],
    ["link", "Ver tabela de preços", "https://example.com/precos", 0.18],
    ["link", "Como chegar", "https://maps.google.com", 0.1],
    ["link", "Instagram", "https://instagram.com", 0.06],
  ];
  const linkIds = [];
  for (const [i, [kind, title, url]] of links.entries()) {
    const { rows } = await client.query(
      "insert into links (profile_id, kind, title, url, position) values ($1, $2, $3, $4, $5) returning id",
      [user.id, kind, title, url, i],
    );
    linkIds.push(rows[0].id);
  }

  const sources = ["instagram", "instagram", "instagram", "instagram", "whatsapp", "whatsapp", "direto", "google", "tiktok", "facebook"];
  const cities = [["São Paulo", "SP"], ["São Paulo", "SP"], ["São Paulo", "SP"], ["Guarulhos", "SP"], ["Campinas", "SP"], ["Rio de Janeiro", "RJ"], ["Belo Horizonte", "MG"]];
  const campaigns = [null, null, null, null, ["instagram", "stories", "promo-corte"], ["instagram", "bio", null], ["facebook", "anuncio", "dia-dos-pais"]];
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  let visitor = 0;
  for (let day = 29; day >= 0; day--) {
    const weekend = new Date(Date.now() - day * 864e5).getDay() % 6 === 0;
    const views = Math.round((weekend ? 70 : 40) + Math.random() * 30 + (29 - day) * 1.5);
    for (let v = 0; v < views; v++) {
      const hash = createHash("sha256").update(String(visitor++)).digest("hex").slice(0, 32);
      const at = new Date(Date.now() - day * 864e5 - Math.random() * 12 * 36e5);
      const device = Math.random() < 0.82 ? "mobile" : "desktop";
      const source = pick(sources);
      const [city, region] = pick(cities);
      const [utmSource, utmMedium, utmCampaign] = pick(campaigns) ?? [null, null, null];
      const extra = [city, region, "BR", utmSource, utmMedium, utmCampaign];
      await client.query(
        `insert into events (profile_id, type, source, device, visitor_hash, created_at, city, region, country, utm_source, utm_medium, utm_campaign)
         values ($1, 'view', $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [user.id, source, device, hash, at, ...extra],
      );
      for (const [i, id] of linkIds.entries()) {
        if (Math.random() < links[i][3]) {
          await client.query(
            `insert into events (profile_id, link_id, type, source, device, visitor_hash, created_at, city, region, country, utm_source, utm_medium, utm_campaign)
             values ($1, $2, 'click', $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
            [user.id, id, source, device, hash, new Date(at.getTime() + 20000), ...extra],
          );
        }
      }
    }
  }
  await client.query("commit");
  console.log(`seed ok: ${EMAIL} → /barbearia-demo (${visitor} visitas)`);
} catch (err) {
  await client.query("rollback");
  throw err;
} finally {
  await client.end();
}
