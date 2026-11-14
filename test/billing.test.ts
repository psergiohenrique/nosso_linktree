import { describe, expect, it } from "vitest";
import {
  addMonths,
  applyPlanToLinks,
  canCancel,
  cycleForAmount,
  FREE_LINK_LIMIT,
  hasTier,
  nextInvoiceStatus,
  periodForCycle,
  planState,
  type SubscriptionRow,
} from "@/lib/billing";
import type { LinkLayout } from "@/lib/types";

const NOW = new Date("2026-10-16T15:00:00Z");
const days = (n: number) => new Date(NOW.getTime() + n * 86_400_000);
const on = { billingEnabled: true, now: NOW };

const sub = (patch: Partial<SubscriptionRow>): SubscriptionRow => ({
  status: "active",
  plan: "pro",
  cycle: "monthly",
  current_period_end: days(20),
  grace_ends_at: null,
  canceled_at: null,
  courtesy_until: null,
  gateway_subscription_id: "sub_1",
  card_brand: "VISA",
  card_last4: "4242",
  ...patch,
});

describe("planState", () => {
  it("com a cobrança desligada, todo mundo tem o Pro, não o Business", () => {
    expect(planState(null, { billingEnabled: false })).toMatchObject({
      pro: true,
      tier: "pro",
      product: null,
      kind: "launch",
    });
    expect(hasTier(planState(null, { billingEnabled: false }), "business")).toBe(false);
  });

  it("sem assinatura ou com checkout só aberto é Grátis", () => {
    expect(planState(null, on)).toMatchObject({ pro: false, tier: "free", product: null, kind: "free" });
    expect(planState(sub({ status: "pending", current_period_end: null }), on)).toMatchObject({
      pro: false,
      tier: "free",
      product: "pro",
      kind: "free",
    });
  });

  it("ativa com período vigente é Pro até o fim do período", () => {
    expect(planState(sub({}), on)).toMatchObject({
      pro: true,
      tier: "pro",
      product: "pro",
      kind: "active",
      until: days(20),
      cycle: "monthly",
    });
  });

  it("Business inclui o Pro e segue as mesmas regras de período, carência e cancelamento", () => {
    const active = planState(sub({ plan: "business" }), on);
    expect(active).toMatchObject({ pro: true, tier: "business", product: "business", kind: "active", cycle: "monthly" });
    expect(hasTier(active, "pro")).toBe(true);
    expect(hasTier(active, "business")).toBe(true);
    expect(planState(sub({ plan: "business", current_period_end: days(-4) }), on)).toMatchObject({
      pro: false,
      tier: "free",
      product: "business",
      kind: "expired",
    });
    expect(planState(sub({ plan: "business", status: "past_due", grace_ends_at: days(3) }), on)).toMatchObject({
      pro: true,
      tier: "business",
      kind: "past_due",
    });
    expect(planState(sub({ plan: "business", canceled_at: days(-1) }), on)).toMatchObject({
      pro: true,
      tier: "business",
      kind: "canceling",
    });
  });

  it("cortesia continua sendo Pro, mesmo numa linha que já foi Business", () => {
    expect(
      planState(sub({ plan: "business", status: "expired", courtesy_until: days(30) }), on),
    ).toMatchObject({ pro: true, tier: "pro", product: "business", kind: "courtesy" });
    expect(planState(sub({ plan: "business", courtesy_until: days(30) }), on)).toMatchObject({
      kind: "active",
      tier: "business",
    });
  });

  it("dá alguns dias de folga para a renovação chegar, depois expira", () => {
    expect(planState(sub({ current_period_end: days(-2) }), on)).toMatchObject({ pro: true, kind: "active" });
    expect(planState(sub({ current_period_end: days(-4) }), on)).toMatchObject({ pro: false, kind: "expired" });
  });

  it("cancelada mantém o Pro até o fim do período pago", () => {
    expect(planState(sub({ canceled_at: days(-1) }), on)).toMatchObject({ pro: true, kind: "canceling", until: days(20) });
    expect(planState(sub({ canceled_at: days(-40), current_period_end: days(-1) }), on)).toMatchObject({
      pro: false,
      kind: "canceled",
    });
  });

  it("inadimplente fica no Pro só durante a carência", () => {
    expect(planState(sub({ status: "past_due", grace_ends_at: days(3) }), on)).toMatchObject({
      pro: true,
      kind: "past_due",
      until: days(3),
    });
    expect(planState(sub({ status: "past_due", grace_ends_at: days(-1) }), on)).toMatchObject({ pro: false, kind: "expired" });
  });

  it("cortesia vale enquanto for futura e não esconde uma assinatura paga", () => {
    expect(planState(sub({ status: "pending", current_period_end: null, courtesy_until: days(30) }), on)).toMatchObject({
      pro: true,
      kind: "courtesy",
      until: days(30),
    });
    expect(planState(sub({ status: "expired", courtesy_until: days(-1) }), on)).toMatchObject({ pro: false });
    expect(planState(sub({ courtesy_until: days(30) }), on)).toMatchObject({ kind: "active" });
  });

  it("só cancela quem tem assinatura viva", () => {
    const active = sub({});
    expect(canCancel(planState(active, on), active)).toBe(true);
    const canceling = sub({ canceled_at: days(-1) });
    expect(canCancel(planState(canceling, on), canceling)).toBe(false);
    const noGateway = sub({ gateway_subscription_id: null });
    expect(canCancel(planState(noGateway, on), noGateway)).toBe(false);
  });
});

