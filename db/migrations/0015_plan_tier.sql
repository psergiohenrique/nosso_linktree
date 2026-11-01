-- Nível do plano na assinatura (Pro ou Business) e ciclo explícito no checkout.
-- O período de uma cobrança nova sai do ciclo gravado aqui, não do valor: um segundo preço
-- pode existir sem ser confundido com o anual do Pro. Checkout anterior a esta migração fica
-- com cycle null e continua no fallback pelo valor (só os preços do Pro de hoje).
-- Preço e checkout do Business ainda não existem: a coluna só registra o que o webhook disser.

alter table subscriptions
  add column plan text not null default 'pro' check (plan in ('pro', 'business'));

alter table billing_checkouts
  add column plan text not null default 'pro' check (plan in ('pro', 'business')),
  add column cycle text check (cycle is null or cycle in ('monthly', 'yearly'));

comment on column subscriptions.plan is
  'Produto da assinatura. Cortesia continua sendo Pro, mesmo que esta coluna diga business.';
comment on column billing_checkouts.plan is
  'Produto escolhido ao abrir o checkout. O webhook grava isto na assinatura; não se deduz pelo valor.';
comment on column billing_checkouts.cycle is
  'Ciclo escolhido ao abrir o checkout. Null: checkout antigo, período ainda sai do valor da cobrança.';
