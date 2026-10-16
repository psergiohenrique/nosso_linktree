import { getMedia } from "@/server/media";

const UUID = /^[0-9a-f-]{36}$/i;

// Cada envio gera um id novo, então o conteúdo de um id nunca muda: cache longo.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const media = UUID.test(id) ? await getMedia(id) : null;
  if (!media) return new Response("Não encontrado", { status: 404 });

  return new Response(new Uint8Array(media.bytes), {
    headers: {
      "Content-Type": media.mime,
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}
