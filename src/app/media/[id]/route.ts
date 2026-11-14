import sharp from "sharp";
import { parseMediaWidth } from "@/lib/media-variants";
import { getMedia } from "@/server/media";

const UUID = /^[0-9a-f-]{36}$/i;

const HEADERS = {
  "Cache-Control": "public, max-age=31536000, immutable",
  "Content-Security-Policy": "default-src 'none'; sandbox",
};

// Cada envio gera um id novo, então o conteúdo de um id nunca muda: cache longo.
// Com `?w=` devolve uma versão menor em WebP (só larguras da lista em src/lib/media-variants.ts).
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const media = UUID.test(id) ? await getMedia(id) : null;
  if (!media) return new Response("Não encontrado", { status: 404 });

  const rawWidth = new URL(request.url).searchParams.get("w");
  const width = parseMediaWidth(rawWidth);
  if (rawWidth !== null && width === null) return new Response("Largura inválida", { status: 400 });

  const original = () =>
    new Response(new Uint8Array(media.bytes), { headers: { ...HEADERS, "Content-Type": media.mime, Vary: "Accept" } });

  // Sem largura, GIF (perderia a animação) ou navegador sem WebP: entrega o arquivo original.
  const acceptsWebp = (request.headers.get("accept") ?? "").includes("image/webp");
  if (width === null || media.mime === "image/gif" || !acceptsWebp) return original();

  try {
    const resized = await sharp(media.bytes)
      .rotate()
      .resize({ width, withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();
    // Se a versão nova não ficou menor (imagem já pequena e leve), vale o original.
    if (resized.length >= media.bytes.length) return original();
    return new Response(new Uint8Array(resized), { headers: { ...HEADERS, "Content-Type": "image/webp", Vary: "Accept" } });
  } catch {
    return original();
  }
}
