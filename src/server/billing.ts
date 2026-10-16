import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { revalidatePath } from "next/cache";
import { cache } from "react";
import type { PoolClient } from "pg";
import {
  addMonths,
  canCancel,
  cycleForAmount,
  formatBRL,
  formatDateBR,
  GRACE_DAYS,
  INVOICE_STATUS_BY_EVENT,
  nextInvoiceStatus,
  planState,
  PRO_PRICES,
  type Cycle,
  type InvoiceStatus,
  type SubscriptionRow,
} from "@/lib/billing";
import { SITE_NAME, SITE_URL } from "@/lib/site";
import {
  cancelGatewaySubscription,
  createCheckout,
  isEnvelope,
  type AsaasEnvelope,
  type AsaasPayment,
} from "./asaas";
import { pool, query, queryOne } from "./db";
import { sendMail } from "./mail";

/**
 * Cobrança do plano Pro via Asaas, no mesmo desenho do Ambiento:
 * - o checkout é a página hospedada do Asaas (cartão recorrente);
 * - só o webhook muda o estado (o retorno do checkout nunca é prova de pagamento);
 * - cada evento entra numa fila idempotente (billing_events) e é processado em seguida;
 *   o que falhar é tentado de novo depois (próximos webhooks e cron diário);
 * - o estado do plano é calculado na leitura (planState), então nenhum job precisa ter rodado.
 * Desligada (BILLING_ENABLED != "true"), todo mundo tem o Pro e as rotas de cobrança somem.
 */

export const billingEnabled = () => process.env.BILLING_ENABLED === "true";

/** Prefixo do externalReference: separa os nossos eventos dos de outros produtos na mesma conta Asaas. */
export const REF_PREFIX = "linkbio:";

const SUB_COLUMNS = `status, cycle, current_period_end, grace_ends_at, canceled_at, courtesy_until,
  gateway_subscription_id, card_brand, card_last4`;

export const getSubscription = cache((userId: string) =>
  queryOne<SubscriptionRow>(`select ${SUB_COLUMNS} from subscriptions where user_id = $1`, [userId]),
);

/** Plano do usuário agora (memoizado por requisição). */
export const getPlan = cache(async (userId: string) =>
  planState(await getSubscription(userId), { billingEnabled: billingEnabled() }),
);

export type InvoiceRow = {
  id: string;
  status: InvoiceStatus;
  amount_cents: number;
  due_at: Date;
  paid_at: Date | null;
  invoice_url: string | null;
  receipt_url: string | null;
};

export function listInvoices(userId: string) {
  return query<InvoiceRow>(
    `select id, status, amount_cents, due_at, paid_at, invoice_url, receipt_url
       from invoices where user_id = $1 order by due_at desc, created_at desc limit 24`,
    [userId],
  );
}

// ───────── Checkout e cancelamento (chamados pelas actions do painel) ─────────

export class BillingError extends Error {}

/** Abre o checkout do Asaas e devolve a URL. Assinatura viva só é trocada quando a nova for criada. */
export async function startCheckout(userId: string, cycle: Cycle) {
  if (!billingEnabled()) throw new BillingError("A cobrança não está disponível agora.");
  const plan = await getPlan(userId);

  await query("insert into subscriptions (user_id) values ($1) on conflict do nothing", [userId]);

  // Quem ainda tem período pago (ou cortesia) só é cobrado quando ele acaba: trocar de ciclo
  // ou de cartão não cobra duas vezes. Em carência, cobra já para regularizar.
  const now = new Date();
  const paidUntil =
    plan.until && plan.until > now && ["active", "canceling", "courtesy"].includes(plan.kind) ? plan.until : now;

  const price = PRO_PRICES[cycle];
  const base = `${SITE_URL}/dashboard/plano`;
  let checkout: { id: string; url: string };
  try {
    checkout = await createCheckout({
      externalReference: `${REF_PREFIX}${userId}`,
      name: price.name,
      valueCents: price.cents,
      cycle: price.asaasCycle,
      nextDueDate: paidUntil,
      successUrl: `${base}?checkout=ok`,
      cancelUrl: `${base}?checkout=cancelado`,
      expiredUrl: `${base}?checkout=expirado`,
    });
  } catch (err) {
    console.error("[billing] falha ao abrir checkout", err);
    throw new BillingError("Não consegui abrir o pagamento agora. Tente de novo em alguns minutos.");
  }

  await query("update subscriptions set gateway_checkout_id = $2, updated_at = now() where user_id = $1", [
    userId,
    checkout.id,
  ]);
  return checkout.url;
}

