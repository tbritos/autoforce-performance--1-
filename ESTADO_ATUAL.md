# AutoForce Marketing Hub — Estado Atual do Projeto

> **Leia este arquivo no início de cada sessão de trabalho.**
> Última atualização: 2026-05-23
> Arquivos de referência completos: `PLANEJAMENTO_REFORMULACAO.md`, `DATABASE_DESIGN.md`, `backend/prisma/schema.v2.prisma`

---

## 1. O que é esse projeto

Reformulação do sistema de marketing interno da AutoForce. O sistema atual é um dashboard de métricas. O novo sistema — **AutoForce Marketing Hub** — é o centro nervoso de todo o marketing: leads, campanhas, métricas, UTMs, integrações, metas.

**Regra inviolável:** esta é uma ATUALIZAÇÃO, não uma reescrita. Nenhum dado existente pode ser perdido. Toda migration é aditiva (adiciona colunas/tabelas, nunca remove ou altera tipos em uso).

---

## 2. Stack técnica

| Camada | Tecnologia |
|---|---|
| Backend | Node.js + Express + TypeScript |
| ORM | Prisma (PostgreSQL) |
| Frontend | React 19 + TypeScript + Vite |
| Banco | PostgreSQL |
| Diretório do projeto | `autoforce-performance--1-/` |

---

## 3. Estrutura de diretórios relevante

```
autoforce-performance--1-/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma          ← Schema atual (atualizado na Fase 1)
│   │   ├── schema.v2.prisma       ← Schema de referência completo (não aplicar direto)
│   │   ├── migrations/
│   │   │   └── 20260523100000_lead_foundation/
│   │   │       └── migration.sql  ← Migration da Fase 1 (criada, não aplicada ainda)
│   │   ├── migrate-webhook-leads.ts ← Script one-time de migração de dados
│   │   └── seed.ts
│   └── src/
│       ├── services/
│       │   ├── lead-hub.service.ts          ← NOVO — serviço central de leads
│       │   ├── platform-connection.service.ts ← NOVO — conexões OAuth com criptografia
│       │   ├── webhook-leads.service.ts     ← ATUALIZADO — dual-write para novo sistema
│       │   └── [demais serviços existentes]
│       ├── controllers/
│       │   ├── lead-hub.controller.ts       ← NOVO
│       │   └── [demais controllers existentes]
│       ├── routes/
│       │   ├── lead-hub.routes.ts           ← NOVO — /api/lead-hub
│       │   └── [demais routes existentes]
│       └── server.ts                        ← ATUALIZADO — registra /api/lead-hub
├── ESTADO_ATUAL.md                          ← Este arquivo
├── PLANEJAMENTO_REFORMULACAO.md             ← Planejamento completo (7 fases)
├── DATABASE_DESIGN.md                       ← Design detalhado de todos os modelos
└── SISTEMA_DOCUMENTACAO.md                  ← Documentação do sistema original

design_bundle/sistema-marketing/project/    ← Protótipo visual (Claude Design)
├── styles.css                              ← Design system completo (tokens, componentes)
├── components/ (icons, charts, primitives, shell)
└── screens/ (dashboard, tracking, campaigns, funnel, capivara, wins, extras)
```

---

## 4. Estado das fases de desenvolvimento

### ✅ Fase 1 — Fundação do Banco de Leads (IMPLEMENTADA, aguarda deploy)

**O que foi feito:**

**Migration SQL** criada em `prisma/migrations/20260523100000_lead_foundation/migration.sql`:
- Cria 3 enums: `LeadStatus`, `Platform`, `ConnectionStatus`
- Cria 7 tabelas novas: `Lead`, `LeadConversion`, `LeadStatusHistory`, `PlatformConnection`, `CampaignMetrics`, `UTMLink`, `WebhookLog`
- Adiciona colunas opcionais (nullable/com default) em todas as tabelas existentes
- Adiciona FK constraints e indexes completos

**Schema.prisma** atualizado para refletir o estado pós-migration.

