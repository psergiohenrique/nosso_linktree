import "server-only";
import { query, queryOne } from "./db";

export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

/** Detecta o tipo pelo conteúdo (não confia no nome nem no Content-Type enviado). SVG fica de fora. */
function sniffImage(buf: Buffer): string | null {
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])))
    return "image/png";
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.length >= 12 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP")
    return "image/webp";
  if (buf.length >= 6 && /^GIF8[79]a$/.test(buf.toString("ascii", 0, 6))) return "image/gif";
  return null;
}

export type UploadResult = { id: string } | { error: string } | null;

/** Salva a imagem do campo do formulário. Retorna null se nenhum arquivo foi enviado. */
export async function saveImage(ownerId: string, entry: FormDataEntryValue | null): Promise<UploadResult> {
  if (!(entry instanceof File) || entry.size === 0) return null;
  if (entry.size > MAX_IMAGE_BYTES) return { error: "Imagem maior que 2 MB." };

  const bytes = Buffer.from(await entry.arrayBuffer());
  const mime = sniffImage(bytes);
  if (!mime) return { error: "Formato de imagem não suportado (use PNG, JPG, WEBP ou GIF)." };

  const row = await queryOne<{ id: string }>(
    "insert into media (owner_id, mime, size, bytes) values ($1, $2, $3, $4) returning id",
    [ownerId, mime, bytes.length, bytes],
  );
  return { id: row!.id };
}

export async function deleteMedia(ownerId: string, id: string | null | undefined) {
  if (!id) return;
  await query("delete from media where id = $1 and owner_id = $2", [id, ownerId]);
}

export async function getMedia(id: string) {
  return queryOne<{ mime: string; bytes: Buffer }>("select mime, bytes from media where id = $1", [id]);
}
