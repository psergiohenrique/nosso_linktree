import "server-only";
import { notFound } from "next/navigation";
import { isAdminEmail } from "@/lib/admin";
import { planState, PRO_PRICES, type InvoiceStatus, type PlanState, type SubscriptionRow } from "@/lib/billing";
import { requireUser } from "./auth";
import { query, queryOne } from "./db";

/**
 * Painel administrativo (/admin): leitura de todas as contas, sem o filtro por dono das outras
 * consultas. Só quem está em ADMIN_EMAILS entra; para os demais a rota não existe (404).
 */
export async function requireAdmin() {
  const user = await requireUser();
  if (!isAdminEmail(user.email, process.env.ADMIN_EMAILS)) notFound();
  return user;
}

/**
 * Plano de verdade, como se a cobrança estivesse ligada: com ela desligada todo mundo aparece
 * como Pro de lançamento, o que esconderia o estado das assinaturas.
 */
export const realPlan = (sub: SubscriptionRow | null) => planState(sub, { billingEnabled: true });

const SUB_COLUMNS = `s.status, s.cycle, s.current_period_end, s.grace_ends_at, s.canceled_at, s.courtesy_until,
  s.gateway_subscription_id, s.card_brand, s.card_last4`;

type SubColumns = { [K in keyof SubscriptionRow]: SubscriptionRow[K] | null };

function subOf(row: SubColumns): SubscriptionRow | null {
  return row.status ? (row as SubscriptionRow) : null;
}

// ───────── Resumo ─────────

export type AdminSummary = {
  users: number;
  verified: number;
  withPage: number;
  new7: number;
  new30: number;
  plans: Record<PlanState["kind"], number>;
  /** Receita mensal recorrente estimada: assinaturas ativas (anual dividido por 12). */
  mrrCents: number;
  paidMonthCents: number;
  paid30Cents: number;
  paidTotalCents: number;
  refundedTotalCents: number;
  failed30: number;
};

export async function getAdminSummary(): Promise<AdminSummary> {
  const [users, revenue, subs] = await Promise.all([
    queryOne<{ users: number; verified: number; with_page: number; new7: number; new30: number }>(
      `select count(*)::int as users,
              count(u.email_verified_at)::int as verified,
              count(p.id)::int as with_page,
              count(*) filter (where u.created_at > now() - interval '7 days')::int as new7,
              count(*) filter (where u.created_at > now() - interval '30 days')::int as new30
         from users u left join profiles p on p.id = u.id`,
    ),
    queryOne<{ month: number; d30: number; total: number; refunded: number; failed30: number }>(
      `select coalesce(sum(amount_cents) filter (where status = 'paid'
                and paid_at >= date_trunc('month', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo'), 0)::int as month,
              coalesce(sum(amount_cents) filter (where status = 'paid' and paid_at > now() - interval '30 days'), 0)::int as d30,
              coalesce(sum(amount_cents) filter (where status = 'paid'), 0)::int as total,
              coalesce(sum(amount_cents) filter (where status = 'refunded'), 0)::int as refunded,
              count(*) filter (where status = 'failed' and due_at > now() - interval '30 days')::int as failed30
         from invoices`,
    ),
    query<SubColumns & { user_id: string }>(`select s.user_id, ${SUB_COLUMNS} from subscriptions s`),
  ]);

  const plans: AdminSummary["plans"] = {
    launch: 0, free: 0, courtesy: 0, active: 0, canceling: 0, past_due: 0, expired: 0, canceled: 0,
  };
  let mrrCents = 0;
  for (const row of subs) {
    const plan = realPlan(subOf(row));
    plans[plan.kind] += 1;
    if (plan.kind === "active" && plan.cycle) mrrCents += PRO_PRICES[plan.cycle].cents / PRO_PRICES[plan.cycle].months;
  }
  // Quem nunca abriu checkout não tem linha em subscriptions: é Grátis.
  plans.free += (users?.users ?? 0) - subs.length;

  return {
    users: users?.users ?? 0,
    verified: users?.verified ?? 0,
    withPage: users?.with_page ?? 0,
    new7: users?.new7 ?? 0,
    new30: users?.new30 ?? 0,
    plans,
    mrrCents: Math.round(mrrCents),
    paidMonthCents: revenue?.month ?? 0,
    paid30Cents: revenue?.d30 ?? 0,
    paidTotalCents: revenue?.total ?? 0,
    refundedTotalCents: revenue?.refunded ?? 0,
    failed30: revenue?.failed30 ?? 0,
  };
}

export type AdminInvoice = {
  id: string;
  user_id: string;
  email: string;
  slug: string | null;
  status: InvoiceStatus;
  amount_cents: number;
  due_at: Date;
  paid_at: Date | null;
  gateway_payment_id: string;
  invoice_url: string | null;
  receipt_url: string | null;
};

/** Cobranças mais recentes de todas as contas. */
export function listRecentInvoices(limit = 20) {
  return query<AdminInvoice>(
    `select i.id, i.user_id, u.email, p.slug, i.status, i.amount_cents, i.due_at, i.paid_at,
            i.gateway_payment_id, i.invoice_url, i.receipt_url
       from invoices i join users u on u.id = i.user_id left join profiles p on p.id = i.user_id
      order by coalesce(i.paid_at, i.due_at) desc, i.created_at desc
      limit $1`,
    [limit],
  );
}

// ───────── Contas ─────────

