-- Formato e tamanho por link
--   layout: button (botão, com miniatura opcional) · featured (imagem grande em cima) · tile (bloco quadrado, 2 por linha)
--   size:   sm · md · lg (altura e texto do botão)
alter table links
  add column layout text not null default 'button' check (layout in ('button', 'featured', 'tile')),
  add column size text not null default 'md' check (size in ('sm', 'md', 'lg'));
