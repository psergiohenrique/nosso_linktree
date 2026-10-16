-- Limite de tentativas (login, cadastro, recuperação) e recuperação de senha.

-- Cada linha é uma tentativa. A chave é um hash (segredo + e-mail ou IP): nada em texto puro.
-- Linhas com mais de 1 dia são apagadas pelo próprio servidor (src/server/rate-limit.ts).
create table auth_attempts (
  id bigint generated always as identity primary key,
  action text not null check (action in ('signin', 'signup', 'reset')),
  key_hash text not null,
  created_at timestamptz not null default now()
);
create index auth_attempts_key_idx on auth_attempts (action, key_hash, created_at desc);
create index auth_attempts_created_idx on auth_attempts (created_at);

create table password_resets (
  -- sha256 do token enviado por e-mail; o token em si nunca é gravado
  id text primary key,
  user_id uuid not null references users (id) on delete cascade,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index password_resets_user_idx on password_resets (user_id);