**Serviços novos:**
- `lead-hub.service.ts` — upsert por email, fill-blank, first-touch attribution, mudança de status com audit trail, funil counts, perfil 360°
- `platform-connection.service.ts` — CRUD de conexões com tokens AES-256-GCM criptografados

**API nova:** `GET/PATCH/DELETE /api/lead-hub` (lista, perfil, status, funil, soft delete)

**Webhook atualizado:** dual-write — continua escrevendo em `RdLead` (legado) E no novo `Lead + WebhookLog`. Erros na parte nova são não-fatais.

**Script de migração:** `prisma/migrate-webhook-leads.ts` — migra todos os `WebhookLead` para `Lead + LeadConversion`, em batches de 100, idempotente.

**Para aplicar no banco:**
```bash
npx prisma migrate deploy         # aplica a migration
npx prisma generate               # atualiza o Prisma Client
npx ts-node prisma/migrate-webhook-leads.ts  # migra dados do WebhookLead
```

---

### ⏳ Fase 2 — Integrações de Plataformas via UI (próxima)

**O que envolve:**
- Fluxos OAuth para Meta Ads, Google (GA4 + Ads + Calendar), RD Station
- Migrar tokens do `.env` para a tabela `PlatformConnection`
- Reformular `rdstation.service.ts`, `metaAds.service.ts`, `googleAnalytics.service.ts` para ler token de `PlatformConnection` em vez do `.env`
- Sync de leads do Meta Lead Ads → `Lead`
- Frontend: painel de Conexões com cards por plataforma

**Tabela `PlatformConnection` já existe** (criada na Fase 1). O `platform-connection.service.ts` já está pronto com criptografia.

---

### ⏳ Fase 3 — Banco de Leads (Frontend)

Interface completa de gestão de leads:
- Lista paginada com filtros (status, origem, data, busca)
- Perfil 360° do lead com linha do tempo de conversões (tela Capivara)
- Funil visual por status
- Exportação CSV
- Alterar status, tags, anotações

**Base visual:** tela `capivara.jsx` do protótipo em `design_bundle/`

---

### ⏳ Fase 4 — UTM Tracker

Gerador de links UTM para a social media:
- Dropdowns padronizados (sem digitação livre) para source/medium
- Biblioteca de links criados com filtros e botão copiar
- Templates reutilizáveis
- Vinculação com campanhas cadastradas

**Tabela `UTMLink` já existe** (criada na Fase 1).
**Base visual:** tela `tracking.jsx` do protótipo em `design_bundle/`

---

### ⏳ Fase 5 — Redesign do Frontend

Nova interface em todas as telas seguindo o design system do protótipo.
- Remover: BlogView, SiteView, WeeklyView
- Adicionar: Banco de Leads, Conexões
- Redesign completo de todas as telas existentes

---

### ⏳ Fase 6 — Google Ads

Integração completa com Google Ads API: campanhas, métricas, leads de formulários.

---

### ⏳ Fase 7 — Funil Unificado e Analytics Avançado

Funil ponta a ponta, atribuição first-touch, ROI por campanha, relatórios exportáveis.

---

## 5. Modelos do banco de dados

### Tabelas existentes (preservadas, com colunas adicionadas)

| Tabela | Status | Observação |
|---|---|---|
| `User` | ✅ Preservada | +`isActive`, +`lastLoginAt` |
| `DailyLead` | ✅ Preservada | +`notes` |
| `RevenueEntry` | ✅ Preservada | +`leadEmail?`, +`originType`, +`closedBy?` |
| `OKR` | ✅ Preservada | +`year`, +`status` |
| `TeamMember` | ✅ Preservada | +`email?` (único) |
| `LandingPage` | ✅ Preservada | +`sessions`, +`avgSessionDuration`, +`lastSyncAt` |
| `CampaignEvent` | ✅ Preservada | +`description?`, +`type`, +`campaignId?`, +`externalId?` |
| `Campaign` | ✅ Preservada | +`objective?`, +`dailyBudget?`, +`externalId?`, +`platformConnectionId?`, +`deletedAt?` |
| `AssetItem` | ✅ Preservada | +`campaignId?`, +`deletedAt?` |
| `AssetVersion` | ✅ Preservada | +`notes?` |
| `EmailCampaign` | ✅ Preservada | +`platformConnectionId?`, +`unsubscribes` |
| `WorkflowEmailStat` | ✅ Preservada | Sem alteração |
| `SyncLog` | ✅ Preservada | +`platformConnectionId?`, +`recordsProcessed` |
| `WebhookLead` | ⚠️ Deprecated | Manter por 30 dias pós-validação; dados migrados para `Lead` |

