-- Versão opcional apenas para o protocolo do formulário público; integrações externas continuam sem versão.
alter table form_responses add column public_version bigint check (public_version > 0);
