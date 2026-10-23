/**
 * Reduz no navegador a foto escolhida antes do envio. Foto de celular passa fácil de 3 MB e estoura o
 * limite do corpo das Server Actions (`bodySizeLimit` em next.config.ts), o que quebrava a página
 * em vez de mostrar um aviso. Só roda no cliente.
 */

/** Mesmo limite do servidor (src/server/media.ts). */
export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;
const MAX_SIDE = 1600;
const KEEP_AS_IS = new Set(["image/png", "image/jpeg", "image/webp"]);

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
}

/** Devolve o próprio arquivo se já serve, uma versão menor em JPEG/WebP, ou o original se não der para ler. */
export async function shrinkImage(file: File): Promise<File> {
  // GIF fica como está (redimensionar perderia a animação).
  if (file.type === "image/gif") return file;
  if (KEEP_AS_IS.has(file.type) && file.size <= 1024 * 1024) return file;

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return file; // Formato que o navegador não abre (ex.: HEIC no Chrome): o servidor responde com o aviso.
  }

  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;

  // WebP mantém a transparência; o Safari antigo não gera WebP e devolve PNG, então cai para JPEG.
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  let blob = await toBlob(canvas, "image/webp", 0.86);
  if (!blob || blob.type !== "image/webp") {
    ctx.globalCompositeOperation = "destination-over";
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    blob = await toBlob(canvas, "image/jpeg", 0.86);
  }
  bitmap.close();
  if (!blob || blob.size >= file.size) return file;

  const ext = blob.type === "image/webp" ? "webp" : "jpg";
  const name = file.name.replace(/\.[^.]*$/, "") || "imagem";
  return new File([blob], `${name}.${ext}`, { type: blob.type });
}
