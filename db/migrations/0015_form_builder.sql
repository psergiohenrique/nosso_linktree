-- Construtor de formulários: o dono monta as perguntas no painel e publica em /<slug>/f/<form_slug>.
-- fields = null é formulário externo (o site do cliente manda as respostas pela API com a chave).
-- Formulários deixam de ser liberados por "ter um formulário": o admin liga users.forms_enabled.

alter table forms
  add column slug text check (slug ~ '^[a-z0-9-]{2,40}$'),
  add column fields jsonb,
  add column title text not null default '' check (char_length(title) <= 120),
  add column intro text not null default '' check (char_length(intro) <= 500),
  add column thank_you text not null default '' check (char_length(thank_you) <= 300),
  add column is_published boolean not null default false,
  add column notify_email boolean not null default true,
  add column updated_at timestamptz not null default now();

-- Endereço único por dono (dois clientes podem ter /a/f/orcamento e /b/f/orcamento).
create unique index forms_owner_slug_idx on forms (owner_id, slug) where slug is not null;

alter table users add column forms_enabled boolean not null default false;
-- Quem já tinha formulário (criado pelo admin) continua com acesso.
update users set forms_enabled = true where exists (select 1 from forms f where f.owner_id = users.id);

-- Respostas do formulário público entram no limite por IP.
alter table auth_attempts drop constraint auth_attempts_action_check;
alter table auth_attempts add constraint auth_attempts_action_check
  check (action in ('signin', 'signup', 'reset', 'verify', 'form'));
