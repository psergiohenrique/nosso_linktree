import { describe, expect, it } from "vitest";
import {
  addMonths,
  applyPlanToLinks,
  canCancel,
  cycleForAmount,
  FREE_LINK_LIMIT,
  nextInvoiceStatus,
  planState,
  type SubscriptionRow,
} from "@/lib/billing";
import type { LinkLayout } from "@/lib/types";

const NOW = new Date("2026-10-16T15:00:00Z");
const days = (n: number) => new Date(NOW.getTime() + n * 86_400_000);
const on = { billingEnabled: true, now: NOW };

const sub = (patch: Partial<SubscriptionRow>): SubscriptionRow => ({
  status: "active",
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
  it("com a cobrança desligada, todo mundo tem o Pro", () => {
    expect(planState(null, { billingEnabled: false })).toMatchObject({ pro: true, kind: "launch" });
  });

  it("sem assinatura ou com checkout só aberto é Grátis", () => {
    expect(planState(null, on)).toMatchObject({ pro: false, kind: "free" });
    expect(planState(sub({ status: "pending", current_period_end: null }), on)).toMatchObject({ pro: false, kind: "free" });
  });

  it("ativa com período vigente é Pro até o fim do período", () => {
    expect(planState(sub({}), on)).toMatchObject({ pro: true, kind: "active", until: days(20), cycle: "monthly" });
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
  it("deduz o ciclo pelo valor", () => {
    expect(cycleForAmount(990)).toBe("monthly");
    expect(cycleForAmount(7080)).toBe("yearly");
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
});
