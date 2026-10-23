-- Cor do botão de WhatsApp: verde do WhatsApp (padrão, como antes), igual aos outros botões ou cores próprias.
alter table profiles
  add column whatsapp_style text not null default 'green' check (whatsapp_style in ('green', 'theme', 'custom')),
  add column whatsapp_color text not null default '#1f9d55' check (whatsapp_color ~ '^#[0-9a-f]{6}$'),
  add column whatsapp_text_color text not null default '#ffffff' check (whatsapp_text_color ~ '^#[0-9a-f]{6}$');
