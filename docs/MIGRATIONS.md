# Migrações

Os arquivos em `db/migrations` são SQL puro, numerados (`0001_init.sql` …). `scripts/migrate.mjs` aplica os que ainda não estão em `schema_migrations`, em ordem de nome. Cada arquivo roda na própria transação. A tabela guarda o nome e o sha256 do arquivo. Se um arquivo já aplicado mudar, o comando para e não aplica o que vem depois.

O build de Production na Vercel roda esse script **antes** de `next build`. Preview e development saem sem abrir conexão. Falha de migração faz o deploy falhar, e a versão que já está no ar continua.

## Comandos

- `npm run db:migrate` — banco do `.env.local` (Postgres do Docker).
- `npm run db:migrate:prod` — banco do `.env.neon`.
- `npm run db:migrate:baseline` — marca, sem executar, as migrações cujo esquema já existe no banco local.
- `npm run db:migrate:prod:baseline` — o mesmo, em produção. É o passo único descrito abaixo.

`--through 0013_show_avatar.sql` (junto com `--baseline`) não marca nada além daquele arquivo e recusa o comando inteiro se ele ainda não estiver aplicado. Sem `--through`, o baseline percorre os arquivos em ordem e para no primeiro cujo esquema não existe.

## Uma vez em produção

O banco de produção já recebeu as migrações antigas à mão, sem linha em `schema_migrations`. O primeiro build com este runner tentaria rodar `0001_init.sql` de novo, falharia (`users` já existe) e **não publicaria**. Faça o baseline **antes** de mergear, no commit que vai para a `main`.

1. Na Vercel, só no ambiente **Production** (não marque Preview nem Development), crie `DATABASE_URL_MIGRATIONS` com a connection string **direta** do Neon. O host não pode ter `-pooler` e a porta não pode ser 6543. Copie a string do painel do Neon (ela já traz `sslmode=require`). A variável precisa valer no build: valor sensível ainda é injetado no build, só não volta no `vercel env pull`. Não coloque essa URL em Preview.
2. No `.env.neon` (fora do git), use a mesma URL direta em `DATABASE_URL_MIGRATIONS` ou, se for a única URL do arquivo, em `DATABASE_URL`. Se `DATABASE_URL` for a do pooler, o script recusa. A role precisa ser a dona das tabelas (a mesma que já aplica SQL hoje): o baseline olha `information_schema` e, sem permissão para ver a tabela, trata a migração como não aplicada e não marca nada.
3. Na árvore deste commit: `npm run db:migrate:prod:baseline`.
4. Leia a saída. Cada linha `baseline: 0001_init.sql` foi só registrada (nome + checksum), sem SQL de migração. A linha `baseline parou antes de …` é a primeira migração cujo esquema **não** está no banco; ela e as seguintes ficam pendentes.
5. Confira esse corte com o banco. Se o comando marcou uma migração que produção não tem, não faça o deploy. Se parou antes de uma que já está aplicada, o próximo deploy tenta rodá-la de novo, falha e não publica — rode o baseline de novo depois de corrigir a causa (ele não remarca o que já tem checksum igual).
6. Merge. O build de Production aplica só o que ficou pendente e então gera o Next. Preview não conecta.

O `main` deste repositório já tem arquivos além de `0013_show_avatar.sql` (`0014` formulários até `0017` redes). O baseline marca esses também se as tabelas ou colunas já existirem. Não use `--through 0013_show_avatar.sql` se `0014` ou posterior já tiver sido aplicado à mão: eles ficariam sem registro e o deploy tentaria criá-los de novo.

Banco local novo não usa baseline. `npm run db:migrate` cria tudo. Quem já rodou o script antigo ganha a coluna `checksum` na primeira execução; checksum vazio é preenchido com o hash do arquivo atual, sem reexecutar.

## Conexão

Ordem: `DATABASE_URL_MIGRATIONS`, depois `DATABASE_URL_UNPOOLED`, depois `POSTGRES_URL_NON_POOLING`, por último `DATABASE_URL`. As três primeiras têm de ser diretas. `DATABASE_URL` só serve se o host não for de pooler. O script escreve o **nome** da variável, nunca a URL. Erros passam por um filtro que troca `postgresql://…` por `postgresql://[redacted]`.

O lock é `pg_try_advisory_lock` na sessão (não funciona em pooler no modo transação). Outro deploy espera até 60s e, se não conseguir, sai com erro e não publica.

## Ao adicionar uma migração

Crie o próximo arquivo numerado. Não edite um arquivo que já tenha rodado: o checksum diverge e o deploy quebra. Não use `BEGIN`, `COMMIT`, `ROLLBACK` nem `CREATE INDEX CONCURRENTLY` dentro do arquivo; o runner abre a transação.

Se a migração pode já estar aplicada em produção antes de existir em `schema_migrations`, acrescente a sentinela dela em `SENTINELS` (`scripts/migrations.mjs`): a tabela ou a coluna que só esse arquivo cria. Sem sentinela, o baseline para antes do arquivo e não marca no escuro. O teste `loadMigrationFiles` exige sentinela para cada arquivo que já está no repositório.

Migrações novas, daqui pra frente, entram no deploy de Production sozinhas. Não é preciso rodar `db:migrate:prod` antes do push, desde que o baseline único já tenha sido feito.

## Riscos

- O SQL roda no build, antes de a build terminar. Se o `next build` falhar depois, o esquema novo fica no banco e o site no ar ainda é o anterior. Migração tem de conviver com o código antigo (só adicionar; não apagar nem renomear coluna que o código velho usa).
- Cada arquivo é uma transação. Se o terceiro falha, os dois primeiros permanecem. O deploy não publica. O código antigo precisa tolerar essas colunas novas.
- Sentinela errada marca uma migração que não rodou por completo. A sentinela é um objeto criado por aquele arquivo; a saída do baseline tem de ser lida por uma pessoa.
- Sentinela ausente ou cedo demais faz o deploy falhar ao recriar um objeto que já existe. A versão anterior continua no ar.
- A primeira tentativa sem baseline pode criar `schema_migrations` vazia. Isso não altera o restante do esquema. O baseline seguinte preenche a tabela.
- Quem puder mudar arquivo já aplicado muda o esquema que o deploy aceita. O checksum existe para impedir edição silenciosa, não para substituir revisão do PR.
