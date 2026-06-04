# AutoForce Marketing Hub — API Reference

> **Base URL:** `https://autoforce-performance-1-production.up.railway.app/api`  
> **Autenticação:** Cookie `af_session` (httpOnly) enviado automaticamente pelo browser, ou `Authorization: Bearer <JWT>` como fallback para clientes de API

---

## Índice

- [Autenticação](#autenticação)
- [Health Check](#health-check)
- [Dashboard](#dashboard)
- [Banco de Leads (Lead Hub)](#banco-de-leads-lead-hub)
- [Campos Personalizados](#campos-personalizados)
- [Regras de Classificação](#regras-de-classificação)
- [Webhooks de Entrada](#webhooks-de-entrada)
- [Campanhas](#campanhas)
- [Funis](#funis)
- [Receita (Ganhos)](#receita-ganhos)
- [Analytics GA4](#analytics-ga4)
- [E-mails / RD Station](#e-mails--rd-station)
- [UTM Links](#utm-links)
- [Conexões (Integrações)](#conexões-integrações)
- [**Automações** *(novo)*](#automações)
- [**WhatsApp** *(novo)*](#whatsapp)
- [**Pipedrive Events** *(novo)*](#pipedrive-events)
- [Banco de Dados — Modelos](#banco-de-dados--modelos)

---

## Autenticação

### POST /api/auth/google

Valida o token Google e retorna o usuário.

```json
{ "credential": "<google_id_token>" }
```

Resposta:
```json
{
  "user": {
    "email": "usuario@autoforce.com",
    "name": "Usuario",
    "avatar": "https://...",
    "role": "AutoForce Member"
  }
}
```

```bash
curl -X POST https://SEU-BACKEND/api/auth/google \
  -H "Content-Type: application/json" \
  -d '{"credential":"SEU_TOKEN"}'
```

### GET /api/auth/me

Valida token JWT e retorna o usuário logado.

```bash
curl https://SEU-BACKEND/api/auth/me \
  -H "Authorization: Bearer SEU_TOKEN"
```

### GET /api/auth/google/redirect

Redireciona para o Google OAuth. Usado pelo frontend ao clicar em "Entrar com Google".

---

## Health Check

### GET /api/health

```json
{ "status": "ok", "message": "AutoForce Performance API is running" }
```

```bash
curl https://SEU-BACKEND/api/health
```

---

## Dashboard

### GET /api/dashboard/metrics

KPIs do mês atual (leads, taxa de qualificação, MRR, vendas).

```bash
curl https://SEU-BACKEND/api/dashboard/metrics \
  -H "Authorization: Bearer SEU_TOKEN"
```

### GET /api/dashboard/history

Histórico dos últimos 7 meses para o gráfico de barras.

```bash
curl https://SEU-BACKEND/api/dashboard/history \
  -H "Authorization: Bearer SEU_TOKEN"
```

---

## Banco de Leads (Lead Hub)

### GET /api/lead-hub

Lista leads com paginação e filtros.

**Query params:**
- `page=1`
- `pageSize=50`
- `status=LEAD|MQL|SQL|SCHEDULED|DEMO|PROPOSAL|CLIENT|LOST|DISQUALIFIED`
- `search=texto` (nome, email, empresa, telefone)
- `tag=nome-da-tag`
- `isHot=true|false`
- `startDate=YYYY-MM-DD`
- `endDate=YYYY-MM-DD`
- `customField=nome_campo`
- `customValue=valor`

```bash
curl "https://SEU-BACKEND/api/lead-hub?status=MQL&page=1&pageSize=25" \
  -H "Authorization: Bearer SEU_TOKEN"
```

### POST /api/lead-hub

Cria um lead manualmente.

```json
{
  "email": "joao@empresa.com",
  "name": "João Silva",
  "phone": "(11) 98888-7777",
  "company": "Empresa X",
  "jobTitle": "Gerente",
  "utm_source": "google",
  "utm_medium": "cpc",
  "utm_campaign": "autodromo-q1"
}
```

### GET /api/lead-hub/funnel

Contagem de leads por status para a barra de funil.

### GET /api/lead-hub/tags

Todas as tags existentes no sistema.

### GET /api/lead-hub/export

Exporta CSV com os mesmos filtros de `GET /api/lead-hub`.

```bash
curl "https://SEU-BACKEND/api/lead-hub/export?status=CLIENT" \
  -H "Authorization: Bearer SEU_TOKEN" \
  -o leads_clientes.csv
```

### GET /api/lead-hub/id/:id

Retorna a ficha completa do lead: dados, conversões, histórico de status, ganhos, campos personalizados.

```bash
curl https://SEU-BACKEND/api/lead-hub/id/UUID_DO_LEAD \
  -H "Authorization: Bearer SEU_TOKEN"
```

### PATCH /api/lead-hub/id/:id

Atualiza os dados principais do lead.

```json
{
  "name": "Maria Silva",
  "phone": "84999999999",
  "company": "Loja X",
  "jobTitle": "Gerente",
  "city": "Natal",
  "state": "RN",
  "assignedTo": "vendas@autoforce.com",
  "score": 80,
  "isHot": true
}
```

### PATCH /api/lead-hub/id/:id/status

```json
{ "status": "MQL", "reason": "Lead qualificado via regra automática" }
```

**Status válidos:** `LEAD`, `MQL`, `SQL`, `SCHEDULED`, `DEMO`, `PROPOSAL`, `CLIENT`, `LOST`, `DISQUALIFIED`

### PATCH /api/lead-hub/id/:id/notes

```json
{ "notes": "Preferiu contato pela manhã." }
```

### POST /api/lead-hub/id/:id/tags

```json
{ "tag": "alto-potencial" }
```

### DELETE /api/lead-hub/id/:id/tags/:tag

Remove uma tag do lead.

```bash
curl -X DELETE https://SEU-BACKEND/api/lead-hub/id/UUID/tags/alto-potencial \
  -H "Authorization: Bearer SEU_TOKEN"
```

### GET /api/lead-hub/id/:id/conversions

Todas as conversões do lead (histórico completo sem limite).

### PATCH /api/lead-hub/id/:id/custom-fields

Atualiza vários campos personalizados em uma chamada.

```json
{
  "fields": {
    "modelo_interesse": "SUV",
    "orcamento": 120000,
    "quer_test_drive": true
  }
}
```

### DELETE /api/lead-hub/id/:id

Remove o lead de forma lógica (`deletedAt`). O histórico físico é preservado.

---

## Campos Personalizados

### GET /api/lead-hub/custom-fields

Lista todas as definições de campos personalizados.

### POST /api/lead-hub/custom-fields

Cria um campo personalizado.

```json
{
  "name": "modelo_interesse",
  "label": "Modelo de interesse",
  "fieldType": "select",
  "options": ["Hatch", "SUV", "Pickup"],
  "placeholder": "Selecione o modelo",
  "required": false,
  "visible": true,
  "sortOrder": 10,
  "sourceHint": "Formulário LP Principal"
}
```

**Tipos aceitos em `fieldType`:** `text`, `number`, `boolean`, `date`, `select`, `url`

### PATCH /api/lead-hub/custom-fields/:id

Atualiza a definição de um campo personalizado.

### DELETE /api/lead-hub/custom-fields/:id

Remove a definição do campo. Os valores já salvos nos leads são preservados.

---

## Regras de Classificação

### GET /api/lead-rules

Lista todas as regras de classificação.

```bash
curl https://SEU-BACKEND/api/lead-rules \
  -H "Authorization: Bearer SEU_TOKEN"
```

### POST /api/lead-rules

Cria uma nova regra.

```json
{
  "name": "Criar no Pipedrive — MQL via Google",
  "priority": 10,
  "isActive": true,
  "conditions": [
    { "field": "tags", "operator": "tag_exists", "value": "maquina-de-vendas" },
    { "field": "firstSource", "operator": "equals", "value": "google" }
  ],
  "conditionLogic": "AND",
  "actions": [
    { "type": "set_status", "value": "MQL" },
    { "type": "pipedrive_create_deal", "pipeline": "novo_cliente" }
  ]
}
```

### GET /api/lead-rules/:id

Detalhe completo de uma regra.

### PATCH /api/lead-rules/:id

Edita uma regra existente (mesma estrutura do POST).

### DELETE /api/lead-rules/:id

Remove uma regra.

### POST /api/lead-rules/:id/run-existing

Executa a regra em todos os leads existentes que correspondem às condições.

```bash
curl -X POST https://SEU-BACKEND/api/lead-rules/RULE_ID/run-existing \
  -H "Authorization: Bearer SEU_TOKEN"
```

Resposta:
```json
{
  "matched": 42,
  "actionsApplied": [...],
  "errors": []
}
```

---

## Webhooks de Entrada

### GET /api/lead-webhooks

Lista os webhooks configurados (rotas protegidas, requer token).

### POST /api/lead-webhooks

Cria um novo webhook.

```json
{
  "name": "Formulário LP Autódromo",
  "type": "RD_STATION",
  "isActive": true,
  "autoTags": ["lp-autodromo", "topo-funil"],
  "defaultSource": "google",
  "defaultMedium": "cpc"
}
```

### PATCH /api/lead-webhooks/:id

Edita um webhook existente.

### DELETE /api/lead-webhooks/:id

Remove um webhook.

### POST /api/webhooks/lead/:publicId

**Endpoint público** — não exige token. Recebe leads de formulários externos.

```bash
curl -X POST https://SEU-BACKEND/api/webhooks/lead/PUBLIC_ID \
  -H "Content-Type: application/json" \
  -d '{
    "email": "joao@empresa.com",
    "name": "João Silva",
    "utm_source": "google",
    "utm_medium": "cpc",
    "utm_campaign": "autodromo-q1"
  }'
```

Resposta:
```json
{ "success": true, "leadId": "UUID", "email": "joao@empresa.com" }
```

---

## Campanhas

### GET /api/campaigns

Todas as campanhas.

### GET /api/campaigns/meta

Campanhas Meta Ads (requer conexão ativa).

**Query params:** `startDate=YYYY-MM-DD`, `endDate=YYYY-MM-DD`

### GET /api/campaigns/google

Campanhas Google Ads (requer conexão ativa).

### POST /api/campaigns

```json
{
  "name": "Campanha Autódromo Q2",
  "platform": "Meta",
  "status": "Ativa",
  "budget": 5000,
  "startDate": "2026-04-01",
  "endDate": "2026-06-30",
  "kpi": "Leads",
  "notes": "Foco em SUV"
}
```

### PUT /api/campaigns/:id

Edita uma campanha.

### DELETE /api/campaigns/:id

Remove uma campanha.

---

## Funis

### GET /api/funnels

Lista todos os funis personalizados.

### POST /api/funnels

Cria um novo funil.

```json
{
  "name": "Funil Google Q2",
  "color": "#2563eb",
  "filterTags": ["google-ads"],
  "filterSource": "google",
  "filterMedium": "cpc",
  "linkedCampaignIds": ["camp-id-1", "camp-id-2"]
}
```

### GET /api/funnels/stats

Estatísticas com filtros.

**Query params:** `funnelId`, `startDate`, `endDate`

### PATCH /api/funnels/:id

Edita um funil.

### DELETE /api/funnels/:id

Remove um funil (soft delete).

---

## Receita (Ganhos)

### GET /api/revenue/transactions

Lista todos os ganhos registrados.

**Query params:**
- `origin=Google Ads`
- `product=Autodromo,Autopilot`
- `startDate=YYYY-MM-DD`
- `endDate=YYYY-MM-DD`

```bash
curl "https://SEU-BACKEND/api/revenue/transactions?origin=Google%20Ads" \
  -H "Authorization: Bearer SEU_TOKEN"
```

Resposta:
```json
[
  {
    "id": "UUID",
    "date": "2026-04-15",
    "businessName": "Loja X",
    "setupValue": 1000,
    "mrrValue": 500,
    "origin": "Google Ads",
    "product": ["Autodromo", "Autopilot"],
    "leadEmail": "cliente@lojax.com"
  }
]
```

### POST /api/revenue/transactions

```json
{
  "date": "2026-04-15",
  "businessName": "Loja X",
  "setupValue": 1000,
  "mrrValue": 500,
  "origin": "Google Ads",
  "product": ["Autodromo", "Autopilot"],
  "leadEmail": "cliente@lojax.com"
}
```

**Origens válidas:** `Google Ads`, `Facebook / Meta`, `Indicacao Parceiro`, `Organico`, `Outros`

**Produtos:** `Autodromo`, `Autopilot`, `Autobot`, `Nitroads`, `Fluxo de IA`, `Associacoes Automotivas`

### PUT /api/revenue/transactions/:id

Edita um registro de ganho.

### DELETE /api/revenue/transactions/:id

Remove um registro de ganho.

---

## Analytics GA4

### GET /api/analytics/landing-pages

Landing pages com métricas do GA4.

**Query params:**
- `startDate=YYYY-MM-DD`
- `endDate=YYYY-MM-DD`
- `hostName=lp.autodromo.com.br`

```bash
curl "https://SEU-BACKEND/api/analytics/landing-pages?startDate=2026-04-01&endDate=2026-04-30" \
  -H "Authorization: Bearer SEU_TOKEN"
```

### POST /api/analytics/sync-ga4

Força sincronização dos dados GA4.

```bash
curl -X POST https://SEU-BACKEND/api/analytics/sync-ga4 \
  -H "Authorization: Bearer SEU_TOKEN"
```

---

## E-mails / RD Station

### GET /api/emails/campaigns

Campanhas de e-mail manuais.

**Query params:** `source=manual`

### GET /api/emails/campaigns/rdstation

Campanhas do RD Station (requer conexão ativa).

### GET /api/emails/campaigns/rdstation/sync

Força sincronização das campanhas RD Station.

### GET /api/emails/automation/rdstation

Workflows/automações do RD Station.

### GET /api/emails/automation/rdstation/sync

Força sincronização das automações.

### GET /api/emails/sync/logs

Logs das últimas sincronizações. **Query params:** `limit=50`

### POST /api/emails/campaigns

Cria uma campanha de e-mail manual.

```json
{
  "name": "Newsletter Maio 2026",
  "date": "2026-05-15",
  "sends": 1200,
  "opens": 350,
  "clicks": 85,
  "conversions": 12,
  "bounce": 5
}
```

### PUT /api/emails/campaigns/:id

Edita uma campanha.

### DELETE /api/emails/campaigns/:id

Remove uma campanha.

---

## UTM Links

### GET /api/utm-links

Lista links UTM com paginação e filtros.

**Query params:** `page`, `pageSize`, `source`, `medium`, `campaign`, `startDate`, `endDate`, `favoritesOnly=true`

### POST /api/utm-links

Cria um link UTM.

```json
{
  "destinationUrl": "https://lp.autodromo.com.br/",
  "utmSource": "google",
  "utmMedium": "cpc",
  "utmCampaign": "autodromo-maio-2026",
  "utmContent": "banner-top",
  "utmTerm": "crm-automotivo"
}
```

Resposta inclui `shortCode` (ex: `abc12`) e URL curta acessível em `GET /r/:code`.

### GET /api/utm-links/templates

Templates de links salvos.

### PATCH /api/utm-links/:id/favorite

Favorita ou desfavorita um link.

### DELETE /api/utm-links/:id

Remove um link.

### GET /r/:code

**Endpoint público.** Redireciona para a URL completa e incrementa o contador de cliques.

```bash
curl -L https://SEU-BACKEND/r/abc12
# 302 → https://lp.autodromo.com.br/?utm_source=google&utm_medium=cpc&...
```

---

## Conexões (Integrações)

### GET /api/connections

Lista o status de todas as plataformas e dados da última sincronização.

```bash
curl https://SEU-BACKEND/api/connections \
  -H "Authorization: Bearer SEU_TOKEN"
```

### GET /api/connections/requirements

Mostra quais variáveis de ambiente faltam para cada plataforma.

```json
[
  {
    "platform": "GOOGLE_ADS",
    "requiredEnv": ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_ADS_DEVELOPER_TOKEN"],
    "missingEnv": [],
    "readyForOAuth": true
  }
]
```

### GET /api/connections/:platform/auth-url

Gera a URL OAuth para iniciar a conexão.

**Plataformas:** `META_ADS`, `GOOGLE_ADS`, `GOOGLE_ANALYTICS`, `RD_STATION`, `PIPEDRIVE`

```bash
curl https://SEU-BACKEND/api/connections/META_ADS/auth-url \
  -H "Authorization: Bearer SEU_TOKEN"
```

### PUT /api/connections/:platform/config

Salva IDs, metadados e credenciais manuais. Tokens são criptografados no banco.

Exemplo — Google Ads:
```bash
curl -X PUT https://SEU-BACKEND/api/connections/GOOGLE_ADS/config \
  -H "Authorization: Bearer SEU_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"metadata":{"customerId":"1234567890"}}'
```

Exemplo — Google Analytics (múltiplas propriedades):
```bash
curl -X PUT https://SEU-BACKEND/api/connections/GOOGLE_ANALYTICS/config \
  -H "Authorization: Bearer SEU_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"metadata":{"propertyIds":"484560591,349265313"}}'
```

Exemplo — Pipedrive com API token:
```bash
curl -X PUT https://SEU-BACKEND/api/connections/PIPEDRIVE/config \
  -H "Authorization: Bearer SEU_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"accessToken":"PIPEDRIVE_API_TOKEN","metadata":{"domain":"autoforce2","authType":"api_token"}}'
```

### POST /api/connections/:platform/sync

Força sincronização manual da plataforma.

```bash
curl -X POST https://SEU-BACKEND/api/connections/META_ADS/sync \
  -H "Authorization: Bearer SEU_TOKEN"
```

### POST /api/connections/:platform/disconnect

Desconecta a plataforma e remove os tokens salvos.

---

## Banco de Dados — Modelos

### Modelos principais

```
Lead                    — central de leads (email como chave única)
LeadConversion          — histórico de conversões (imutável, append-only)
LeadStatusHistory       — auditoria de mudanças de status
LeadCustomFieldDef      — definição dos campos personalizados
LeadClassificationRule  — regras de automação
LeadClassificationRuleExecution — histórico de execuções de regras
LeadWebhookSource       — configuração dos webhooks de entrada
WebhookLog              — log bruto de todos os webhooks recebidos

PlatformConnection      — tokens e configuração de cada integração (criptografado AES-256-GCM)
Campaign                — campanhas (Meta/Google)
CampaignMetrics         — métricas diárias das campanhas
CampaignEvent           — eventos do calendário

UTMLink                 — links gerados com parâmetros UTM
UTMDestination          — destinos de URL salvos para reuso

Funnel                  — funis personalizados
RevenueEntry            — registros de receita
DailyLead               — agregado diário do funil
LandingPage             — dados das landing pages (GA4)

EmailCampaign           — campanhas de e-mail (RD Station + manuais)
WorkflowEmailStat       — stats de automações RD Station

User                    — usuários do sistema
OKR                     — objetivos e resultados-chave
TeamMember              — membros da equipe
AssetItem               — ativos criativos
AssetVersion            — versões dos ativos
SyncLog                 — log de sincronizações com plataformas externas
```

### Migrations em produção

O Prisma gerencia todas as migrations. O comando `prisma migrate deploy` é executado **automaticamente** ao iniciar o servidor (configurado no `start` do `package.json`). Todas as migrations são aditivas — sem perda de dados.

Ordem cronológica:
1. `20260122144227_primeira_versao` — estrutura base
2. `20260523100000_lead_foundation` — banco de leads, plataformas, UTM
3. `20260523200000_lead_custom_fields_pipedrive` — campos personalizados, Pipedrive
4. `20260525000000_add_funnel_model` — funis personalizados
5. `20260527000000_lead_webhook_sources` — webhooks configuráveis
6. `20260527002000_lead_classification_rules` — motor de regras
7. `20260528003000_lead_status_scheduled_demo_proposal` — novos status do funil
8. `20260603000001_add_automation_execution` — tabela de execuções de automações

---

## Autenticação — Cookie httpOnly

> **A partir de Junho/2026**, o sistema migrou de `localStorage` para `httpOnly` cookie.

O cookie `af_session` é definido automaticamente nos endpoints de login e enviado pelo browser em todas as requisições. Por ser `httpOnly`, **não pode ser lido via JavaScript** — proteção contra XSS.

| Ambiente | SameSite | Secure |
|---|---|---|
| Produção (Railway) | `none` | `true` |
| Desenvolvimento | `lax` | `false` |

### POST /api/auth/logout

Limpa o cookie de sessão no servidor.

**Resposta:** `{ "ok": true }`

---

## Automações

### GET /api/automation-journeys

Lista todas as jornadas de automação.

**Resposta:**
```json
[{
  "id": "uuid",
  "name": "Onboarding Novo Lead",
  "status": "ACTIVE",
  "triggerType": "lead_created",
  "isActive": true,
  "nodes": [...],
  "edges": [...],
  "createdAt": "2026-06-01T10:00:00Z",
  "updatedAt": "2026-06-03T14:00:00Z"
}]
```

### POST /api/automation-journeys

Cria nova jornada.

**Body:**
```json
{
  "name": "Nome da jornada",
  "description": "Descrição opcional",
  "status": "DRAFT",
  "nodes": [],
  "edges": [],
  "triggerType": "lead_created",
  "isActive": false
}
```

### PATCH /api/automation-journeys/:id

Atualiza parcialmente uma jornada. Aceita qualquer subconjunto dos campos do POST.

### DELETE /api/automation-journeys/:id

Remove a jornada e todas as execuções associadas (CASCADE).

**Resposta:** `204 No Content`

### GET /api/automation-journeys/:id/executions?limit=50

Lista execuções da jornada, enriquecidas com nome e ID do lead.

**Query:** `limit` (default 50, max 100)

**Resposta:**
```json
[{
  "id": "uuid",
  "journeyId": "uuid",
  "leadEmail": "lead@empresa.com",
  "leadName": "João Silva",
  "leadId": "uuid",
  "status": "completed",
  "currentNodeId": null,
  "resumeAt": null,
  "log": [
    { "nodeId": "n1", "nodeType": "trigger", "status": "ok", "ts": "2026-06-03T12:00:00Z" },
    { "nodeId": "n2", "nodeType": "rd_conversion", "status": "ok", "message": "identifier=lead_qualificado event_uuid=abc123", "ts": "2026-06-03T12:00:01Z" }
  ],
  "error": null,
  "startedAt": "2026-06-03T12:00:00Z",
  "completedAt": "2026-06-03T12:00:02Z"
}]
```

**Status possíveis:**
| Status | Descrição |
|---|---|
| `running` | Execução em andamento |
| `waiting` | Pausada num bloco Esperar — retoma automaticamente |
| `completed` | Concluída com sucesso |
| `failed` | Falhou — ver campo `error` e `log` |

### GET /api/automation-journeys/:id/execution-stats

Contagens por status para o painel de monitoramento.

**Resposta:**
```json
{ "running": 2, "waiting": 5, "completed": 147, "failed": 3, "total": 157 }
```

### POST /api/automation-journeys/:id/test

Executa o fluxo imediatamente para um lead existente (ignora `isActive`).

**Body:** `{ "email": "lead@empresa.com" }`

**Resposta:** `{ "executionId": "uuid" }`

**Erros:**
- `400` — email ausente
- `404` — lead não encontrado na base

---

## WhatsApp

### GET /api/whatsapp/phone-numbers

Lista números vinculados ao Business Account Meta.

**Requer:** `WHATSAPP_ACCESS_TOKEN` + `WHATSAPP_BUSINESS_ACCOUNT_ID`

**Resposta:**
```json
[{
  "id": "1234567890",
  "display_phone_number": "+55 11 99999-0000",
  "verified_name": "Autoforce",
  "quality_rating": "GREEN"
}]
```

### GET /api/whatsapp/templates?phoneNumberId=xxx

Lista templates com status `APPROVED`. Se `phoneNumberId` for informado, resolve o WABA daquele número e retorna apenas os templates dele.

**Query:** `phoneNumberId` (opcional) — deve ser numérico

**Resposta:**
```json
[{
  "id": "tpl_123",
  "name": "boas_vindas_lead",
  "status": "APPROVED",
  "category": "MARKETING",
  "language": "pt_BR",
  "components": [
    { "type": "HEADER", "format": "TEXT", "text": "Olá, {{1}}!" },
    { "type": "BODY", "text": "Bem-vindo à Autoforce, {{2}}." }
  ]
}]
```

---

## Pipedrive Events

### GET /api/lead-hub/id/:id/pipedrive-events

Histórico de eventos do deal Pipedrive vinculado ao lead.

**Resposta:**
```json
{
  "events": [{
    "id": "cuid",
    "dealId": "12345",
    "leadEmail": "lead@empresa.com",
    "eventType": "stage_changed",
    "fromStageId": 6,
    "fromStageName": "MQL",
    "toStageId": 8,
    "toStageName": "SQL",
    "fromValue": null,
    "toValue": null,
    "dealTitle": "Empresa ABC",
    "dealStatus": "open",
    "occurredAt": "2026-06-01T09:30:00Z",
    "source": "webhook"
  }],
  "dealUrl": "https://autoforce.pipedrive.com/deal/12345"
}
```

**Tipos de evento:**
| `eventType` | Descrição |
|---|---|
| `created` | Negócio criado |
| `stage_changed` | Mudou de estágio |
| `value_changed` | Valor alterado |
| `won` | Ganho |
| `lost` | Perdido |
| `reopened` | Reaberto |

**Fonte dos eventos (`source`):**
| Valor | Descrição |
|---|---|
| `webhook` | Evento em tempo real via webhook Pipedrive |
| `sync` | Detectado pelo sync agendado |
| `backfill` | Histórico carregado na primeira vinculação |

---

## Tipos TypeScript — Novos

```typescript
type AutomationExecutionStatus = 'running' | 'waiting' | 'completed' | 'failed';

interface AutomationExecutionLogEntry {
  nodeId: string;
  nodeType: string;
  status: 'ok' | 'error' | 'skipped';
  message?: string;
  ts: string; // ISO
}

interface AutomationExecution {
  id: string;
  journeyId: string;
  leadEmail: string;
  leadName: string | null;
  leadId: string | null;
  status: AutomationExecutionStatus;
  currentNodeId: string | null;
  resumeAt: string | null;
  log: AutomationExecutionLogEntry[];
  error: string | null;
  startedAt: string;
  completedAt: string | null;
}

interface WhatsAppPhoneNumber {
  id: string;
  display_phone_number: string;
  verified_name: string;
  quality_rating: 'GREEN' | 'YELLOW' | 'RED' | 'UNKNOWN';
}

interface PipedriveDealEvent {
  id: string;
  dealId: string;
  leadEmail: string;
  eventType: 'created' | 'stage_changed' | 'value_changed' | 'won' | 'lost' | 'reopened';
  fromStageId: number | null;
  fromStageName: string | null;
  toStageId: number | null;
  toStageName: string | null;
  fromValue: number | null;
  toValue: number | null;
  dealTitle: string | null;
  dealStatus: string;
  occurredAt: string;
  source: 'webhook' | 'sync' | 'backfill';
}
```

---

*API Reference — AutoForce Marketing Hub v2.1 — 2026-06-04*
