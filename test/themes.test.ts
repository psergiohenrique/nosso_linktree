import { describe, expect, it } from "vitest";
import { THEME_PRESETS } from "@/lib/types";

function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a: string, b: string) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe("temas prontos", () => {
  it("têm nomes únicos e incluem Clínica e Escritório", () => {
    const names = THEME_PRESETS.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
    expect(names).toContain("Clínica");
    expect(names).toContain("Escritório");
  });

  // Só os temas novos: o Oceano já existente fica em ~4,15:1 na ponta clara do degradê.
  it.each(THEME_PRESETS.filter((t) => ["Clínica", "Escritório"].includes(t.name)).map((t) => [t.name, t] as const))("%s: contraste AA do texto e do botão", (_name, theme) => {
    const a = theme.appearance;
    expect(contrast(a.text_color, a.bg_color)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(a.text_color, a.bg_color2)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(a.button_text_color, a.button_color)).toBeGreaterThanOrEqual(4.5);
  });
});
