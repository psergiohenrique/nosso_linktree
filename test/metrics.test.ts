import { describe, expect, it } from "vitest";
import { delta, rateDelta } from "@/lib/metrics";
import { buildWeeklyEmail, isValidUnsubscribe, unsubscribeUrl } from "@/server/weekly-report";

describe("delta", () => {
  it("variação percentual com sinal", () => {
    expect(delta(123, 100)).toEqual({ dir: "up", label: "+23%" });
    expect(delta(50, 100)).toEqual({ dir: "down", label: "−50%" });
    expect(delta(100, 100)).toEqual({ dir: "flat", label: "0%" });
  });

  it("sem base de comparação", () => {
    expect(delta(0, 0)).toBeNull();
    expect(delta(5, 0)).toEqual({ dir: "new", label: "novo" });
  });

  it("taxa de clique em pontos percentuais", () => {
    expect(rateDelta(30, 100, 20, 100)).toEqual({ dir: "up", label: "+10 p.p." });
    expect(rateDelta(1, 0, 1, 10)).toBeNull();
  });
});

describe("resumo semanal", () => {
  const summary = {
    current: { views: 340, visitors: 300, clicks: 80, whatsapp: 52 },
    previous: { views: 300, visitors: 250, clicks: 90, whatsapp: 40 },
    topLink: { title: "Agendar <já>", clicks: 52 },
    topSource: { key: "instagram", count: 170 },
  };

  it("assunto destaca as conversas no WhatsApp e o corpo traz a comparação", () => {
    const mail = buildWeeklyEmail({ name: "Zé", slug: "ze", summary, unsubscribe: "https://x/sair" });
    expect(mail.subject).toContain("340 visitas e 52 conversas no WhatsApp");
    expect(mail.text).toContain("Conversas no WhatsApp: 52 (+30% vs. semana anterior)");
    expect(mail.text).toContain("Principal origem das visitas: Instagram (50%)");
    expect(mail.text).toContain("https://x/sair");
    // Texto do usuário vai escapado no HTML.
    expect(mail.html).toContain("Agendar &lt;já&gt;");
  });

  it("sem WhatsApp, fala de cliques e omite a linha de conversas", () => {
    const mail = buildWeeklyEmail({
      name: "",
      slug: "ze",
      summary: { ...summary, current: { ...summary.current, whatsapp: 0 }, previous: { ...summary.previous, whatsapp: 0 } },
      unsubscribe: "https://x/sair",
    });
    expect(mail.subject).toContain("340 visitas e 80 cliques");
    expect(mail.text).not.toContain("Conversas no WhatsApp");
  });

  it("link de descadastro assinado", () => {
    const id = "11111111-2222-3333-4444-555555555555";
    const token = new URL(unsubscribeUrl(id)).searchParams.get("t")!;
    expect(isValidUnsubscribe(id, token)).toBe(true);
    expect(isValidUnsubscribe(id, token.replace(/.$/, "0") === token ? "x" : token.replace(/.$/, "0"))).toBe(false);
    expect(isValidUnsubscribe("99999999-2222-3333-4444-555555555555", token)).toBe(false);
  });
});
