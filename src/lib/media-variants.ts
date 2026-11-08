/**
 * Versões menores das imagens enviadas: `/media/<id>?w=<largura>` devolve a mesma imagem em WebP,
 * redimensionada. Só aceita larguras desta lista, para o cache da CDN não crescer sem limite.
 * Funciona no servidor e no navegador (sem dependências).
 */
export const MEDIA_WIDTHS = [96, 192, 320, 480, 640, 960, 1280] as const;

const MEDIA_PATH = /^\/media\/[0-9a-f-]{36}$/i;

/** Aceita só uma das larguras permitidas; qualquer outra coisa vira null. */
export function parseMediaWidth(value: string | null): number | null {
  if (!value || !/^\d+$/.test(value)) return null;
  const width = Number(value);
  return (MEDIA_WIDTHS as readonly number[]).includes(width) ? width : null;
}

/** Endereço da imagem na largura pedida. URLs que não são de `/media/` (prévia local, blob:) ficam como estão. */
export function mediaVariant(url: string, width: number): string {
  return MEDIA_PATH.test(url) ? `${url}?w=${width}` : url;
}

/** `srcset` com várias larguras, ou undefined se a URL não for de `/media/`. */
export function mediaSrcSet(url: string, widths: readonly number[]): string | undefined {
  if (!MEDIA_PATH.test(url)) return undefined;
  return widths.map((w) => `${url}?w=${w} ${w}w`).join(", ");
}
