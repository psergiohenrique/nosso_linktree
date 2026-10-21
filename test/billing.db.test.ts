// Integração da cobrança com o Postgres (webhook do Asaas → assinatura). Só roda com TEST_DATABASE_URL.
// O Asaas e o e-mail são simulados; o banco é real.
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const asaas = vi.hoisted(() => ({
  createCheckout: vi.fn<(input: unknown) => Promise<{ id: string; url: string }>>(async () => ({
    id: `chk_${Math.random().toString(36).slice(2)}`,
    url: "https://sandbox.asaas.com/c/x",
  })),
  cancelGatewaySubscription: vi.fn<(id: string) => Promise<void>>(async () => {}),
}));
vi.mock("@/server/asaas", async (importOriginal) => ({ ...(await importOriginal<object>()), ...asaas }));
vi.mock("@/server/mail", () => ({ sendMail: vi.fn(async () => true) }));

import {
  cancelPlan,
  expireOverdue,
  getPlan,
  ingestEvent,
  isAuthenticWebhook,
  processEvent,
  startCheckout,
} from "@/server/billing";
import { pool, query, queryOne } from "@/server/db";

const brDate = (d: Date) => d.toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
const daysFromNow = (n: number) => new Date(Date.now() + n * 86_400_000);

/** Entrega um evento como o webhook faria e devolve o resultado do processamento. */
async function deliver(event: string, body: Record<string, unknown>, id = `evt_${randomUUID()}`) {
  const eventId = await ingestEvent({ id, event, ...body });
  return eventId ? processEvent(eventId, true) : "duplicate";
}

// getPlan é memoizado por requisição com React cache; fora do Next cada chamada é nova.
const plan = (userId: string) => getPlan(userId);

// O pool é do arquivo inteiro: fecha depois do último describe.
afterAll(async () => {
  if (process.env.TEST_DATABASE_URL) await pool.end();
});

