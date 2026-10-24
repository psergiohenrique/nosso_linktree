-- Confirmação de e-mail no cadastro: código de 6 dígitos enviado por e-mail.

-- null = e-mail ainda não confirmado. Contas que já existiam contam como confirmadas.
alter table users add column email_verified_at timestamptz;
update users set email_verified_at = created_at;

-- Um código vivo por usuário; reenviar substitui o anterior.
create table email_verifications (
  user_id uuid primary key references users (id) on delete cascade,
  -- sha256 (segredo + usuário + código); o código em si nunca é gravado
  code_hash text not null,
  -- palpites errados contra este código; no limite ele deixa de valer
  attempts int not null default 0,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

-- Reenvio do código entra no limite de tentativas.
alter table auth_attempts drop constraint auth_attempts_action_check;
alter table auth_attempts add constraint auth_attempts_action_check
  check (action in ('signin', 'signup', 'reset', 'verify'));
