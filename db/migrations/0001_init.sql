-- Linkbio — esquema inicial (PostgreSQL 16)
-- Sem RLS: toda consulta filtra pelo dono no código (src/server/).

create extension if not exists pgcrypto;

create table users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique check (email = lower(email)),
  password_hash text not null,
  created_at timestamptz not null default now()
);

create table sessions (
  -- sha256 do token do cookie; o token em si nunca é gravado
  id text primary key,
  user_id uuid not null references users (id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index sessions_user_idx on sessions (user_id);

-- Imagens enviadas (avatar e miniaturas dos links), guardadas no próprio banco.
create table media (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references users (id) on delete cascade,
  mime text not null check (mime in ('image/png', 'image/jpeg', 'image/webp', 'image/gif')),
  size integer not null check (size > 0 and size <= 2097152),
  bytes bytea not null,
  created_at timestamptz not null default now()
);
create index media_owner_idx on media (owner_id);

create table profiles (
  id uuid primary key references users (id) on delete cascade,
  slug text not null unique check (slug ~ '^[a-z0-9-]{3,30}$'),
  display_name text not null default '' check (char_length(display_name) <= 60),
  bio text not null default '' check (char_length(bio) <= 200),
  avatar_id uuid references media (id) on delete set null,
  -- Aparência
  bg_type text not null default 'solid' check (bg_type in ('solid', 'gradient')),
  bg_color text not null default '#f4f2ec' check (bg_color ~ '^#[0-9a-f]{6}$'),
  bg_color2 text not null default '#d9dcf6' check (bg_color2 ~ '^#[0-9a-f]{6}$'),
  text_color text not null default '#17181a' check (text_color ~ '^#[0-9a-f]{6}$'),
  button_color text not null default '#ffffff' check (button_color ~ '^#[0-9a-f]{6}$'),
  button_text_color text not null default '#17181a' check (button_text_color ~ '^#[0-9a-f]{6}$'),
  button_style text not null default 'rounded'
    check (button_style in ('rounded', 'pill', 'square', 'outline', 'shadow')),
  font text not null default 'manrope' check (font in ('manrope', 'bricolage', 'serif', 'mono')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table links (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles (id) on delete cascade,
  kind text not null default 'link' check (kind in ('link', 'whatsapp')),
  title text not null check (char_length(title) between 1 and 80),
  url text not null check (char_length(url) <= 2048),
  thumbnail_id uuid references media (id) on delete set null,
  position integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index links_profile_position_idx on links (profile_id, position);

-- Analytics. Não guarda IP nem cookie: só um hash diário (IP + navegador + perfil + dia + segredo),
-- usado para contar visitantes únicos e descartar repetições.
create table events (
  id bigint generated always as identity primary key,
  profile_id uuid not null references profiles (id) on delete cascade,
  link_id uuid references links (id) on delete set null,
  type text not null check (type in ('view', 'click')),
  source text not null default 'direto',
  referrer_host text,
  device text check (device in ('mobile', 'desktop')),
  visitor_hash text not null,
  created_at timestamptz not null default now()
);
create index events_profile_created_idx on events (profile_id, created_at desc);
create index events_visitor_idx on events (profile_id, visitor_hash, created_at desc);
