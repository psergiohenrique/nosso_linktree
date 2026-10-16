-- Linkbio — esquema inicial (Supabase / Postgres)

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  slug text not null unique
    check (slug ~ '^[a-z0-9-]{3,30}$'),
  display_name text not null default '',
  bio text not null default '',
  avatar_url text,
  theme text not null default 'light' check (theme in ('light', 'dark', 'sunset')),
  accent text not null default '#4f46e5' check (accent ~ '^#[0-9a-fA-F]{6}$'),
  created_at timestamptz not null default now()
);

create table public.links (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null default 'link' check (kind in ('link', 'whatsapp')),
  title text not null check (char_length(title) between 1 and 80),
  url text not null check (char_length(url) <= 2048),
  position integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index links_profile_position_idx on public.links (profile_id, position);

create table public.events (
  id bigint generated always as identity primary key,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  link_id uuid references public.links (id) on delete set null,
  type text not null check (type in ('view', 'click')),
  referrer text,
  device text check (device in ('mobile', 'desktop')),
  created_at timestamptz not null default now()
);
create index events_profile_created_idx on public.events (profile_id, created_at desc);

-- Row Level Security -------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.links enable row level security;
alter table public.events enable row level security;

create policy "profiles: leitura pública" on public.profiles
  for select using (true);
create policy "profiles: dono insere" on public.profiles
  for insert with check (auth.uid() = id);
create policy "profiles: dono atualiza" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

create policy "links: leitura pública dos ativos" on public.links
  for select using (is_active or auth.uid() = profile_id);
create policy "links: dono insere" on public.links
  for insert with check (auth.uid() = profile_id);
create policy "links: dono atualiza" on public.links
  for update using (auth.uid() = profile_id) with check (auth.uid() = profile_id);
create policy "links: dono exclui" on public.links
  for delete using (auth.uid() = profile_id);

-- events: só o dono lê; ninguém grava direto (apenas via track_event)
create policy "events: dono lê" on public.events
  for select using (auth.uid() = profile_id);

-- Registro de eventos sem expor chave de serviço ---------------------------
create or replace function public.track_event(
  p_profile uuid,
  p_link uuid,
  p_type text,
  p_referrer text,
  p_device text
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_type not in ('view', 'click') then
    return;
  end if;
  if p_link is not null and not exists (
    select 1 from links where id = p_link and profile_id = p_profile
  ) then
    return;
  end if;
  insert into events (profile_id, link_id, type, referrer, device)
  values (
    p_profile,
    p_link,
    p_type,
    left(p_referrer, 200),
    case when p_device in ('mobile', 'desktop') then p_device else null end
  );
end;
$$;
grant execute on function public.track_event to anon, authenticated;

-- Estatísticas do dono logado ----------------------------------------------
create or replace function public.profile_stats(p_days integer default 7)
returns table (link_id uuid, title text, clicks bigint)
language sql
stable
security invoker
as $$
  select l.id, l.title, count(e.id) filter (where e.type = 'click')
  from links l
  left join events e
    on e.link_id = l.id
   and e.created_at >= now() - make_interval(days => p_days)
  where l.profile_id = auth.uid()
  group by l.id, l.title, l.position
  order by l.position;
$$;

create or replace function public.profile_totals(p_days integer default 7)
returns table (views bigint, clicks bigint)
language sql
stable
security invoker
as $$
  select
    count(*) filter (where type = 'view'),
    count(*) filter (where type = 'click')
  from events
  where profile_id = auth.uid()
    and created_at >= now() - make_interval(days => p_days);
$$;
