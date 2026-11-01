-- Login por link mágico: o token só existe como sha256, é de uso único e vale pouco tempo.
-- Linhas vencidas há mais de um dia são apagadas no cron e na limpeza de auth_attempts.

create table login_links (
  -- sha256 do token enviado por e-mail; o token em si nunca é gravado
  id text primary key,
  user_id uuid not null references users (id) on delete cascade,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index login_links_user_idx on login_links (user_id);

alter table auth_attempts drop constraint auth_attempts_action_check;
alter table auth_attempts add constraint auth_attempts_action_check
  check (action in ('signin', 'signup', 'reset', 'verify', 'magic'));

-- Conta sem senha: quem confirma o e-mail pelo link de uma conta que nunca foi confirmada perde a senha
-- gravada no cadastro (pode ter sido de outra pessoa). O dono define a senha pela redefinição.
alter table users alter column password_hash drop not null;
