# Banco de Leads - Estrutura Central

## Objetivo

O Banco de Leads deve ser a base central de informacoes comerciais e comportamentais do sistema. Ele nao deve ser apenas uma lista de contatos. Ele precisa funcionar como o lugar onde o lead nasce, evolui, recebe classificacoes, acumula dados de interesse/dor e fica pronto para entrar em fluxos de comunicacao e oportunidades comerciais.

O fluxo principal sera:

1. Lead entra por formulario de topo de funil.
2. Sistema cria ou atualiza o perfil central do lead.
3. Sistema classifica o lead por persona, interesse e origem.
4. Lead entra em uma regua de comunicacao no RD Station.
5. Lead responde ferramentas, diagnosticos ou formularios complementares.
6. Sistema atualiza o perfil do lead com novas respostas.
7. Sistema identifica dor, maturidade e intencao.
8. Lead recebe nova classificacao/tag.
9. Lead entra em fluxo de fundo de funil conectado a dor identificada.

## Principio Central

O email deve continuar sendo a chave principal de identificacao do lead.

Quando chegar qualquer novo dado com o mesmo email, o sistema deve:

- nao criar duplicado;
- atualizar o lead existente;
- preservar historico;
- preencher campos novos;
- nunca apagar informacao boa com dado vazio;
- registrar a origem da interacao;
- registrar o momento da conversao ou resposta.

## Fontes de Entrada

### 1. Conteudos ricos

Exemplos:

- ebooks;
- webinars;
- planilhas;
- checklists;
- guias;
- pesquisas;
- materiais de benchmarking.

Esses formularios normalmente capturam dados de topo de funil.

Campos esperados:

- nome;
- email;
- telefone;
- empresa;
- cargo;
- segmento;
- tamanho da operacao;
- cidade/estado;
- origem;
- campanha;
- conteudo baixado;
- landing page;
- UTMs.

### 2. Ferramentas

Exemplos:

- calculadoras;
- simuladores;
- avaliadores;
- geradores;
- diagnosticos rapidos.

Esses formularios devem ser mais ricos do que os de conteudo. Eles ajudam a entender contexto e dor.

Campos esperados:

- tipo de negocio;
- volume de leads;
- investimento em midia;
- principal desafio;
- stack atual;
- maturidade digital;
- canal principal;
- gargalo comercial;
- urgencia;
- resultado calculado pela ferramenta.

### 3. Diagnosticos

Exemplos:

- diagnostico de marketing;
- diagnostico de conversao;
- diagnostico de CRM;
- diagnostico de performance;
- diagnostico de atendimento.

Esses dados devem alimentar campos estruturados no lead.

Campos esperados:

- dor principal;
- dores secundarias;
- nivel de maturidade;
- prioridade atual;
- tempo para resolver;
- impacto percebido;
- interesse em solucao;
- score de fit;
- score de intencao.

## Entrada Tecnica Recomendada

Todos os formularios devem enviar dados para um endpoint unico de captura de leads.

Endpoint recomendado:

```txt
POST /api/webhooks/leads
```

Esse endpoint deve aceitar payloads de qualquer formulario, ferramenta ou diagnostico, desde que venham com:

- token de seguranca;
- identificador da origem;
- dados do lead;
- dados da conversao;
- dados brutos do formulario.

Tambem deve existir uma area no sistema para criar webhooks de entrada por origem.

Exemplo:

```txt
Banco de Leads > Webhooks de Entrada
```

Cada origem pode ter seu proprio webhook:

```txt
Nome: Ebook Performance 2026
Tipo: Conteudo rico
URL: https://seudominio.com/api/webhooks/leads/wbh_123
Token: ********
Status: Ativo
```

Modelo recomendado para producao:

```txt
POST /api/webhooks/leads/:sourceId
```

Esse formato permite identificar exatamente qual formulario, ferramenta ou diagnostico enviou o lead.

O sistema deve manter tambem um endpoint generico:

```txt
POST /api/webhooks/leads
```

Mas o uso principal deve ser o endpoint com `sourceId`, porque ele permite:

- controle por origem;
- desativar uma origem especifica;
- aplicar tags automaticas por origem;
- mapear campos diferentes por origem;
- auditar erros por formulario;
- evitar que todos os formularios dependam de uma unica configuracao.

### Webhook sem token

Tecnicamente, daria para usar apenas o link do webhook sem token.

Exemplo:

```txt
POST /api/webhooks/leads/wbh_123
```

Mas essa nao deve ser a configuracao padrao para producao.

Problemas de usar webhook sem token:

- qualquer pessoa que descobrir a URL pode enviar leads falsos;
- pode gerar spam no Banco de Leads;
- pode disparar automacoes indevidas no RD Station;
- pode poluir tags, score e historico;
- pode consumir limite de API das integracoes;
- fica mais dificil bloquear abuso sem trocar a URL.

Configuracao recomendada:

```txt
POST /api/webhooks/leads/wbh_123
x-webhook-token: token_secreto_da_origem
```

Para facilitar integracoes simples, o sistema pode permitir webhook sem token apenas quando a origem estiver marcada como:

```txt
Modo de seguranca: URL publica
```

Mesmo assim, esse modo deve ser usado apenas para testes ou formularios onde nao seja possivel enviar headers.

Alternativas para formularios que nao permitem header:

- token via query string;
- token dentro do body;
- URL com segredo longo;
- assinatura HMAC no futuro.

Exemplo com query string:

```txt
POST /api/webhooks/leads/wbh_123?token=token_secreto
```

Exemplo com token no body:

```json
{
  "token": "token_secreto",
  "lead": {
    "email": "lead@empresa.com"
  }
}
```

Recomendacao final:

- producao: webhook com token;
- teste: webhook com URL publica, se necessario;
- formularios limitados: token por query string ou body;
- integracoes avancadas: assinatura HMAC.

### URL secreta no estilo n8n/Make

Ferramentas como n8n e Make normalmente nao exigem token separado. Elas geram uma URL unica, longa e dificil de adivinhar.

O sistema pode seguir esse mesmo modelo para facilitar o uso.

Exemplo:

```txt
https://seudominio.com/api/webhooks/leads/wbh_8f3a91c2d7e64b9a9f2c
```

Nesse caso, o identificador `wbh_8f3a91c2d7e64b9a9f2c` funciona como o segredo do webhook.

Modelo recomendado de experiencia:

- criar webhook;
- sistema gera URL secreta automaticamente;
- usuario copia a URL;
- usuario cola a URL no formulario, landing page, ferramenta, n8n ou Make;
- sistema recebe o POST;
- sistema mostra logs de sucesso ou erro.

Recursos importantes:

- URL longa e aleatoria;
- botao para copiar URL;
- botao para regenerar URL;
- status ativo/inativo;
- historico de execucoes;
- limite basico contra abuso;
- opcao avancada para token/header no futuro.

Se a URL vazar, o usuario deve conseguir regenerar a URL. Quando isso acontecer, a URL antiga deve parar de funcionar.

## Interface de Webhooks de Entrada

O sistema deve ter uma area especifica para configurar os webhooks.

Local recomendado:

```txt
Banco de Leads > Webhooks de Entrada
```

Ou, dentro do Banco de Leads:

```txt
Banco de Leads
- Leads
- Campos personalizados
- Webhooks de entrada
- Regras de classificacao
```

### Lista de webhooks

A tela inicial deve mostrar todos os webhooks criados.

Colunas recomendadas:

- nome;
- tipo;
- status;
- total de envios;
- ultimo envio;
- ultimo status;
- leads criados;
- leads atualizados;
- acoes.

Acoes por webhook:

- copiar URL;
- editar;
- testar;
- ver logs;
- ativar/desativar;
- regenerar URL.

### Criar webhook

Campos recomendados:

- nome;
- tipo;
- descricao;
- status;
- tags automaticas;
- persona padrao opcional;
- dor padrao opcional;
- origem/campanha padrao opcional;
- modo de seguranca.

Tipos iniciais:

- conteudo rico;
- ferramenta;
- diagnostico;
- formulario de contato;
- evento;
- integracao externa;
- outro.

