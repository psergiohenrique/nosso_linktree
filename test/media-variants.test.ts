import { describe, expect, it } from "vitest";
import { MEDIA_WIDTHS, mediaSrcSet, mediaVariant, parseMediaWidth } from "@/lib/media-variants";

const ID = "123e4567-e89b-12d3-a456-426614174000";

describe("parseMediaWidth", () => {
  it("aceita só larguras da lista", () => {
    for (const w of MEDIA_WIDTHS) expect(parseMediaWidth(String(w))).toBe(w);
  });
  it("recusa o que não é largura permitida", () => {
    for (const bad of [null, "", "0", "100", "5000", "-96", "96.5", "96px", "abc", "0x60"]) {
      expect(parseMediaWidth(bad)).toBeNull();
    }
  });
});

describe("mediaVariant e mediaSrcSet", () => {
  it("acrescenta a largura em endereços de /media/", () => {
    expect(mediaVariant(`/media/${ID}`, 480)).toBe(`/media/${ID}?w=480`);
    expect(mediaSrcSet(`/media/${ID}`, [320, 640])).toBe(`/media/${ID}?w=320 320w, /media/${ID}?w=640 640w`);
  });
  it("deixa quieto o que não é imagem enviada (prévia local, blob, outro site)", () => {
    for (const url of ["blob:http://localhost/abc", "https://exemplo.com/foto.jpg", `/media/${ID}?w=96`, "/media/nao-e-uuid"]) {
      expect(mediaVariant(url, 480)).toBe(url);
      expect(mediaSrcSet(url, [320, 640])).toBeUndefined();
    }
  });
});