### Tabelas novas (criadas na Fase 1)

| Tabela | Descrição |
|---|---|
| `Lead` | Entidade central — email como chave única |
| `LeadConversion` | Registro imutável de cada touchpoint |
| `LeadStatusHistory` | Auditoria de mudanças de status no funil |
| `PlatformConnection` | Credenciais OAuth por plataforma (criptografadas) |
| `CampaignMetrics` | Snapshots diários de métricas por campanha |
| `UTMLink` | Links UTM gerados pelo Tracker |
| `WebhookLog` | Log bruto de todos os webhooks recebidos |

---

## 6. Regras técnicas fundamentais (nunca violar)

### Lead
- **Email sempre normalizado** antes de qualquer operação: `email.toLowerCase().trim()`
- **Upsert, nunca INSERT direto** — use sempre `prisma.lead.upsert` ou o `LeadHubService.upsertLead()`
- **Fill-blank na atualização** — só preenche campos vazios, nunca sobrescreve dados existentes
- **First-touch imutável** — `firstSource`, `firstMedium`, `firstCampaign`, `firstLandingPage` são preenchidos na primeira conversão e nunca alterados
- **Soft delete** — `deletedAt` em vez de DELETE. Todas as queries filtram `where: { deletedAt: null }`

### LeadConversion
- **Registro imutável** — nunca editar uma conversão, apenas criar novas
- **Deduplicação** via `@@unique([externalId, source])` — checar antes de inserir

### LeadStatusHistory
- **Toda mudança de status gera um registro aqui** — sempre em transação com o update do Lead
- Usar `LeadHubService.updateLeadStatus()` que faz isso automaticamente

### PlatformConnection
- **Tokens NUNCA em texto puro** no banco — sempre criptografados pelo `PlatformConnectionService`
- Tokens nunca retornados em respostas de API — apenas metadados (status, accountName, lastSyncAt)

### Migrations
- **Sempre aditivas** — adicionar colunas nullable/com default, nunca alterar tipos ou remover colunas com dados
- **Backup antes de aplicar em produção:** `pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql`
- **Validar contagens após migração** de dados

---

## 7. APIs disponíveis (endpoints implementados)

### Existentes (do sistema original)
```
GET    /api/dashboard/*           Dashboard e KPIs
GET    /api/leads/*               Leads diários (DailyLead) + conversões RD Station
GET    /api/revenue/*             RevenueEntry
GET    /api/okrs/*                OKRs
GET    /api/team/*                TeamMember
GET    /api/analytics/*           Analytics GA4
GET    /api/calendar/*            CampaignEvent
GET    /api/campaigns/*           Campaign
GET    /api/assets/*              AssetItem + AssetVersion
GET    /api/emails/*              EmailCampaign + WorkflowEmailStat
POST   /api/webhooks/*            Ingesta de leads via webhook
GET    /api/auth/*                Autenticação
```

### Novos (Fase 1)
```
GET    /api/lead-hub              Lista paginada de leads (com filtros)
GET    /api/lead-hub/funnel       Contagem de leads por status
GET    /api/lead-hub/:email       Perfil 360° do lead
PATCH  /api/lead-hub/:email/status  Alterar status no funil
DELETE /api/lead-hub/:email       Soft delete do lead
```

---

## 8. Design system do frontend (referência visual)

Baseado no protótipo em `design_bundle/sistema-marketing/project/`.

### Cores principais
```
AutoForce Blue (primária): #3754E2
Sidebar background:        #0B1230 (dark navy com gradient)
Background app:            #FAFBFC (light) / #0A0F22 (dark)
Background surface:        #FFFFFF (light) / #0F1631 (dark)
```

