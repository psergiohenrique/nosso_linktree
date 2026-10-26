-- Foto de capa opcional da página pública.
alter table profiles
  add column cover_image_id uuid references media (id) on delete set null;
