-- Dados do cadastro: nome, sobrenome e Instagram da pessoa (contas antigas ficam em branco).
alter table users
  add column first_name text not null default '' check (char_length(first_name) <= 60),
  add column last_name text not null default '' check (char_length(last_name) <= 60),
  -- Só o usuário, sem @ nem URL.
  add column instagram text check (instagram ~ '^[a-z0-9._]{1,30}$');
