-- Formulários: respostas de formulários de sites externos (ex.: site do cliente), gravadas a cada etapa.
-- Uma resposta começa "partial" e vira "complete" quando a pessoa envia; assim dá para ver quem parou no meio.
-- O formulário é criado pelo admin para uma conta; a chave da API não é gravada: é um HMAC
-- (APP_SECRET + id + key_version), e trocar a chave só incrementa key_version.

create table forms (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  key_version integer not null default 1,
  created_at timestamptz not null default now()
);
create index forms_owner_idx on forms (owner_id);

create table form_responses (
  id uuid primary key default gen_random_uuid(),
  form_id uuid not null references forms (id) on delete cascade,
  -- id gerado no navegador de quem responde; cada etapa reenvia o mesmo id e atualiza a linha
  client_id uuid not null,
  status text not null default 'partial' check (status in ('partial', 'complete')),
  -- [{ "id": "...", "label": "...", "value": "..." }] na ordem das perguntas
  answers jsonb not null default '[]'::jsonb,
  -- quantas perguntas foram respondidas e quantas o formulário tem (para "parou na 4 de 13")
  step integer not null default 0 check (step >= 0),
  total_steps integer not null default 0 check (total_steps >= 0),
  -- extraídos das respostas para listar e chamar no WhatsApp sem abrir o JSON
  contact_name text check (char_length(contact_name) <= 120),
  contact_phone text check (char_length(contact_phone) <= 30),
  page_url text check (char_length(page_url) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (form_id, client_id)
);
create index form_responses_form_updated_idx on form_responses (form_id, updated_at desc);
