-- Bloco Pix de chave estática (a chave é do próprio negócio; o Linkbio não custodia o dinheiro).
-- A chave normalizada fica em links.url. Nome e cidade do recebedor ficam em links.config
-- ({"merchantName","merchantCity"}). O BR Code e o QR são calculados na leitura.
-- O spec reservava 0017 para lead_form e pix juntos. Esta fatia só precisa do Pix;
-- o formulário de lead entra numa migração posterior.

do $$
declare
  cname text;
begin
  select c.conname into cname
    from pg_constraint c
   where c.conrelid = 'links'::regclass
     and c.contype = 'c'
     and pg_get_constraintdef(c.oid) ilike '%kind%';
  if cname is not null then
    execute format('alter table links drop constraint %I', cname);
  end if;
end $$;

alter table links add constraint links_kind_check check (kind in ('link', 'whatsapp', 'pix'));

alter table links add column config jsonb;

comment on column links.config is
  'Dados do tipo. Pix: {"merchantName","merchantCity"}. A chave normalizada fica em url.';