### Tipografia
```
Font principal: Poppins (300, 400, 500, 600, 700)
Font mono:      JetBrains Mono — para UTMs, dados técnicos
```

### Dimensões
```
Sidebar expandida:  248px
Sidebar recolhida:  64px
Topbar:             56px
Border radius card: 8px
Border radius btn:  6px
```

### Navegação (estrutura final)
```
VISÃO GERAL
  Dashboard

LEADS
  Banco de Leads          ← NOVA
  Funil de Leads

MARKETING
  Campanhas
  Tracking (UTM Builder)
  Conteúdo & Criativos

INTELIGÊNCIA COMERCIAL
  Capivara (perfil 360°)

OPERAÇÃO
  Ganhos
  Relatórios
  Conexões               ← NOVA
  Configurações
```

### Telas do protótipo disponíveis para referência
| Arquivo | Tela |
|---|---|
| `screens/dashboard.jsx` | Dashboard com KPIs, gráfico, funil, insights |
| `screens/tracking.jsx` | Gerador de UTM com preview live e biblioteca |
| `screens/campaigns.jsx` | Lista + detalhe de campanhas |
| `screens/funnel.jsx` | Funil detalhado com cortes por canal |
| `screens/capivara.jsx` | Busca 360° + perfil completo do lead |
| `screens/wins.jsx` | Tabela de Ganhos |
| `screens/extras.jsx` | Relatórios, Configurações, Login, Criativos |

---

## 9. Variáveis de ambiente necessárias

```env
# Banco
DATABASE_URL=postgresql://...

# Auth
JWT_SECRET=...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...

# Criptografia de tokens OAuth (32 bytes = 64 hex chars)
ENCRYPTION_KEY=...   ← NOVO na Fase 1 (necessário para PlatformConnection)

# RD Station (usados até Fase 2 — depois migram para PlatformConnection)
RD_STATION_CLIENT_ID=...
RD_STATION_CLIENT_SECRET=...
RD_STATION_REFRESH_TOKEN=...

# Meta Ads (usados até Fase 2)
META_ACCESS_TOKEN=...
META_AD_ACCOUNT_ID=...

# Google Analytics (usados até Fase 2)
GOOGLE_ANALYTICS_PROPERTY_ID=...
GOOGLE_SERVICE_ACCOUNT_KEY=...

# Servidor
PORT=5000
CORS_ORIGIN=http://localhost:5173
NODE_ENV=development
```

---

## 10. Serviços principais — responsabilidades

| Serviço | Arquivo | Responsabilidade |
|---|---|---|
| **LeadHubService** | `lead-hub.service.ts` | Upsert lead, registrar conversão, processar webhook, listar, perfil, mudar status |
| **PlatformConnectionService** | `platform-connection.service.ts` | CRUD de conexões, criptografia AES-256, status, tokens |
| **WebhookLeadsService** | `webhook-leads.service.ts` | Ingesta webhook — dual-write: legado + novo sistema |
| RDStationService | `rdstation.service.ts` | Sync com RD Station (emails, workflows) |
| MetaAdsService | `metaAds.service.ts` | Sync com Meta Ads (campanhas, métricas) |
| GoogleAnalyticsService | `googleAnalytics.service.ts` | Sync com GA4 (LPs, sessões) |
| CampaignsService | `campaigns.service.ts` | CRUD de campanhas |
| AssetsService | `assets.service.ts` | CRUD de assets e versões |
| EmailService | `email.service.ts` | Sync de e-mail marketing do RD Station |
| LeadsService | `leads.service.ts` | DailyLead + conversões RD (sistema legado) |
| RevenueService | `revenue.service.ts` | CRUD de RevenueEntry |

---

## 11. Padrões de código para seguir

### Upsert de lead (SEMPRE assim)
```typescript
import { LeadHubService } from './services/lead-hub.service';

// Nunca: prisma.lead.create({ ... })
// Sempre:
await LeadHubService.upsertLead({
  email: 'lead@empresa.com',  // normalizado automaticamente internamente
  name: 'Nome do Lead',
  phone: '11999998888',
  company: 'Empresa',
});
```