describe.skipIf(!process.env.TEST_DATABASE_URL)("banco: cobrança via webhook do Asaas", () => {
  let userId = "";
  const ref = () => `linkbio:${userId}`;
  const customer = `cus_${randomUUID().slice(0, 8)}`;
  const subId = `sub_${randomUUID().slice(0, 8)}`;
  const subId2 = `sub_${randomUUID().slice(0, 8)}`;

  beforeAll(async () => {
    process.env.BILLING_ENABLED = "true";
    process.env.ASAAS_WEBHOOK_TOKEN = "token-de-teste";
    const row = await queryOne<{ id: string }>(
      "insert into users (email, password_hash) values ($1, 'scrypt$x$y') returning id",
      [`cobranca-${randomUUID()}@exemplo.com`],
    );
    userId = row!.id;
  });

  beforeEach(() => {
    asaas.createCheckout.mockClear();
    asaas.cancelGatewaySubscription.mockClear();
  });

  afterAll(async () => {
    await query("delete from users where id = $1", [userId]);
    await query("delete from billing_events where payload::text like $1", [`%${customer}%`]);
  });

  it("autentica o webhook pelo token", () => {
    expect(isAuthenticWebhook("token-de-teste")).toBe(true);
    expect(isAuthenticWebhook("errado")).toBe(false);
    expect(isAuthenticWebhook(null)).toBe(false);
  });

  it("checkout: cria a assinatura pendente e manda a referência do usuário, cobrando já", async () => {
    expect((await plan(userId)).kind).toBe("free");
    const url = await startCheckout(userId, "monthly");
    expect(url).toContain("asaas.com");

    const input = asaas.createCheckout.mock.calls[0][0] as unknown as Record<string, unknown>;
    expect(input).toMatchObject({ externalReference: ref(), valueCents: 990, cycle: "MONTHLY" });
    expect(Math.abs((input.nextDueDate as Date).getTime() - Date.now())).toBeLessThan(60_000);
    expect((await plan(userId)).kind).toBe("free");
  });

  it("pagamento confirmado ativa o Pro mensal e guarda só bandeira e final do cartão", async () => {
    const checkoutId = (await queryOne<{ id: string }>(
      "select gateway_checkout_id as id from subscriptions where user_id = $1",
      [userId],
    ))!.id;
    expect(await deliver("CHECKOUT_PAID", { checkout: { id: checkoutId, customer, externalReference: ref() } })).toBe("done");
    expect(
      await deliver("SUBSCRIPTION_CREATED", { subscription: { id: subId, customer, cycle: "MONTHLY", externalReference: ref() } }),
    ).toBe("done");

    const payment = {
      id: "pay_1_" + subId,
      customer,
      subscription: subId,
      value: 9.9,
      dueDate: brDate(new Date()),
      creditCard: { creditCardBrand: "VISA", creditCardNumber: "4242" },
      transactionReceiptUrl: "https://sandbox.asaas.com/comprovantes/1",
    };
    expect(await deliver("PAYMENT_CONFIRMED", { payment })).toBe("done");
    // Fora de ordem: o "criado" chega depois e não desfaz o "pago".
    expect(await deliver("PAYMENT_CREATED", { payment })).toBe("done");

    const state = await plan(userId);
    expect(state).toMatchObject({ pro: true, kind: "active", cycle: "monthly" });
    expect(state.until!.getTime()).toBeGreaterThan(daysFromNow(27).getTime());

    const inv = await queryOne<{ status: string; amount_cents: number; receipt_url: string }>(
      "select status, amount_cents, receipt_url from invoices where gateway_payment_id = $1",
      [payment.id],
    );
    expect(inv).toMatchObject({ status: "paid", amount_cents: 990 });
    const card = await queryOne("select card_brand, card_last4 from subscriptions where user_id = $1", [userId]);
    expect(card).toEqual({ card_brand: "VISA", card_last4: "4242" });
  });

  it("entrega repetida do mesmo evento é ignorada", async () => {
    const body = { checkout: { id: "chk_dup", customer, externalReference: ref() } };
    expect(await deliver("CHECKOUT_PAID", body, "evt_dup_" + subId)).toBe("done");
    expect(await deliver("CHECKOUT_PAID", body, "evt_dup_" + subId)).toBe("duplicate");
  });

  it("renovação recusada abre 7 dias de carência (uma vez só) e o pagamento depois regulariza", async () => {
    const payment = { id: "pay_2_" + subId, customer, subscription: subId, value: 9.9, dueDate: brDate(daysFromNow(30)) };
    await deliver("PAYMENT_CREDIT_CARD_CAPTURE_REFUSED", { payment });
    const first = await plan(userId);
    expect(first).toMatchObject({ pro: true, kind: "past_due" });
    expect(Math.round((first.until!.getTime() - Date.now()) / 86_400_000)).toBe(7);

    await query("update subscriptions set grace_ends_at = now() + interval '2 days' where user_id = $1", [userId]);
    await deliver("PAYMENT_OVERDUE", { payment });
    const second = await plan(userId);
    expect(Math.round((second.until!.getTime() - Date.now()) / 86_400_000)).toBe(2);

    await deliver("PAYMENT_CONFIRMED", { payment });
    const back = await plan(userId);
    expect(back).toMatchObject({ pro: true, kind: "active" });
    expect(back.until!.getTime()).toBeGreaterThan(daysFromNow(55).getTime());
  });

  it("trocar para anual cobra só no fim do período pago e encerra a assinatura antiga quando a nova nasce", async () => {
    const before = await plan(userId);
    await startCheckout(userId, "yearly");
    const input = asaas.createCheckout.mock.calls[0][0] as unknown as Record<string, unknown>;
    expect(input).toMatchObject({ valueCents: 7080, cycle: "YEARLY" });
    expect((input.nextDueDate as Date).getTime()).toBe(before.until!.getTime());
    // Checkout aberto não mexe na assinatura viva.
    expect(asaas.cancelGatewaySubscription).not.toHaveBeenCalled();

    await deliver("SUBSCRIPTION_CREATED", { subscription: { id: subId2, customer, cycle: "YEARLY", externalReference: ref() } });
    expect(asaas.cancelGatewaySubscription).toHaveBeenCalledWith(subId);
    expect(await plan(userId)).toMatchObject({ pro: true, kind: "active", cycle: "yearly" });
  });

  it("cancelar mantém o Pro até o fim do período; nova assinatura desfaz o cancelamento", async () => {
    await cancelPlan(userId);
    expect(asaas.cancelGatewaySubscription).toHaveBeenCalledWith(subId2);
    const canceling = await plan(userId);
    expect(canceling).toMatchObject({ pro: true, kind: "canceling" });

    await query("update subscriptions set current_period_end = now() - interval '1 day' where user_id = $1", [userId]);
    expect(await plan(userId)).toMatchObject({ pro: false, kind: "canceled" });
  });

  it("pagamento de um período que já acabou não reabre o acesso", async () => {
    const old = { id: "pay_old_" + subId, customer, subscription: subId, value: 9.9, dueDate: brDate(daysFromNow(-70)) };
    await deliver("PAYMENT_CONFIRMED", { payment: old });
    expect((await plan(userId)).pro).toBe(false);
  });

  it("ignora eventos de outro produto na mesma conta Asaas", async () => {
    const foreign = { id: "pay_ambiento", customer: "cus_ambiento", value: 99.9, externalReference: "clx_org_ambiento" };
    expect(await deliver("PAYMENT_CONFIRMED", { payment: foreign })).toBe("done");
    expect(await queryOne("select 1 from invoices where gateway_payment_id = 'pay_ambiento'")).toBeNull();
  });

  it("evento que chega antes do que o explica fica na fila para nova tentativa", async () => {
    const id = `evt_${randomUUID()}`;
    const early = { id: "pay_early", customer: "cus_desconhecido", value: 9.9, dueDate: brDate(new Date()) };
    expect(await deliver("PAYMENT_CONFIRMED", { payment: early }, id)).toBe("failed");
    const row = await queryOne<{ processed_at: Date | null; attempts: number; error: string; next_attempt_at: Date }>(
      "select processed_at, attempts, error, next_attempt_at from billing_events where gateway_event_id = $1",
      [id],
    );
    expect(row).toMatchObject({ processed_at: null, attempts: 1 });
    expect(row!.error).toContain("nenhuma assinatura");
    expect(row!.next_attempt_at.getTime()).toBeGreaterThan(Date.now());
    await query("delete from billing_events where gateway_event_id = $1", [id]);
  });

  it("fim da carência: cancela no Asaas e marca como expirada", async () => {
    await query(
      `update subscriptions set status = 'past_due', canceled_at = null, grace_ends_at = now() - interval '1 hour',
              gateway_subscription_id = $2 where user_id = $1`,
      [userId, subId2],
    );
    expect(await expireOverdue()).toBeGreaterThanOrEqual(1);
    expect(asaas.cancelGatewaySubscription).toHaveBeenCalledWith(subId2);
    const row = await queryOne<{ status: string }>("select status from subscriptions where user_id = $1", [userId]);
    expect(row!.status).toBe("expired");
    expect(await plan(userId)).toMatchObject({ pro: false, kind: "expired" });
  });
});

