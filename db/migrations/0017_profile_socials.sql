-- Redes sociais independentes dos links; perfis existentes começam sem redes ativas.
alter table profiles
  add column social_position text not null default 'below_name'
    check (social_position in ('below_name', 'after_links')),
  add column social_links jsonb not null default '{"instagram":{"url":"","is_active":false},"facebook":{"url":"","is_active":false},"tiktok":{"url":"","is_active":false},"youtube":{"url":"","is_active":false},"linkedin":{"url":"","is_active":false},"x":{"url":"","is_active":false}}'::jsonb
    check (jsonb_typeof(social_links) = 'object');