### Processar webhook com lead (SEMPRE assim)
```typescript
await LeadHubService.processWebhook({
  source: 'rdstation',
  payload: rawWebhookPayload,
  leadData: { email, name, phone, company },
  conversionData: {
    source: 'rdstation',
    externalId: 'ext-id-da-plataforma',
    utmSource: 'instagram',
    utmMedium: 'organico',
    rawData: rawWebhookPayload,
  },
});
```

### Mudar status do lead (SEMPRE assim — gera audit trail automaticamente)
```typescript
await LeadHubService.updateLeadStatus(
  'lead@empresa.com',
  'MQL',          // LeadStatus enum
  'usuario@autoforce.com',  // quem mudou
  'Qualificado após demo'   // motivo (opcional)
);
```

### Conexão de plataforma (tokens sempre criptografados)
```typescript
import { PlatformConnectionService } from './services/platform-connection.service';

// Salvar conexão (tokens são criptografados automaticamente)
await PlatformConnectionService.saveConnection({
  platform: 'META_ADS',
  accountId: 'act_123456789',
  accountName: 'AutoForce',
  accessToken: 'token-bruto-aqui',  // criptografado antes de salvar
});

// Usar token internamente (descriptografado, nunca expor na API)
const tokens = await PlatformConnectionService.getTokens('META_ADS');
// tokens.accessToken está em texto puro aqui, só para uso interno
```

---

## 12. Decisões técnicas já tomadas

| Decisão | Escolha |
|---|---|
| Email como chave do Lead | `@unique` — não ID numérico |
| Deduplicação de lead | Upsert por email + fill-blank |
| Imutabilidade de conversões | Nunca editar `LeadConversion`, só criar |
| Soft delete | `deletedAt DateTime?` nas entidades principais |
| Tokens OAuth | AES-256-GCM criptografados no banco |
| Métricas de campanha | Tabela `CampaignMetrics` separada com snapshot diário |
| Atribuição | First-touch (campos `firstSource*` no Lead, imutáveis) |
| Deduplicação de conversão | `@@unique([externalId, source])` |
| IDs das novas tabelas | UUID (`uuid()`) |
| WebhookLead | Mantido como deprecated por 30 dias pós-validação |

### Decisões ainda abertas (definir antes das próximas fases)
| # | Decisão | Impacto |
|---|---|---|
| 1 | ~~Biblioteca de UI do frontend~~ — **shadcn/ui + Recharts** ✅ | Fase 3+ |
| 2 | ~~Dark mode como padrão ou light?~~ — **Light como padrão, com toggle para dark** ✅ | Fase 5 |
| 3 | Encurtador de URL (UTM Tracker) | Fase 4 |
| 4 | ~~Deploy~~ — **Railway (backend) + Vercel (frontend), igual hoje. Desenvolver local, subir só quando 100% pronto** ✅ | Fase 2+ |
| 5 | ~~Google Ads~~ — **Prioridade alta, incluído na Fase 2 junto com Meta e GA4** ✅ | Fase 2 |

---

## 13. Checklist de validação pós-deploy da Fase 1

Após rodar as migrations e o script de migração de dados:

- [ ] `SELECT COUNT(*) FROM "Lead"` — deve ter ao menos o mesmo número de emails únicos do `RdLead`
- [ ] `SELECT COUNT(*) FROM "LeadConversion" WHERE source = 'rdstation'` — deve igualar registros do `RdLead` com email
- [ ] Webhook de teste chega e cria registro em `Lead`, `LeadConversion` e `WebhookLog`
- [ ] Rota `GET /api/lead-hub` retorna lista de leads
- [ ] Rota `GET /api/lead-hub/:email` retorna perfil completo
- [ ] Tabela `WebhookLead` (`RdLead`) continua intacta com todos os dados originais
- [ ] Nenhum serviço/rota existente quebrou

---

*Atualizado em: 2026-05-23*
