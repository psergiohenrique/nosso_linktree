-- Todo checkout aberto, e não só o último. A conta Asaas é compartilhada com o Ambiento e o
-- primeiro pagamento só se liga ao usuário pelo id do checkout (checkoutSession). Quem abre dois
-- checkouts e paga pelo primeiro precisa ser reconhecido; checkout que não está aqui é de outro
-- produto e o evento é ignorado.
create table billing_checkouts (
  id text primary key,
  user_id uuid not null references users (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index billing_checkouts_user_idx on billing_checkouts (user_id);

insert into billing_checkouts (id, user_id)
select gateway_checkout_id, user_id from subscriptions where gateway_checkout_id is not null
on conflict do nothing;
