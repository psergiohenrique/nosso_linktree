-- Métricas ampliadas: cidade (cabeçalhos de geolocalização da Vercel) e campanhas (UTM) em cada evento,
-- e preferências do resumo semanal por e-mail. Só adiciona colunas; nada é reescrito.

alter table events
  add column city text check (char_length(city) <= 80),
  add column region text check (char_length(region) <= 10),
  add column country text check (char_length(country) <= 2),
  add column utm_source text check (char_length(utm_source) <= 60),
  add column utm_medium text check (char_length(utm_medium) <= 60),
  add column utm_campaign text check (char_length(utm_campaign) <= 60);

-- Resumo semanal: ligado por padrão, com descadastro pelo link do e-mail ou pelo painel.
-- weekly_report_sent_at evita mandar duas vezes na mesma semana se o cron repetir.
alter table users
  add column weekly_report boolean not null default true,
  add column weekly_report_sent_at timestamptz;
