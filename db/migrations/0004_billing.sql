-- Cobrança (plano Pro) via Asaas: assinatura por usuário, faturas espelhadas e fila de eventos do webhook.
-- Regras de negócio em src/lib/billing.ts e src/server/billing.ts.

-- Uma linha por usuário, criada no primeiro checkout. Sem linha = plano Grátis.
create table subscriptions (
  user_id uuid primary key references users (id) on delete cascade,
  -- pending: checkout aberto, nunca pagou · active: pago · past_due: cobrança falhou, em carência
  -- expired: carência acabou sem pagamento. Cancelamento é canceled_at (vale até current_period_end).
  status text not null default 'pending' check (status in ('pending', 'active', 'past_due', 'expired')),
  cycle text not null default 'monthly' check (cycle in ('monthly', 'yearly')),
  gateway_customer_id text unique,
  gateway_checkout_id text,
  gateway_subscription_id text unique,
  current_period_end timestamptz,
  grace_ends_at timestamptz,
  canceled_at timestamptz,
  activated_at timestamptz,
  -- Pro de cortesia (ex.: pacote com site), definido à mão; vale enquanto for futuro.
  courtesy_until timestamptz,
  -- Só bandeira e 4 últimos dígitos, vindos do webhook; nenhum dado de cartão é guardado.
  card_brand text,
  card_last4 text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Espelho das cobranças do Asaas. O Asaas é a fonte da verdade; aqui só se copia.
create table invoices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  gateway_payment_id text not null unique,
  status text not null check (status in ('open', 'paid', 'failed', 'refunded', 'canceled')),
  amount_cents integer not null,
  due_at timestamptz not null,
  period_end timestamptz not null,
  paid_at timestamptz,
  invoice_url text,
  receipt_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index invoices_user_idx on invoices (user_id, due_at desc);

-- Caixa de entrada do webhook: gateway_event_id único torna a entrega repetida inofensiva.
create table billing_events (
  id bigint generated always as identity primary key,
  gateway_event_id text not null unique,
  type text not null,
  payload jsonb not null,
  processed_at timestamptz,
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  error text,
  created_at timestamptz not null default now()
);
create index billing_events_pending_idx on billing_events (next_attempt_at) where processed_at is null;
