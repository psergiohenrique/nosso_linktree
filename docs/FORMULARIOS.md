# Formulários — estado técnico e operação

Este documento descreve o código do repositório, não confirma implantação ou configuração em produção. Formulários tem dois modos: construtor hospedado e integração de site externo. O acesso é uma liberação administrativa, ainda sem decisão de plano comercial.

## Acesso e gestão

Em `/admin/contas/[id]`, um administrador libera ou revoga `users.forms_enabled` independentemente da criação de formulários externos. Com acesso liberado, a conta vê `/dashboard/formularios`, cria e gerencia formulários do construtor e consulta respostas próprias. Sem acesso, painel e ações são bloqueados, formulários públicos deixam de receber respostas e as chaves externas são rejeitadas. Revogar não apaga dados nem troca chaves: ao liberar novamente, eles voltam a funcionar. Não há RLS: as consultas do painel filtram pelo dono no servidor.

No construtor, crie um rascunho, edite nome, título, endereço, introdução, agradecimento e perguntas, confira a prévia (não envia respostas) e publique em `/<slug-do-perfil>/f/<slug-do-formulario>`. Há perguntas de texto curto/longo, telefone, e-mail, escolha única ou múltipla, obrigatórias ou opcionais, com até 30 perguntas; escolhas aceitam opção “Outro”. Pode-se ativar aviso por e-mail ao dono para resposta completa, copiar o endereço e adicionar um link à página, sujeito às regras de links do plano. O painel lista respostas completas e incompletas, permite filtrar, consultar detalhes, excluir resposta e iniciar acompanhamento pelo WhatsApp quando há telefone. Excluir um formulário do construtor apaga suas respostas; há confirmação. Formulários externos são administrados pelo admin, não editados no construtor.

A proteção contra links quebrados exige remover primeiro o link da aba Links antes de mudar o endereço do formulário ou do perfil, despublicar ou excluir o formulário. **Limitação:** a verificação compara URLs específicas; URLs equivalentes podem escapar, e verificações e alterações concorrentes não são atômicas. Confira links manualmente após mudanças; links externos e favoritos também não são atualizados automaticamente.

## Respostas, recuperação e conflitos

O formulário público envia etapas para `POST /api/forms/publico` e valida perguntas no servidor; respostas podem ser salvas antes da conclusão. O progresso, incluindo respostas, fica em `sessionStorage` da aba para recuperação após recarregar, quando as perguntas não mudaram; é removido após envio bem-sucedido ou ao fechar a aba. Se o armazenamento ou envio falhar, há aviso, mas não há garantia de recuperação. Prévia não salva nem envia.

O envio público usa versões para detectar atualizações obsoletas e protege respostas completas contra sobrescrita. A fila ordena envios da mesma instância, mas cópias em abas ou requisições interrompidas podem gerar conflito 409: o usuário deve abrir um novo formulário; não há mesclagem automática nem recuperação automática do conflito. A API externa usa protocolo separado sem versionamento: parciais atrasadas após conclusão são ignoradas, mas atualizações concorrentes de parciais não têm resolução de conflitos equivalente.

## Integração externa servidor a servidor

O admin cria o formulário externo e obtém sua chave em `/admin/contas/[id]`; criar não libera o acesso da conta. O site do cliente mantém sua própria interface e envia cada etapa do seu **servidor** a `POST /api/forms/respostas`, com `Authorization: Bearer <chave-do-formulario>` e JSON. Nunca exponha a chave no navegador, repositório ou logs; a rota não habilita CORS. A chave é derivada de `FORMS_KEY_SECRET` (ou `APP_SECRET` como fallback), id e versão, não armazenada. Trocar a chave no admin invalida a anterior imediatamente; trocar o segredo de assinatura invalida todas as chaves correspondentes e exige atualizar integrações.

Corpo: `responseId` UUID estável para a mesma resposta, `status` (`partial` ou `complete`), `answers` como lista de `{id, label, value}`, `step` e `totalSteps`; opcionais `contact: {name, phone}` e `pageUrl`. Até 50 respostas; campos longos são truncados conforme `src/lib/forms.ts`. Nome e telefone também são extraídos de ids conhecidos. O par formulário/UUID identifica a resposta; uma parcial não reverte uma completa. Retornos: 401 chave inválida ou acesso revogado, 400 payload inválido, 413 corpo grande, 429 limite, ou 200 com `result` (`saved` ou `ignored`). O limite é de 300 novas respostas por formulário por hora; atualizações existentes não contam como novas. O site integrador é responsável por tratamento de erros, recuperação e informação de privacidade ao visitante.

## Migrações e limpeza

Aplique as migrações em ordem antes de publicar código dependente: `npm run db:migrate` no banco local, ou `npm run db:migrate:prod` no banco de produção configurado para o script, após confirmar o destino. `0014_forms.sql` cria formulários e respostas; `0015_form_builder.sql` adiciona campos do construtor e `users.forms_enabled`, habilitando contas que já tinham formulário; `0016_public_response_version.sql` adiciona a versão opcional das respostas públicas. Não presumir que qualquer ambiente já esteja migrado: confira `schema_migrations` no ambiente correto.

`GET /api/cron/forms` exige `Authorization: Bearer <CRON_SECRET>` e retorna a contagem `deleted`; sem segredo configurado ou autorização correta retorna 401. Remove somente respostas `partial` sem atualização há mais de 180 dias; respostas completas não são removidas por essa rotina. Também há limpeza oportunista em parte dos salvamentos, que não substitui um agendamento confiável. **O endpoint não está agendado em `vercel.json`**: antes do lançamento, configure um agendador que envie o cabeçalho autenticado, escolha frequência, monitore falhas e confirme execução no ambiente de destino. Não registre o valor do segredo.

## Privacidade e decisões de lançamento

Respostas podem conter dados pessoais, inclusive de pessoas que não concluíram. A página pública informa salvamento parcial e armazenamento na aba; o dono pode excluir respostas individualmente. O limite por IP usa chaves em hash em `auth_attempts` para controle de abuso; não confundir essa operação com analytics de visitas. A integração externa deve informar sua própria coleta. Evite coletar dados desnecessários ou sensíveis e restringir o acesso operacional às respostas e chaves.

A exclusão de parciais após 180 dias é o comportamento técnico atual, não uma política jurídica aprovada nem garantia de conformidade. Antes do lançamento, definir com responsáveis de produto e assessoria apropriada: planos, preços e limites de formulários/respostas; prazo de retenção para parciais e completas, backups e procedimentos de exclusão; avisos, finalidade, responsabilidades e atendimento aos titulares; monitoramento e operação do cron. Até essas decisões, não prometer um plano ou prazo de retenção das completas.
