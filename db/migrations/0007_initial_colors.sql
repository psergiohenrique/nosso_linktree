-- Cores do círculo com a inicial, que aparece no lugar da foto quando não há uma.
-- Null: segue as cores do botão, como antes desta migração.
alter table profiles
  add column initial_bg_color text check (initial_bg_color ~ '^#[0-9a-f]{6}$'),
  add column initial_text_color text check (initial_text_color ~ '^#[0-9a-f]{6}$');
