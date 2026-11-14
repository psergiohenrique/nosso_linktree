import sharp from "sharp";
import { beforeAll, describe, expect, it, vi } from "vitest";

const ID = "123e4567-e89b-12d3-a456-426614174000";
const store: { current: { mime: string; bytes: Buffer } | null } = { current: null };

vi.mock("@/server/media", () => ({ getMedia: async () => store.current }));

import { GET } from "@/app/media/[id]/route";

const call = (query: string, accept = "image/webp,image/*") =>
  GET(new Request(`http://localhost/media/${ID}${query}`, { headers: { accept } }), { params: Promise.resolve({ id: ID }) });

let big: Buffer;
beforeAll(async () => {
  // Foto grande e cheia de detalhe, como uma foto de celular.
  const noise = Buffer.alloc(2400 * 1800 * 3);
  for (let i = 0; i < noise.length; i++) noise[i] = (i * 2654435761) >>> 24;
  big = await sharp(noise, { raw: { width: 2400, height: 1800, channels: 3 } }).jpeg({ quality: 90 }).toBuffer();
  store.current = { mime: "image/jpeg", bytes: big };
});

describe("GET /media/[id]", () => {
  it("sem largura entrega o arquivo original", async () => {
    const res = await call("");
    expect(res.headers.get("content-type")).toBe("image/jpeg");
    expect(Buffer.from(await res.arrayBuffer()).equals(big)).toBe(true);
  });

  it("com largura devolve WebP menor e na largura pedida", async () => {
    const res = await call("?w=480");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/webp");
    expect(res.headers.get("cache-control")).toContain("immutable");
    const out = Buffer.from(await res.arrayBuffer());
    expect(out.length).toBeLessThan(big.length / 5);
    expect((await sharp(out).metadata()).width).toBe(480);
  });

  it("não aumenta imagem pequena", async () => {
    store.current = { mime: "image/png", bytes: await sharp({ create: { width: 200, height: 100, channels: 3, background: "#c8f169" } }).png().toBuffer() };
    const res = await call("?w=960");
    const out = Buffer.from(await res.arrayBuffer());
    expect((await sharp(out).metadata()).width).toBeLessThanOrEqual(200);
    store.current = { mime: "image/jpeg", bytes: big };
  });

  it("recusa largura fora da lista", async () => {
    expect((await call("?w=100")).status).toBe(400);
    expect((await call("?w=abc")).status).toBe(400);
  });

  it("entrega o original para navegador sem WebP e para GIF", async () => {
    expect((await call("?w=480", "image/png")).headers.get("content-type")).toBe("image/jpeg");
    store.current = { mime: "image/gif", bytes: Buffer.from("GIF89a-teste") };
    expect((await call("?w=480")).headers.get("content-type")).toBe("image/gif");
    store.current = { mime: "image/jpeg", bytes: big };
  });

  it("responde 404 sem imagem", async () => {
    store.current = null;
    expect((await call("?w=480")).status).toBe(404);
    store.current = { mime: "image/jpeg", bytes: big };
  });
});
