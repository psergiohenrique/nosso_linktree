-- Tema "Areia" e imagem de capa no perfil

alter table public.profiles
  add column if not exists cover_url text
    check (cover_url is null or char_length(cover_url) <= 2048);

alter table public.profiles drop constraint if exists profiles_theme_check;
alter table public.profiles
  add constraint profiles_theme_check
  check (theme in ('light', 'dark', 'sunset', 'sand'));
