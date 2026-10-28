-- Permite ocultar a foto ou o círculo com a inicial na página pública.
alter table profiles add column show_avatar boolean not null default true;
