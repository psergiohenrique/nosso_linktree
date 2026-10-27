-- Aparecer no Google: o usuário pode tirar a página da busca (noindex e fora do sitemap).
-- Ligado, a página só é indexada quando tem conteúdo mínimo (regra em src/lib/seo.ts).
alter table profiles add column search_indexing boolean not null default true;
