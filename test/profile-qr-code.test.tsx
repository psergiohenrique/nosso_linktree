import { renderToStaticMarkup } from "react-dom/server";
import jsQR from "jsqr";
import { PNG } from "pngjs";
import { describe, expect, it } from "vitest";
import ProfileQRCode from "@/components/ProfileQRCode";
import { SITE_URL } from "@/lib/site";

async function render(slug: string) {
  return renderToStaticMarkup(await ProfileQRCode({ slug }));
}

describe("QR code da página", () => {
  it("exibe e permite baixar um PNG que abre o endereço atual", async () => {
    const html = await render("minha-pagina");
    const url = `${SITE_URL}/minha-pagina`;
    expect(html).toContain(`href="${url}"`);
    expect(html).toContain(`alt="QR code para ${url}"`);
    expect(html).toContain('download="qrcode-minha-pagina.png"');
    const images = [...html.matchAll(/data:image\/png;base64,([A-Za-z0-9+/=]+)/g)];
    expect(images.length).toBeGreaterThanOrEqual(2);
    expect(images[0][1]).toBe(images[1][1]);
    const png = PNG.sync.read(Buffer.from(images[0][1], "base64"));
    expect(png.width).toBe(512);
    expect(jsQR(new Uint8ClampedArray(png.data), png.width, png.height)?.data).toBe(url);
  });

  it("gera um novo código quando o endereço muda", async () => {
    const before = await render("primeiro");
    const after = await render("segundo");
    const image = after.match(/data:image\/png;base64,([A-Za-z0-9+/=]+)/)?.[1];
    expect(image).toBeDefined();
    const png = PNG.sync.read(Buffer.from(image!, "base64"));
    expect(jsQR(new Uint8ClampedArray(png.data), png.width, png.height)?.data).toBe(`${SITE_URL}/segundo`);
    expect(before).not.toContain('download="qrcode-segundo.png"');
  });
});