/** Cancela no Asaas; o Pro continua até o fim do período já pago. */
export async function cancelPlan(userId: string) {
  const sub = await getSubscription(userId);
  const plan = await getPlan(userId);
  if (!canCancel(plan, sub)) return;
  try {
    await cancelGatewaySubscription(sub!.gateway_subscription_id!);
  } catch (err) {
    console.error("[billing] falha ao cancelar", err);
    throw new BillingError("Não consegui cancelar agora. Tente de novo em alguns minutos.");
  }
  await query(
    "update subscriptions set canceled_at = coalesce(canceled_at, now()), updated_at = now() where user_id = $1",
    [userId],
  );
  await refreshPublicPage(userId);
}

// ───────── Webhook: autenticação e entrada na fila ─────────

/** O Asaas não assina o corpo: manda um token fixo no cabeçalho asaas-access-token. */
export function isAuthenticWebhook(token: string | null) {
  const expected = process.env.ASAAS_WEBHOOK_TOKEN;
  if (!expected || !token) return false;
  const a = createHash("sha256").update(token).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

/** Grava o evento; a entrega repetida (mesmo id) é ignorada. Devolve o id interno ou null. */
export async function ingestEvent(body: unknown) {
  if (!isEnvelope(body)) return null;
  const row = await queryOne<{ id: string }>(
    `insert into billing_events (gateway_event_id, type, payload) values ($1, $2, $3)
     on conflict (gateway_event_id) do nothing returning id`,
    [body.id, body.event, JSON.stringify(body)],
  );
  return row?.id ?? null;
}

// ───────── Processamento ─────────

/** Espera crescente entre tentativas: 1 min, 5 min, 30 min, 2 h, 6 h (depois fica parado com o erro). */
export const RETRY_DELAYS_MS = [60_000, 5 * 60_000, 30 * 60_000, 2 * 3_600_000, 6 * 3_600_000];
const MAX_ATTEMPTS = RETRY_DELAYS_MS.length + 1;
const LEASE_MS = 2 * 60_000;

/** O evento chegou antes do que o explica (ex.: cobrança antes do checkout pago). A retentativa resolve. */
class EarlyEventError extends Error {}

/**
 * Reivindica e aplica um evento. A reivindicação é um update condicional: se duas execuções
 * disputarem o mesmo evento, só uma o pega.
 */
export async function processEvent(eventId: string, first = true): Promise<"done" | "failed" | "skipped"> {
  const claimed = await queryOne<{ payload: unknown; attempts: number }>(
    `update billing_events set attempts = attempts + 1, next_attempt_at = now() + make_interval(secs => $2)
      where id = $1 and processed_at is null
        and ${first ? "attempts = 0" : "next_attempt_at <= now() and attempts < $3"}
      returning payload, attempts`,
    first ? [eventId, LEASE_MS / 1000] : [eventId, LEASE_MS / 1000, MAX_ATTEMPTS],
  );
  if (!claimed) return "skipped";

  try {
    if (isEnvelope(claimed.payload)) await applyEvent(claimed.payload);
    await query("update billing_events set processed_at = now(), error = null where id = $1", [eventId]);
    return "done";
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const delay = RETRY_DELAYS_MS[claimed.attempts - 1] ?? 365 * 86_400_000;
    console.warn(`[billing] evento ${eventId} falhou: ${message}`);
    await query(
      "update billing_events set error = $2, next_attempt_at = now() + make_interval(secs => $3) where id = $1",
      [eventId, message.slice(0, 500), delay / 1000],
    );
    return "failed";
  }
}

/** Rede de segurança: reprocessa eventos pendentes cuja espera acabou. */
export async function processPending(limit = 20) {
  const due = await query<{ id: string }>(
    `select id from billing_events
      where processed_at is null and next_attempt_at <= now() and attempts < $1
      order by created_at limit $2`,
    [MAX_ATTEMPTS, limit],
  );
  let done = 0;
  for (const { id } of due) if ((await processEvent(id, false)) === "done") done += 1;
  return done;
}

async function applyEvent(env: AsaasEnvelope) {
  const userId = await resolveUser(env);
  if (!userId) return; // evento de outro produto na mesma conta Asaas

  if (env.event === "SUBSCRIPTION_CREATED" && env.subscription) {
    // Assinatura nova substitui a anterior (troca de ciclo ou de cartão): cancela a antiga no Asaas
    // antes, para nunca haver duas cobrando. Também desfaz um cancelamento pedido.
    const current = await getSubscriptionRow(userId);
    const old = current?.gateway_subscription_id;
    if (old && old !== env.subscription.id) await cancelGatewaySubscription(old);
    const cycle = env.subscription.cycle === "YEARLY" ? "yearly" : env.subscription.cycle === "MONTHLY" ? "monthly" : null;
    await query(
      `update subscriptions set gateway_subscription_id = $2, cycle = coalesce($3, cycle), canceled_at = null,
              updated_at = now() where user_id = $1`,
      [userId, env.subscription.id, cycle],
    );
    await refreshPublicPage(userId);
    return;
  }

  if ((env.event === "SUBSCRIPTION_DELETED" || env.event === "SUBSCRIPTION_INACTIVATED") && env.subscription) {
    // Cancelada fora do painel (ex.: no próprio Asaas): o período pago continua valendo.
    await query(
      `update subscriptions set canceled_at = coalesce(canceled_at, now()), updated_at = now()
        where user_id = $1 and gateway_subscription_id = $2`,
      [userId, env.subscription.id],
    );
    await refreshPublicPage(userId);
    return;
  }

  const invoiceStatus = INVOICE_STATUS_BY_EVENT[env.event];
  if (invoiceStatus && env.payment) {
    const result = await mirrorInvoice(userId, env.payment, invoiceStatus);
    if (result.becamePaid) await notifyPaid(userId, env.payment, result.periodEnd);
    if (result.graceStarted) await notifyFailed(userId, env.payment, result.graceStarted);
    if (result.becamePaid || result.graceStarted) await refreshPublicPage(userId);
  }
  // CHECKOUT_PAID e os demais: resolveUser já guardou o customer; nada mais a fazer.
}

async function getSubscriptionRow(userId: string) {
  return queryOne<{ gateway_subscription_id: string | null; gateway_customer_id: string | null }>(
    "select gateway_subscription_id, gateway_customer_id from subscriptions where user_id = $1",
    [userId],
  );
}

/**
 * De qual usuário é o evento. Em ordem: customer do Asaas (já visto antes), externalReference
 * ("linkbio:<id>"), id do checkout, id da assinatura. Referência de outro produto = ignorar.
 */
async function resolveUser(env: AsaasEnvelope): Promise<string | null> {
  const customer = env.payment?.customer ?? env.subscription?.customer ?? env.checkout?.customer ?? null;
  const reference =
    env.payment?.externalReference ?? env.subscription?.externalReference ?? env.checkout?.externalReference ?? null;
  const gatewaySubId = env.payment?.subscription ?? env.subscription?.id ?? null;

  if (customer) {
    const row = await queryOne<{ user_id: string }>("select user_id from subscriptions where gateway_customer_id = $1", [
      customer,
    ]);
    if (row) return row.user_id;
  }

  let userId: string | null = null;
  if (reference?.startsWith(REF_PREFIX)) {
    const id = reference.slice(REF_PREFIX.length);
    if (/^[0-9a-f-]{36}$/i.test(id)) {
      userId = (await queryOne<{ user_id: string }>("select user_id from subscriptions where user_id = $1", [id]))
        ?.user_id ?? null;
    }
  }
  if (!userId && env.checkout?.id) {
    userId = (
      await queryOne<{ user_id: string }>("select user_id from subscriptions where gateway_checkout_id = $1", [
        env.checkout.id,
      ])
    )?.user_id ?? null;
  }
  if (!userId && gatewaySubId) {
    userId = (
      await queryOne<{ user_id: string }>("select user_id from subscriptions where gateway_subscription_id = $1", [
        gatewaySubId,
      ])
    )?.user_id ?? null;
  }

  if (!userId) {
    // Referência sem o nosso prefixo é de outro produto na mesma conta: ignora de vez.
    if (reference && !reference.startsWith(REF_PREFIX)) return null;
    throw new EarlyEventError(`nenhuma assinatura para ${customer ?? reference ?? env.checkout?.id ?? gatewaySubId}`);
  }

  if (customer) {
    await query(
      "update subscriptions set gateway_customer_id = $2, updated_at = now() where user_id = $1 and gateway_customer_id is null",
      [userId, customer],
    );
  }
  return userId;
}

/** Vencimento do Asaas (YYYY-MM-DD) como instante, ao meio-dia de Brasília. */
function dueDateOf(payment: AsaasPayment) {
  const date = new Date(`${payment.dueDate ?? ""}T12:00:00-03:00`);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

async function inTransaction<T>(fn: (client: PoolClient) => Promise<T>) {
  const client = await pool.connect();
  try {
    await client.query("begin");
    const result = await fn(client);
    await client.query("commit");
    return result;
  } catch (err) {
    await client.query("rollback");
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Espelha a cobrança numa fatura e ajusta a assinatura: pagamento ativa/renova o Pro;
 * recusa começa a carência (uma vez só). Sob bloqueio da linha da assinatura.
 */
async function mirrorInvoice(userId: string, payment: AsaasPayment, incoming: InvoiceStatus) {
  return inTransaction(async (db) => {
    const sub = (
      await db.query<{ status: string; current_period_end: Date | null; gateway_subscription_id: string | null; grace_ends_at: Date | null }>(
        "select status, current_period_end, gateway_subscription_id, grace_ends_at from subscriptions where user_id = $1 for update",
        [userId],
      )
    ).rows[0];
    if (!sub) throw new EarlyEventError(`assinatura de ${userId} sumiu`);

    const cents = Math.round((payment.value ?? 0) * 100);
    const dueAt = dueDateOf(payment);
    const periodEnd = addMonths(dueAt, PRO_PRICES[cycleForAmount(cents)].months);

    const existing = (
      await db.query<{ status: InvoiceStatus }>("select status from invoices where gateway_payment_id = $1", [payment.id])
    ).rows[0];
    const status = existing ? nextInvoiceStatus(existing.status, incoming) : incoming;

    await db.query(
      `insert into invoices (user_id, gateway_payment_id, status, amount_cents, due_at, period_end, paid_at, invoice_url, receipt_url)
       values ($1, $2, $3, $4, $5, $6, case when $3 = 'paid' then now() end, $7, $8)
       on conflict (gateway_payment_id) do update set
         status = excluded.status,
         paid_at = case when excluded.status = 'paid' then coalesce(invoices.paid_at, now()) else invoices.paid_at end,
         invoice_url = coalesce(excluded.invoice_url, invoices.invoice_url),
         receipt_url = coalesce(excluded.receipt_url, invoices.receipt_url),
         updated_at = now()`,
      [userId, payment.id, status, cents, dueAt, periodEnd, payment.invoiceUrl ?? null, payment.transactionReceiptUrl ?? null],
    );

    const becamePaid = status === "paid" && existing?.status !== "paid";
    if (becamePaid) {
      // Cobrança da assinatura viva (ou sem vínculo ainda) desfaz um cancelamento pendente.
      const live = !payment.subscription || !sub.gateway_subscription_id || payment.subscription === sub.gateway_subscription_id;
      if (periodEnd > new Date()) {
        await db.query(
          `update subscriptions set status = 'active', activated_at = coalesce(activated_at, now()),
                  grace_ends_at = null, canceled_at = case when $3 then null else canceled_at end,
                  current_period_end = greatest(coalesce(current_period_end, $2), $2), updated_at = now()
            where user_id = $1`,
          [userId, periodEnd, live],
        );
      } else {
        // Pagamento de um período que já acabou (evento muito atrasado) não reabre o acesso.
        await db.query(
          "update subscriptions set current_period_end = greatest(coalesce(current_period_end, $2), $2) where user_id = $1",
          [userId, periodEnd],
        );
      }
    }

    // Carência só na primeira recusa de quem estava ativo; nova recusa não estende o prazo.
    let graceStarted: Date | null = null;
    if (status === "failed" && sub.status === "active") {
      graceStarted = new Date(Date.now() + GRACE_DAYS * 86_400_000);
      await db.query(
        "update subscriptions set status = 'past_due', grace_ends_at = $2, updated_at = now() where user_id = $1",
        [userId, graceStarted],
      );
    }

    await db.query(
      `update subscriptions set
         card_brand = coalesce($2, card_brand), card_last4 = coalesce($3, card_last4),
         gateway_subscription_id = coalesce(gateway_subscription_id, $4)
       where user_id = $1`,
      [
        userId,
        payment.creditCard?.creditCardBrand ?? null,
        payment.creditCard?.creditCardNumber?.slice(-4) ?? null,
        payment.subscription ?? null,
      ],
    );

    return { becamePaid, graceStarted, periodEnd };
  });
}

/**
 * Fim da carência sem pagamento: cancela no Asaas (para não seguir tentando cobrar) e marca
 * como expirada. O acesso já tinha caído na leitura; isto só arruma o registro. Roda no cron.
 */
export async function expireOverdue() {
  const overdue = await query<{ user_id: string; gateway_subscription_id: string | null }>(
    "select user_id, gateway_subscription_id from subscriptions where status = 'past_due' and grace_ends_at < now()",
  );
  for (const sub of overdue) {
    try {
      if (sub.gateway_subscription_id) await cancelGatewaySubscription(sub.gateway_subscription_id);
      await query(
        `update subscriptions set status = 'expired', canceled_at = coalesce(canceled_at, now()), updated_at = now()
          where user_id = $1 and status = 'past_due'`,
        [sub.user_id],
      );
      await refreshPublicPage(sub.user_id);
    } catch (err) {
      console.error(`[billing] falha ao expirar ${sub.user_id}`, err);
    }
  }
  return overdue.length;
}

// ───────── Efeitos colaterais ─────────

/** A página pública fica em cache: mudança de plano muda a marca e os links visíveis. */
async function refreshPublicPage(userId: string) {
  const profile = await queryOne<{ slug: string }>("select slug from profiles where id = $1", [userId]);
  try {
    if (profile) revalidatePath(`/${profile.slug}`);
    revalidatePath("/dashboard", "layout");
  } catch {
    // Fora de uma requisição do Next (ex.: testes) não há cache para invalidar.
  }
}

async function userEmail(userId: string) {
  return (await queryOne<{ email: string }>("select email from users where id = $1", [userId]))?.email ?? null;
}

async function notifyPaid(userId: string, payment: AsaasPayment, periodEnd: Date) {
  const email = await userEmail(userId);
  if (!email) return;
  const amount = formatBRL(Math.round((payment.value ?? 0) * 100));
  const until = formatDateBR(periodEnd);
  await sendMail({
    to: email,
    subject: `Pagamento confirmado — ${SITE_NAME} Pro`,
    text: `Recebemos ${amount}. Seu plano Pro está ativo até ${until}.\n\nGerencie em ${SITE_URL}/dashboard/plano`,
    html: `<p>Recebemos <strong>${amount}</strong>. Seu plano Pro está ativo até <strong>${until}</strong>.</p><p><a href="${SITE_URL}/dashboard/plano">Gerenciar assinatura</a></p>`,
  }).catch((err) => console.error("[billing] e-mail de pagamento", err));
}

async function notifyFailed(userId: string, payment: AsaasPayment, graceEndsAt: Date) {
  const email = await userEmail(userId);
  if (!email) return;
  const amount = formatBRL(Math.round((payment.value ?? 0) * 100));
  const until = formatDateBR(graceEndsAt);
  await sendMail({
    to: email,
    subject: `Não conseguimos cobrar seu cartão — ${SITE_NAME}`,
    text: `A cobrança de ${amount} do plano Pro não passou. Atualize o cartão até ${until} para não voltar ao plano Grátis.\n\n${SITE_URL}/dashboard/plano`,
    html: `<p>A cobrança de <strong>${amount}</strong> do plano Pro não passou.</p><p>Atualize o cartão até <strong>${until}</strong> para não voltar ao plano Grátis.</p><p><a href="${SITE_URL}/dashboard/plano">Atualizar cartão</a></p>`,
  }).catch((err) => console.error("[billing] e-mail de falha", err));
}