describe.skipIf(!process.env.TEST_DATABASE_URL)("banco: primeiro pagamento como o Asaas manda em produção", () => {
  let userId = "";
  const customer = `cus_${randomUUID().slice(0, 8)}`;
  const subId = `sub_${randomUUID().slice(0, 8)}`;

  beforeAll(async () => {
    process.env.BILLING_ENABLED = "true";
    const row = await queryOne<{ id: string }>(
      "insert into users (email, password_hash) values ($1, 'scrypt$x$y') returning id",
      [`producao-${randomUUID()}@exemplo.com`],
    );
    userId = row!.id;
  });

  afterAll(async () => {
    await query("delete from users where id = $1", [userId]);
    await query("delete from billing_events where payload::text like $1 or payload::text like $2", [
      `%${customer}%`,
      "%chk_ambiento%",
    ]);
  });

  it("pagamento e assinatura sem referência se ligam pelo checkoutSession, mesmo de um checkout anterior", async () => {
    asaas.createCheckout.mockResolvedValueOnce({ id: `chk_a_${subId}`, url: "https://asaas.com/c/a" });
    asaas.createCheckout.mockResolvedValueOnce({ id: `chk_b_${subId}`, url: "https://asaas.com/c/b" });
    await startCheckout(userId, "yearly");
    await startCheckout(userId, "yearly");
    // A pessoa paga pelo link do primeiro checkout, que ainda vale.
    const checkoutSession = `chk_a_${subId}`;

    // Ordem e forma vistas em produção (Ambiento, 2026-10-20): externalReference null nas cobranças
    // e na assinatura, e o CHECKOUT_PAID por último, sem customer.
    const payment = {
      id: `pay_${subId}`,
      customer,
      subscription: subId,
      checkoutSession,
      externalReference: null,
      value: 70.8,
      dueDate: brDate(new Date()),
    };
    expect(await deliver("PAYMENT_CREATED", { payment })).toBe("done");
    expect(await deliver("PAYMENT_CONFIRMED", { payment })).toBe("done");
    expect(
      await deliver("SUBSCRIPTION_CREATED", {
        subscription: { id: subId, customer, cycle: "YEARLY", checkoutSession, externalReference: null },
      }),
    ).toBe("done");
    expect(
      await deliver("CHECKOUT_PAID", {
        checkout: { id: checkoutSession, customer: null, externalReference: `linkbio:${userId}` },
      }),
    ).toBe("done");

    expect(await plan(userId)).toMatchObject({ pro: true, kind: "active", cycle: "yearly" });
    const sub = await queryOne("select gateway_customer_id, gateway_subscription_id from subscriptions where user_id = $1", [
      userId,
    ]);
    expect(sub).toEqual({ gateway_customer_id: customer, gateway_subscription_id: subId });
    const erros = await queryOne<{ n: number }>(
      "select count(*)::int as n from billing_events where payload::text like $1 and error is not null",
      [`%${customer}%`],
    );
    expect(erros!.n).toBe(0);
  });

  it("cobrança de um checkout de outro produto é ignorada de vez, sem erro", async () => {
    const payment = {
      id: "pay_chk_ambiento",
      customer: "cus_do_ambiento",
      subscription: "sub_do_ambiento",
      checkoutSession: "chk_ambiento",
      externalReference: null,
      value: 49.9,
      dueDate: brDate(new Date()),
    };
    const id = `evt_${randomUUID()}`;
    expect(await deliver("PAYMENT_CONFIRMED", { payment }, id)).toBe("done");
    expect(await queryOne("select 1 from invoices where gateway_payment_id = 'pay_chk_ambiento'")).toBeNull();
    const row = await queryOne<{ processed_at: Date | null; error: string | null }>(
      "select processed_at, error from billing_events where gateway_event_id = $1",
      [id],
    );
    expect(row!.processed_at).not.toBeNull();
    expect(row!.error).toBeNull();
  });
});