Exemplo:

```txt
Nome: Ebook Performance 2026
Tipo: Conteudo rico
Descricao: Captura leads do ebook de performance
Tags automaticas: origem:ebook-performance, fluxo:interesse
Status: Ativo
Modo de seguranca: URL secreta
```

Ao salvar, o sistema gera a URL:

```txt
https://seudominio.com/api/webhooks/leads/wbh_8f3a91c2d7e64b9a9f2c
```

### Mapeamento de campos

Cada formulario pode enviar campos com nomes diferentes. Por isso, o webhook precisa ter um mapeamento configuravel.

Exemplo:

```txt
email        -> lead.email
nome         -> lead.name
telefone     -> lead.phone
empresa      -> lead.company
cargo        -> lead.jobTitle
desafio      -> answers.principal_desafio
utm_source   -> conversion.utmSource
utm_medium   -> conversion.utmMedium
utm_campaign -> conversion.utmCampaign
```

O sistema deve permitir mapear campos para:

- dados cadastrais do lead;
- dados da conversao;
- respostas do formulario;
- campos personalizados;
- tags;
- metadados tecnicos.

Destinos comuns:

```txt
lead.email
lead.name
lead.phone
lead.company
lead.jobTitle
lead.city
lead.state
conversion.formName
conversion.landingPage
conversion.campaignName
conversion.utmSource
conversion.utmMedium
conversion.utmCampaign
answers.*
customFields.*
metadata.*
```

### Teste de webhook

A tela deve permitir testar o webhook antes de usar em producao.

Formas de teste:

- colar um JSON de exemplo;
- enviar um POST real para a URL;
- usar o ultimo payload recebido como base.

O resultado do teste deve mostrar:

```txt
Lead identificado: joao@empresa.com
Acao: criar novo lead
Conversao: Ebook Performance 2026
Tags aplicadas: origem:ebook-performance, fluxo:interesse
Regras acionadas: Classificar decisor
RD Station: nao enviado / enviado / erro
Status: sucesso
```

Em caso de erro, mostrar de forma clara:

```txt
Erro: email obrigatorio nao encontrado
Campo esperado: lead.email
Campo recebido: e_mail
Sugestao: mapear e_mail -> lead.email
```

### Logs do webhook

Cada webhook deve ter um historico de execucoes.

Dados recomendados:

- data/hora;
- status;
- email identificado;
- lead criado ou atualizado;
- conversao criada ou ignorada;
- tags aplicadas;
- regras executadas;
- envio para RD;
- erro, se existir;
- payload bruto recebido;
- payload normalizado;
- IP de origem;
- user agent.

Status de log:

- sucesso;
- erro de validacao;
- erro de autenticacao;
- erro de processamento;
- erro em integracao externa;
- ignorado por duplicidade.

### Acoes automaticas do webhook

Ao receber um lead, o webhook pode executar acoes automaticas antes ou depois do motor de regras.

Acoes iniciais:

- aplicar tags automaticas;
- definir origem padrao;
- definir tipo de conversao;
- registrar `LeadConversion`;
- rodar motor de regras;
- atualizar contato no RD Station;
- criar conversao no RD Station.

Exemplo:

```txt
Webhook: Ebook Performance 2026

Ao receber lead:
- aplicar tag origem:ebook-performance
- aplicar tag fluxo:interesse
- registrar conversao "Ebook Performance 2026"
- rodar regras de classificacao
- enviar contato para RD Station
```

### Experiencia ideal para o usuario

O fluxo na interface deve ser simples:

1. Usuario cria um webhook.
2. Sistema gera uma URL secreta.
3. Usuario copia a URL.
4. Usuario cola a URL no formulario/ferramenta.
5. Usuario envia um teste.
6. Sistema mostra se o lead entrou corretamente.
7. Usuario ajusta mapeamento se necessario.
8. Webhook fica ativo capturando leads.

Isso deixa o sistema parecido com n8n/Make, mas com foco especifico no Banco de Leads.

Formato recomendado:

```json
{
  "source": "rich_content",
  "event": "form_submit",
  "externalId": "form-123-submission-456",
  "lead": {
    "email": "lead@empresa.com",
    "name": "Nome do Lead",
    "phone": "84999999999",
    "company": "Empresa X",
    "jobTitle": "Gerente de Marketing",
    "city": "Natal",
    "state": "RN"
  },
  "conversion": {
    "formName": "Ebook Guia de Performance",
    "landingPage": "lp.autodromo.com.br/ebook-performance",
    "campaignName": "ebook-performance-2026",
    "utmSource": "meta",
    "utmMedium": "paid_social",
    "utmCampaign": "ebook-performance",
    "utmContent": "criativo-01",
    "utmTerm": ""
  },
  "answers": {
    "segmento": "concessionaria",
    "volume_leads": "100-500",
    "principal_desafio": "qualificacao"
  }
}
```

## Regras de Processamento

### 1. Normalizacao

Antes de gravar:

- email em lowercase;
- telefone limpo e padronizado;
- campos vazios ignorados;
- UTMs padronizadas;
- nomes de campos convertidos para padrao interno;
- origem sempre registrada.

### 2. Deduplicacao

Regra principal:

- mesmo email = mesmo lead.

Regra futura:

- se nao houver email, usar telefone como chave secundaria;
- quando email aparecer depois, mesclar registros.

### 3. Atualizacao segura

Campos cadastrais devem seguir regra de preenchimento inteligente:

- se campo esta vazio, preencher;
- se campo ja existe, preservar;
- se novo valor for mais confiavel, registrar sugestao ou origem;
- nao sobrescrever dado manual sem regra clara.

Campos comportamentais e diagnosticos podem ser atualizados a cada nova interacao.

### 4. Historico de conversoes

Cada formulario, ferramenta ou diagnostico deve virar um registro em `LeadConversion`.

Isso permite saber:

- por onde o lead entrou;
- quantas vezes converteu;
- quais conteudos consumiu;
- quais ferramentas usou;
- qual campanha trouxe o lead;
- qual foi a primeira origem;
- qual foi a ultima interacao.

## Estrutura do Lead

### Dados cadastrais

- email;
- nome;
- telefone;
- empresa;
- cargo;
- cidade;
- estado.

### Primeira origem

Gravada apenas na primeira conversao:

- firstSource;
- firstMedium;
- firstCampaign;
- firstLandingPage;
- firstSeenAt.

### Ultima atividade

Atualizada sempre:

- lastSeenAt;
- ultima conversao;
- ultimo formulario;
- ultima ferramenta;
- ultima dor informada.

### Classificacao

- status do funil;
- score;
- isHot;
- tags;
- persona;
- dor principal;
- nivel de maturidade;
- intencao;
- fit.

## Personas

As personas devem ser calculadas a partir das respostas do lead, nao selecionadas manualmente sempre.

Exemplos de personas:

- gestor de marketing;
- gestor comercial;
- dono/socio;
- profissional de CRM;
- agencia/parceiro;
- operador tecnico;
- decisor executivo.

### Como armazenar

Recomendacao:

- usar `tags` para classificacoes flexiveis;
- usar `customFields` para campos estruturados.

Exemplo:

```json
{
  "persona": "gestor_marketing",
  "dor_principal": "baixa_conversao",
  "maturidade": "intermediaria",
  "fit": "alto",
  "intencao": "media"
}
```

Tags derivadas:

```txt
persona:gestor_marketing
dor:baixa_conversao
maturidade:intermediaria
fit:alto
origem:ebook-performance
```

## Tags

Tags devem ser usadas como sinais de automacao e segmentacao.

Padrao recomendado:

```txt
categoria:valor
```

Exemplos:

- `persona:gestor_marketing`
- `dor:baixa_conversao`
- `dor:baixo_volume_leads`
- `dor:crm_desorganizado`
- `maturidade:baixa`
- `maturidade:intermediaria`
- `maturidade:avancada`
- `fit:alto`
- `fit:medio`
- `fit:baixo`
- `fluxo:interesse`
- `fluxo:fundo_funil`
- `produto:crm`
- `produto:performance`
- `produto:site`

## Campos Estruturados