describe("nextInvoiceStatus", () => {
  it("evento atrasado não desfaz o que já se sabe", () => {
    expect(nextInvoiceStatus("paid", "open")).toBe("paid");
    expect(nextInvoiceStatus("paid", "failed")).toBe("paid");
    expect(nextInvoiceStatus("failed", "open")).toBe("failed");
  });

  it("recusa pode virar paga; estorno e cancelamento superam paga", () => {
    expect(nextInvoiceStatus("failed", "paid")).toBe("paid");
    expect(nextInvoiceStatus("paid", "refunded")).toBe("refunded");
    expect(nextInvoiceStatus("open", "canceled")).toBe("canceled");
  });
});

describe("cobrança: ciclo e período", () => {
  it("deduz o ciclo pelo valor só para o Pro de hoje", () => {
    expect(cycleForAmount(990)).toBe("monthly");
    expect(cycleForAmount(7080)).toBe("yearly");
    expect(cycleForAmount(7079)).toBe("yearly");
    expect(cycleForAmount(3539)).toBe("monthly");
  });

  it("com ciclo explícito o valor não decide o período", () => {
    // R$ 9,90 seria mensal pelo valor; gravado como anual, cobre 12 meses.
    expect(periodForCycle("yearly", 990)).toEqual({ cycle: "yearly", months: 12 });
    // R$ 70,80 seria anual pelo valor; gravado como mensal, cobre 1 mês.
    expect(periodForCycle("monthly", 7080)).toEqual({ cycle: "monthly", months: 1 });
    // Um preço que ainda não existe também segue o ciclo gravado, não a faixa do Pro.
    expect(periodForCycle("monthly", 2990)).toEqual({ cycle: "monthly", months: 1 });
    expect(periodForCycle("yearly", 2990)).toEqual({ cycle: "yearly", months: 12 });
  });

  it("sem ciclo gravado, os webhooks do Pro de hoje continuam no mesmo período", () => {
    expect(periodForCycle(null, 990)).toEqual({ cycle: "monthly", months: 1 });
    expect(periodForCycle(null, 7080)).toEqual({ cycle: "yearly", months: 12 });
  });

  it("soma meses no calendário", () => {
    expect(addMonths(new Date("2026-10-16T15:00:00Z"), 1).toISOString()).toBe("2026-11-16T15:00:00.000Z");
    expect(addMonths(new Date("2026-10-16T15:00:00Z"), 12).toISOString()).toBe("2027-10-16T15:00:00.000Z");
  });
});

describe("applyPlanToLinks", () => {
  const links = Array.from({ length: 7 }, (_, i) => ({
    id: String(i),
    layout: (i % 2 ? "tile" : "featured") as LinkLayout,
    kind: "link" as const,
  }));

  it("no Grátis mostra só os primeiros links, todos como botão", () => {
    const free = applyPlanToLinks(links, false);
    expect(free).toHaveLength(FREE_LINK_LIMIT);
    expect(free.every((l) => l.layout === "button")).toBe(true);
    expect(free.map((l) => l.id)).toEqual(["0", "1", "2", "3", "4"]);
  });

  it("no Pro mostra tudo como está", () => {
    expect(applyPlanToLinks(links, true)).toBe(links);
  });

  it("esconde o Pix fora do Business e não gasta uma vaga do Grátis com ele", () => {
    const withPix = [{ id: "pix", layout: "featured" as const, kind: "pix" }, ...links];
    expect(applyPlanToLinks(withPix, true).some((l) => l.kind === "pix")).toBe(false);
    expect(applyPlanToLinks(withPix, { pro: true, pix: false }).some((l) => l.kind === "pix")).toBe(false);
    const shown = applyPlanToLinks(withPix, { pro: true, pix: true });
    expect(shown[0]).toMatchObject({ id: "pix", kind: "pix", layout: "featured" });
    const free = applyPlanToLinks(withPix, { pro: false, pix: false });
    expect(free).toHaveLength(FREE_LINK_LIMIT);
    expect(free.some((l) => l.kind === "pix")).toBe(false);
    expect(free.map((l) => l.id)).toEqual(["0", "1", "2", "3", "4"]);
  });
});