export type AdminAccount = {
  id: string;
  email: string;
  name: string;
  instagram: string | null;
  created_at: Date;
  verified: boolean;
  slug: string | null;
  plan: PlanState;
  links: number;
  views30: number;
  paid_cents: number;
};

export const ACCOUNTS_PAGE_SIZE = 50;

/** Contas, das mais novas para as mais antigas; busca por e-mail, nome, Instagram ou endereço. */
export async function listAccounts({ search = "", page = 1 }: { search?: string; page?: number }) {
  const term = search.trim().toLowerCase().slice(0, 100);
  const pattern = `%${term.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  const rows = await query<
    SubColumns & {
      id: string;
      email: string;
      first_name: string;
      last_name: string;
      instagram: string | null;
      created_at: Date;
      verified: boolean;
      slug: string | null;
      links: number;
      views30: number;
      paid_cents: number;
      total: number;
    }
  >(
    `select u.id, u.email, u.first_name, u.last_name, u.instagram, u.created_at,
            u.email_verified_at is not null as verified, p.slug, ${SUB_COLUMNS},
            (select count(*) from links l where l.profile_id = u.id)::int as links,
            (select count(*) from events e
              where e.profile_id = u.id and e.type = 'view' and e.created_at > now() - interval '30 days')::int as views30,
            (select coalesce(sum(amount_cents), 0) from invoices i where i.user_id = u.id and i.status = 'paid')::int as paid_cents,
            count(*) over ()::int as total
       from users u
       left join profiles p on p.id = u.id
       left join subscriptions s on s.user_id = u.id
      where $1 = '' or u.email like $2 or lower(u.first_name || ' ' || u.last_name) like $2
         or u.instagram like $2 or p.slug like $2 or lower(p.display_name) like $2
      order by u.created_at desc
      limit $3 offset $4`,
    [term, pattern, ACCOUNTS_PAGE_SIZE, (Math.max(1, page) - 1) * ACCOUNTS_PAGE_SIZE],
  );

  return {
    total: rows[0]?.total ?? 0,
    accounts: rows.map<AdminAccount>((r) => ({
      id: r.id,
      email: r.email,
      name: [r.first_name, r.last_name].filter(Boolean).join(" "),
      instagram: r.instagram,
      created_at: r.created_at,
      verified: r.verified,
      slug: r.slug,
      plan: realPlan(subOf(r)),
      links: r.links,
      views30: r.views30,
      paid_cents: r.paid_cents,
    })),
  };
}

// ───────── Detalhe de uma conta ─────────

export async function getAccountDetail(userId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(userId)) return null;

  const user = await queryOne<{
    id: string;
    email: string;
    first_name: string;
    last_name: string;
    instagram: string | null;
    created_at: Date;
    email_verified_at: Date | null;
  }>(
    "select id, email, first_name, last_name, instagram, created_at, email_verified_at from users where id = $1",
    [userId],
  );
  if (!user) return null;

  const [profile, links, sub, invoices, stats, sessions, checkouts] = await Promise.all([
    queryOne<{ slug: string; display_name: string; bio: string; created_at: Date; updated_at: Date }>(
      "select slug, display_name, bio, created_at, updated_at from profiles where id = $1",
      [userId],
    ),
    query<{ id: string; kind: string; title: string; url: string; layout: string; is_active: boolean; clicks30: number }>(
      `select l.id, l.kind, l.title, l.url, l.layout, l.is_active,
              (select count(*) from events e
                where e.link_id = l.id and e.type = 'click' and e.created_at > now() - interval '30 days')::int as clicks30
         from links l where l.profile_id = $1 order by l.position`,
      [userId],
    ),
    queryOne<
      SubscriptionRow & {
        gateway_customer_id: string | null;
        activated_at: Date | null;
        created_at: Date;
        updated_at: Date;
      }
    >(
      `select ${SUB_COLUMNS}, s.gateway_customer_id, s.activated_at, s.created_at, s.updated_at
         from subscriptions s where s.user_id = $1`,
      [userId],
    ),
    query<Omit<AdminInvoice, "user_id" | "email" | "slug"> & { period_end: Date }>(
      `select id, status, amount_cents, due_at, period_end, paid_at, gateway_payment_id, invoice_url, receipt_url
         from invoices where user_id = $1 order by due_at desc, created_at desc`,
      [userId],
    ),
    queryOne<{ views: number; clicks: number; visitors: number; last_event: Date | null }>(
      `select count(*) filter (where type = 'view')::int as views,
              count(*) filter (where type = 'click')::int as clicks,
              count(distinct visitor_hash) filter (where type = 'view')::int as visitors,
              max(created_at) as last_event
         from events where profile_id = $1 and created_at > now() - interval '30 days'`,
      [userId],
    ),
    queryOne<{ active: number; last_login: Date | null }>(
      `select count(*) filter (where expires_at > now())::int as active, max(created_at) as last_login
         from sessions where user_id = $1`,
      [userId],
    ),
    queryOne<{ n: number }>("select count(*)::int as n from billing_checkouts where user_id = $1", [userId]),
  ]);

  return {
    user,
    profile,
    links,
    sub,
    plan: realPlan(sub),
    invoices,
    stats: stats ?? { views: 0, clicks: 0, visitors: 0, last_event: null },
    sessions: sessions ?? { active: 0, last_login: null },
    checkouts: checkouts?.n ?? 0,
  };
}