Tags ajudam automacao, mas nao substituem campos estruturados.

Campos recomendados em `customFields`:

- `persona`;
- `dor_principal`;
- `dores_secundarias`;
- `maturidade_marketing`;
- `maturidade_comercial`;
- `volume_leads_mensal`;
- `investimento_midia`;
- `usa_crm`;
- `crm_atual`;
- `principal_canal`;
- `urgencia`;
- `fit_score`;
- `intent_score`;
- `diagnostico_origem`;
- `proxima_regua`.

## Regua de Interesse

Depois do primeiro cadastro, o lead entra em uma regua de descoberta.

Objetivo:

- entender a dor real;
- coletar dados adicionais;
- diferenciar curiosidade de demanda real;
- identificar melhor oferta/conversa.

Ferramentas da regua:

- pequenos diagnosticos;
- calculadoras;
- quizzes;
- perguntas de maturidade;
- conteudos por dor;
- perguntas de segmentacao.

Cada resposta volta para o Banco de Leads e atualiza:

- tags;
- customFields;
- score;
- status;
- historico de conversoes.

## Integracao com RD Station

O RD Station deve ser usado para disparo e automacao de comunicacao.

O Banco de Leads deve continuar sendo a fonte central de inteligencia.

### O que enviar para o RD

Quando um lead entra ou muda classificacao, enviar/atualizar no RD:

- nome;
- email;
- telefone;
- empresa;
- cargo;
- tags;
- persona;
- dor principal;
- maturidade;
- fit;
- origem;
- campanha;
- etapa do fluxo.

### Como acionar fluxos no RD

O sistema deve adicionar tags no lead que acionam automacoes no RD.

Exemplos:

- `fluxo:interesse`;
- `fluxo:diagnostico_performance`;
- `fluxo:diagnostico_crm`;
- `fluxo:fundo_funil_site`;
- `fluxo:fundo_funil_performance`;

O RD escuta essas tags e dispara a regua correspondente.

## Motor de Regras Configuravel

O sistema deve ter uma area administrativa para configurar classificacoes, tags e acoes sem precisar alterar codigo.

Essa area deve permitir criar regras como:

```txt
SE campo cargo contem "Gerente", "Head", "CEO" ou "Diretor"
ENTAO adicionar tag "perfil:decisor"
```

Outro exemplo:

```txt
SE tag "dor:baixa_conversao" existir
E campo fit for "alto"
ENTAO adicionar tag "fluxo:fundo_funil_conversao"
E enviar conversao para o RD Station
```

### Tipos de regra

As regras devem suportar pelo menos:

- regras por campo;
- regras por resposta de formulario;
- regras por origem/campanha;
- regras por tag existente;
- regras por score;
- regras por status do lead;
- regras por combinacao de condicoes.

### Condicoes

Condicoes recomendadas:

- campo igual a;
- campo contem;
- campo esta preenchido;
- campo esta vazio;
- valor maior que;
- valor menor que;
- tag existe;
- tag nao existe;
- origem igual a;
- campanha igual a;
- formulario igual a.

Exemplos:

```txt
cargo contem "CEO"
cargo contem "Gerente"
principal_desafio igual a "qualificacao"
volume_leads_mensal maior que 100
tag existe "persona:gestor_marketing"
```

### Acoes

Quando uma regra for atendida, o sistema deve conseguir executar acoes.

Acoes recomendadas:

- adicionar tag;
- remover tag;
- atualizar campo estruturado;
- alterar status do lead;
- somar score;
- definir persona;
- definir dor principal;
- definir proxima regua;
- enviar/atualizar contato no RD Station;
- criar conversao no RD Station;
- registrar evento interno no historico do lead.

Exemplo pratico:

```txt
Regra: Classificar decisor

Condicoes:
- cargo contem "Gerente"
- OU cargo contem "Head"
- OU cargo contem "CEO"
- OU cargo contem "Diretor"

Acoes:
- adicionar tag "perfil:decisor"
- somar 15 pontos no score
- atualizar customField "nivel_decisao" = "decisor"
```

Exemplo com RD Station:

```txt
Regra: Enviar para fluxo de interesse

Condicoes:
- tag existe "persona:gestor_marketing"
- tag existe "fluxo:interesse"

Acoes:
- enviar/atualizar contato no RD Station
- criar conversao no RD Station com identificador "Sistema - Entrada Regua Interesse"
- enviar tags atuais do lead para o RD
```

### Prioridade e seguranca das regras

As regras precisam ter controle para evitar comportamento duplicado ou disparos errados.

Cada regra deve ter:

- nome;
- descricao;
- status ativo/inativo;
- prioridade;
- condicoes;
- acoes;
- data da ultima execucao;
- limite de execucao por lead;
- historico de execucao;
- mensagem de erro, se falhar.

Recomendacao:

- regras de classificacao podem rodar sempre que o lead atualizar;
- regras de disparo para RD devem ter trava para nao criar a mesma conversao varias vezes;
- cada acao executada deve ficar registrada no historico do lead.

### Interface recomendada

A tela de configuracao deve ter:

- lista de regras;
- botao para criar regra;
- editor visual de condicoes;
- editor visual de acoes;
- teste de regra com um lead real ou payload exemplo;
- historico de execucoes;
- contador de leads afetados;
- botao de ativar/desativar.

Isso permite que a equipe de marketing ajuste personas, tags e fluxos sem depender de deploy.

## WhatsApp

WhatsApp deve entrar como canal complementar, nao como substituto do email.

Usos recomendados:

- notificacao apos diagnostico;
- convite para ferramenta;
- lembrete de preenchimento;
- contato comercial quando lead atingir score;
- abordagem de fundo de funil.

O sistema deve registrar:

- se o lead aceitou contato por WhatsApp;
- data do envio;
- fluxo enviado;
- resposta, se houver integracao futura.

## Fluxo de Fundo de Funil

Quando o lead revela uma dor clara, ele sai da regua generica de interesse e entra em uma regua especifica.

Exemplos:

### Dor: baixa conversao

Tags:

- `dor:baixa_conversao`
- `fluxo:fundo_funil_conversao`

Conteudos:

- cases;
- diagnostico de LP;
- comparativo de taxa;
- convite para conversa.

### Dor: CRM desorganizado

Tags:

- `dor:crm_desorganizado`
- `fluxo:fundo_funil_crm`

Conteudos:

- checklist de CRM;
- calculadora de perda comercial;
- diagnostico de atendimento;
- convite para conversa.

### Dor: baixo volume de leads

Tags:

- `dor:baixo_volume_leads`
- `fluxo:fundo_funil_aquisicao`

Conteudos:

- estrategia de midia;
- funis por canal;
- benchmark de CPL;
- convite para conversa.

## Status do Lead

Status atual recomendado:

- `LEAD`: entrou no sistema;
- `MQL`: tem perfil e interesse minimo;
- `SQL`: tem dor clara e fit;
- `OPPORTUNITY`: pronto para contato comercial;
- `CLIENT`: virou cliente;
- `LOST`: oportunidade perdida;
- `DISQUALIFIED`: sem fit.

### Regras sugeridas

Lead vira `MQL` quando:

- tem email valido;
- tem empresa ou cargo;
- tem pelo menos uma conversao relevante;
- tem persona identificada.

Lead vira `SQL` quando:

- tem dor principal identificada;
- tem fit medio ou alto;
- interagiu com ferramenta ou diagnostico.

Lead vira `OPPORTUNITY` quando:

- tem fit alto;
- tem urgencia ou intencao alta;
- pediu contato ou concluiu diagnostico fundo de funil.

## Score

O score deve combinar:

- perfil;
- engajamento;
- dor;
- intencao.

Exemplo inicial:

- +10 por conversao em conteudo rico;
- +20 por ferramenta preenchida;
- +25 por diagnostico concluido;
- +15 se cargo decisor;
- +15 se empresa com fit;
- +20 se dor ligada a produto prioritario;
- +30 se pediu contato.

Faixas:

- 0-30: baixo interesse;
- 31-60: nutricao;
- 61-80: SQL;
- 81+: oportunidade.

## O Papel do Pipedrive

