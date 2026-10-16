# Personalização por cliente e módulos opcionais

O Linkbio tem um **núcleo igual para todos** (página, links, WhatsApp, analytics) e **camadas opcionais** que mudam conforme o negócio do cliente. Este documento mostra como isso funciona hoje e como deve evoluir, usando dois casos reais de demonstração:

1. **Barbearia** — a primeira demonstração.
2. **Arquiteta** — a segunda, que obrigou o produto a ser mais flexível.

Exemplos visuais em HTML, para abrir no navegador: [barbearia](exemplos/barbearia.html) e [arquiteta](exemplos/arquiteta.html). São maquetes: os botões não funcionam e os números são ilustrativos. A página `/demo` do app mostra o exemplo da arquiteta rodando de verdade.

## 1. Comparativo dos dois casos

| | Barbearia | Arquiteta |
|---|---|---|
| Tipo de negócio | Comércio local, serviço rápido e recorrente | Serviço por projeto, ticket alto, venda longa |
| Objetivo da página | Agendar horário | Pedir orçamento e ver portfólio |
| Tema | Pôr do sol | **Areia** (bege, título em serifa) com capa |
| Botão principal | "Agendar pelo WhatsApp" | "Solicitar orçamento pelo WhatsApp" |
| Tabela de preços | **Faz sentido**: preço fixo e público | **Não faz sentido**: o valor depende do projeto, por isso o orçamento |
| Links típicos | Preços, como chegar, Instagram | Portfólio, projetos recentes, visita técnica, Instagram, Pinterest |
| Métrica que importa | Cliques no WhatsApp por dia e horário | Cliques do portfólio ao orçamento |
| Opcionais que ajudariam (futuro) | Agenda online, Pix de sinal, avaliações do Google | Galeria de projetos, formulário de briefing, PDF do portfólio |

A lição: o que é essencial para um cliente (tabela de preços) atrapalha o outro. Por isso a tabela de preços **continua disponível**, mas como uma sugestão, e não como parte fixa da página.

## 2. O que já existe no produto

| Recurso | Estado |
|---|---|
| 4 temas: Claro, Escuro, Pôr do sol, **Areia** | Implementado |
| Imagem de capa no perfil (ou padrão de planta no tema Areia) | Implementado |
| Cor de destaque, avatar e bio por cliente | Implementado |
| Botão de WhatsApp com mensagem pré-pronta | Implementado |
| Sugestões de título de botão por segmento (serviços, portfólio, comércio, redes) | Implementado |
| Ativar/desativar, reordenar e excluir links | Implementado |
| Analytics de visualizações e cliques por link | Implementado |

Migração do banco para tema e capa: `supabase/migrations/0002_tema_areia_capa.sql`.

## 3. Funcionalidades opcionais (proposta, ainda não implementada)

Ideia: cada perfil recebe um conjunto de **módulos** que podem ser ligados ou desligados, e os planos (Grátis, Pro, Business, Agência) decidem quais módulos ficam disponíveis.

| Módulo | Para quem | Plano sugerido |
|---|---|---|
| Captura de lead enviada ao robô de leads | Todos os serviços | Business |
| Formulário de briefing / pedido de orçamento | Arquitetos, consultores | Business |
| Agenda de horários | Barbearias, clínicas, salões | Business |
| Pix e cobrança de sinal | Comércio e serviços | Business |
| Galeria de projetos com fotos | Arquitetos, designers, fotógrafos | Pro |
| Cardápio ou catálogo | Restaurantes, lojas | Pro |
| Domínio próprio e remoção da marca | Todos | Pro / Business |
| Painel multi-cliente e white-label | Agências | Agência |

**Como implementar (sugestão):**
- Uma coluna `features` (jsonb) em `profiles`, ou uma tabela de blocos por página, com tipo e ordem.
- **Modelos por segmento**: ao se cadastrar, o cliente escolhe "Barbearia", "Arquitetura", "Consultoria"… e já recebe tema, botões sugeridos e módulos desse segmento, prontos para ajustar.
- O plano contratado liga ou desliga os módulos (controle no servidor, não só na tela).

## 4. Roteiro para personalizar um novo cliente

1. Entender o negócio: o que a pessoa quer que o visitante faça (agendar, pedir orçamento, comprar)?
2. Escolher o tema e a cor de destaque que combinam com a marca.
3. Colocar foto (avatar) e capa.
4. Definir **um** botão principal, quase sempre o de WhatsApp com mensagem pronta.
5. Montar os demais links na ordem de importância e **remover o que não faz sentido** para esse negócio (ex.: tabela de preços para quem vende projeto).
6. Conferir no celular, que é de onde vem quase todo o acesso.
7. Combinar qual número acompanhar nos primeiros 30 dias.

## 5. Decisões pendentes
- Quais módulos entram primeiro na V2 (sugestão: captura de lead para o robô, depois formulário de briefing).
- Se os modelos por segmento ficam fixos ou editáveis pelo cliente.
- Como cobrar cada módulo: dentro dos planos ou como adicional avulso.