O Pipedrive nao deve ser o banco central de leads.

O Pipedrive tambem nao deve ser fonte de entrada de leads de topo de funil.

Decisao:

- contatos do Pipedrive nao devem criar leads no Banco de Leads;
- pessoas do Pipedrive nao devem aparecer automaticamente como `LEAD`;
- Pipedrive deve atuar apenas depois que o lead ja existir no sistema;
- o Banco de Leads deve nascer de webhooks, formularios, ferramentas, diagnosticos e integracoes de marketing.

Uso recomendado:

- receber apenas leads qualificados ou oportunidades;
- representar etapa comercial;
- registrar deals e receita;
- devolver status comercial para o Banco de Leads.

O que o Pipedrive pode atualizar:

- status comercial de um lead existente;
- ID do negocio;
- valor fechado;
- receita;
- etapa comercial;
- informacoes de oportunidade.

O que o Pipedrive nao pode fazer:

- criar lead novo apenas porque existe um contato no Pipedrive;
- sobrescrever dados bons do Banco de Leads;
- virar origem primaria de contatos;
- poluir o topo de funil com contatos comerciais antigos.

Ou seja:

- topo e meio de funil ficam no Banco de Leads;
- comunicacao fica no RD;
- oportunidades comerciais ficam no Pipedrive;
- o Banco de Leads integra e mostra tudo.

## Arquitetura Recomendada

### Entrada

Todos os formularios, ferramentas e diagnosticos enviam para:

```txt
POST /api/webhooks/leads
```

### Processamento

O backend deve:

1. validar token;
2. normalizar dados;
3. deduplicar por email;
4. criar ou atualizar lead;
5. registrar conversao;
6. calcular campos derivados;
7. aplicar tags;
8. recalcular score;
9. decidir proximo fluxo;
10. sincronizar lead/tag com RD Station.

### Saida

Depois do processamento:

- RD recebe tags e campos;
- dashboards atualizam funil;
- lead aparece no Banco de Leads;
- se virar oportunidade, pode ser enviado para Pipedrive.

## Proximas Implementacoes

### Fase 1 - Captura robusta

- Padronizar payload de entrada.
- Melhorar endpoint `/api/webhooks/leads`.
- Validar token por fonte.
- Criar logs de webhook com status.
- Criar resposta clara para sucesso/erro.

### Fase 2 - Taxonomia

- Criar lista oficial de personas.
- Criar lista oficial de dores.
- Criar padrao oficial de tags.
- Criar campos estruturados iniciais.

### Fase 3 - Motor de classificacao

- Criar regras para persona.
- Criar regras para dor.
- Criar regras para score.
- Criar regras para mudanca de status.
- Criar tela para configurar regras dinamicas.
- Criar acoes configuraveis para tags, campos, score, status e RD Station.
- Criar trava para evitar disparos duplicados no RD.
- Registrar historico das decisoes.

### Fase 4 - RD Station

- Atualizar contato no RD a cada mudanca relevante.
- Enviar tags para acionar fluxos.
- Registrar sucesso/erro de envio.
- Permitir mapear tags do sistema para automacoes RD.

### Fase 5 - Ferramentas e diagnosticos

- Padronizar formularios de diagnostico.
- Criar tipos de diagnostico.
- Salvar respostas em `customFields`.
- Transformar respostas em tags/score/status.

### Fase 6 - Pipedrive

- Definir quando enviar lead ao Pipedrive.
- Criar deal apenas para SQL/Oportunidade.
- Sincronizar status comercial de volta.
- Evitar que Pipedrive sobrescreva dados de topo de funil.

## Decisoes Importantes

1. Banco de Leads sera a fonte central.
2. RD sera ferramenta de comunicacao e automacao.
3. Pipedrive sera ferramenta comercial, nao base primaria.
4. Email sera chave principal de deduplicacao.
5. Tags acionarao fluxos.
6. `customFields` guardara campos estruturados.
7. Conversoes serao historicas e imutaveis.
8. Dados de formulario nunca devem apagar dados bons existentes.
9. Lead deve evoluir por regras claras de persona, dor, score e status.
