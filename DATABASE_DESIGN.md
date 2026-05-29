# Design do Banco de Dados — AutoForce Marketing Hub v2

> Criado em: 2026-05-23
> **Status:** Referência para implementação — não aplicado ao banco ainda.
> O schema real fica em `backend/prisma/schema.prisma`. A nova versão fica em `backend/prisma/schema.v2.prisma`.

---

## Princípios de Design

1. **Email é a chave natural do Lead** — normalizado sempre (lowercase + trim) antes de qualquer operação
2. **Imutabilidade dos registros de evento** — `LeadConversion`, `CampaignMetrics`, `LeadStatusHistory` nunca são editados, apenas criados
3. **Soft delete nas entidades principais** — `deletedAt` em Lead, Campaign, UTMLink, AssetItem. Nunca deletar permanentemente
4. **Histórico completo** — toda mudança de status do lead é registrada em `LeadStatusHistory`
5. **Deduplicação explícita** — constraints `@@unique([externalId, source])` em LeadConversion, EmailCampaign, WorkflowEmailStat
6. **Métricas em tabela separada** — `CampaignMetrics` guarda snapshots diários; nunca colocar métricas que mudam diariamente na tabela `Campaign`
7. **Tokens de plataforma nunca em texto puro** — `PlatformConnection.accessToken` e `refreshToken` são criptografados pelo service antes de persistir
8. **Preservação total dos dados existentes** — todos os modelos atuais são mantidos; mudanças são adições (colunas nullable) ou novas tabelas

---

## Mapa de Grupos de Domínio

```
┌─────────────────────────────────────────────────────────────────┐
│                    AUTOFORCE MARKETING HUB                      │
│                                                                 │
│  ┌──────────────┐    ┌──────────────────────────────────────┐  │
│  │    Auth      │    │              LEADS                   │  │
│  │              │    │                                      │  │
│  │  User        │    │  Lead ◄──── LeadConversion           │  │
│  └──────────────┘    │     └────── LeadStatusHistory        │  │
│                       └──────────────────────────────────────┘  │
│                                        ▲                        │
│  ┌──────────────────┐                  │                        │
│  │   PLATAFORMAS    │                  │                        │
│  │                  │   ┌──────────────┴───────────────────┐   │
│  │ PlatformConn ◄───┼───│           CAMPANHAS              │   │
│  └──────────────────┘   │                                  │   │
│           │              │  Campaign ◄── CampaignMetrics   │   │
│           ▼              └──────────────────────────────────┘   │
│  ┌────────────────────────────────────────────────────────┐    │
│  │  EmailCampaign  │  WorkflowEmailStat  │  SyncLog       │    │
│  └────────────────────────────────────────────────────────┘    │
│                                                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────┐    │
│  │ UTMLink  │  │  OKR     │  │ Assets   │  │ Revenue    │    │
│  └──────────┘  └──────────┘  └──────────┘  └────────────┘    │
│                                                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────┐    │
│  │DailyLead │  │Calendar  │  │  GA4/LP  │  │  Team      │    │
│  └──────────┘  └──────────┘  └──────────┘  └────────────┘    │
│                                                                 │
│  ┌──────────────────────────────────────┐                      │
│  │  SISTEMA: WebhookLog │ WebhookLead*  │  * deprecated        │
│  └──────────────────────────────────────┘                      │
└─────────────────────────────────────────────────────────────────┘
```

---

## Modelo Completo — Todos os campos

### GRUPO 1 — Autenticação & Usuários

---

#### `User`

| Campo | Tipo | Nullable | Default | Notas |
|---|---|---|---|---|
| id | String (UUID) | ✗ | uuid() | PK |
| email | String | ✗ | — | UNIQUE |
| name | String | ✗ | — | — |
| avatar | String | ✓ | — | URL da foto |
| role | UserRole | ✗ | MEMBER | Enum |
| isActive | Boolean | ✗ | true | — |
| lastLoginAt | DateTime | ✓ | — | Atualizado no login |
| createdAt | DateTime | ✗ | now() | — |
| updatedAt | DateTime | ✗ | @updatedAt | — |

**Relações:** `UTMLink[]` (criados), `RevenueEntry[]` (fechados), `LeadStatusHistory[]`

**Enum `UserRole`:** `ADMIN` | `MEMBER` | `VIEWER`

---

### GRUPO 2 — Leads (entidade central)

---

#### `Lead`

| Campo | Tipo | Nullable | Default | Notas |
|---|---|---|---|---|
| id | String (UUID) | ✗ | uuid() | PK |
| **email** | **String** | **✗** | **—** | **UNIQUE — chave natural** |
| name | String | ✓ | — | Consolidado das conversões |
| phone | String | ✓ | — | — |
| company | String | ✓ | — | — |
| jobTitle | String | ✓ | — | — |
| city | String | ✓ | — | — |
| state | String | ✓ | — | — |
| status | LeadStatus | ✗ | LEAD | Enum — funil |
| firstSource | String | ✓ | — | utm_source da 1ª conversão |
| firstMedium | String | ✓ | — | utm_medium da 1ª conversão |
| firstCampaign | String | ✓ | — | utm_campaign da 1ª conversão |
| firstLandingPage | String | ✓ | — | URL da LP da 1ª conversão |
| score | Int | ✗ | 0 | 0–100, calculado |
| isHot | Boolean | ✗ | false | Lead quente sinalizado |
| tags | String[] | ✗ | [] | — |
| notes | String (Text) | ✓ | — | Anotações do time |
| assignedTo | String | ✓ | — | Email do SDR responsável |
| firstSeenAt | DateTime | ✗ | now() | Timestamp da 1ª conversão |
| lastSeenAt | DateTime | ✗ | now() | Atualizado a cada conversão |
| qualifiedAt | DateTime | ✓ | — | Quando virou MQL |
| convertedAt | DateTime | ✓ | — | Quando virou CLIENT |
| createdAt | DateTime | ✗ | now() | — |
| updatedAt | DateTime | ✗ | @updatedAt | — |
| **deletedAt** | **DateTime** | **✓** | **—** | **Soft delete** |

**Relações:** `LeadConversion[]`, `LeadStatusHistory[]`, `RevenueEntry[]`

**Indexes:** `status`, `firstSource`, `isHot`, `score`, `assignedTo`, `lastSeenAt`, `createdAt`, `deletedAt`

**Enum `LeadStatus`:**
```
LEAD         → Captado, sem qualificação
MQL          → Marketing Qualified Lead
SQL          → Sales Qualified Lead
OPPORTUNITY  → Em negociação ativa
CLIENT       → Ganho / cliente
LOST         → Perdido
DISQUALIFIED → Desqualificado (duplicata, inválido, etc.)
```

---

#### `LeadConversion`
> Registro imutável de cada vez que um lead aparece em uma fonte. Nunca editar — apenas criar.

| Campo | Tipo | Nullable | Default | Notas |
|---|---|---|---|---|
| id | String (UUID) | ✗ | uuid() | PK |
| leadEmail | String | ✗ | — | FK → Lead.email |
| source | String | ✗ | — | `rdstation` \| `meta_lead_ads` \| `google` \| `webhook` \| `manual` |
| externalId | String | ✓ | — | ID externo na fonte |
| campaignId | String | ✓ | — | FK → Campaign.id |
| campaignName | String | ✓ | — | Denormalizado — preserva nome se campanha for deletada |
| formName | String | ✓ | — | Nome do formulário preenchido |
| landingPage | String | ✓ | — | URL da página de conversão |
| utmSource | String | ✓ | — | utm_source no momento |
| utmMedium | String | ✓ | — | utm_medium no momento |
| utmCampaign | String | ✓ | — | utm_campaign no momento |
| utmContent | String | ✓ | — | utm_content no momento |
| utmTerm | String | ✓ | — | utm_term no momento |
| rawData | Json | ✗ | — | Todos os campos do formulário |
| convertedAt | DateTime | ✗ | — | Timestamp exato da conversão |
| createdAt | DateTime | ✗ | now() | — |

**Constraint único:** `@@unique([externalId, source])` — deduplicação por fonte
**Indexes:** `leadEmail`, `source`, `campaignId`, `convertedAt`, `utmCampaign`, `utmSource`

---

#### `LeadStatusHistory`
> Auditoria completa de cada mudança de status no funil.

| Campo | Tipo | Nullable | Default | Notas |
|---|---|---|---|---|
| id | String (UUID) | ✗ | uuid() | PK |
| leadEmail | String | ✗ | — | FK → Lead.email |
| fromStatus | LeadStatus | ✓ | — | Status anterior (null = criação) |
| toStatus | LeadStatus | ✗ | — | Status novo |
| changedBy | String | ✓ | — | Email do usuário (null = sistema) |
| reason | String | ✓ | — | Motivo da mudança |
| changedAt | DateTime | ✗ | now() | — |

**Indexes:** `leadEmail`, `changedAt`

---

### GRUPO 3 — Conexões de Plataformas

---

#### `PlatformConnection`

| Campo | Tipo | Nullable | Default | Notas |
|---|---|---|---|---|
| id | String (UUID) | ✗ | uuid() | PK |
| platform | Platform | ✗ | — | UNIQUE — uma por plataforma |
| status | ConnectionStatus | ✗ | DISCONNECTED | Enum |
| accountId | String | ✓ | — | ID da conta na plataforma |
| accountName | String | ✓ | — | Nome da conta |
| extraIds | String[] | ✗ | [] | IDs adicionais (ex: múltiplos ad accounts) |
| accessToken | String (Text) | ✓ | — | **Criptografado AES-256** |
| refreshToken | String (Text) | ✓ | — | **Criptografado AES-256** |
| tokenExpiry | DateTime | ✓ | — | — |
| metadata | Json | ✓ | — | Configs específicas da plataforma |
| lastSyncAt | DateTime | ✓ | — | — |
| lastSyncStatus | String | ✓ | — | `success` \| `error` \| `partial` |
| lastSyncError | String (Text) | ✓ | — | Mensagem de erro da última sync |
| syncCount | Int | ✗ | 0 | Total de syncs realizadas |
| createdAt | DateTime | ✗ | now() | — |
| updatedAt | DateTime | ✗ | @updatedAt | — |

**Relações:** `Campaign[]`, `EmailCampaign[]`, `SyncLog[]`

**Enum `Platform`:** `META_ADS` | `GOOGLE_ADS` | `GOOGLE_ANALYTICS` | `RD_STATION` | `GOOGLE_CALENDAR`

**Enum `ConnectionStatus`:** `CONNECTED` | `DISCONNECTED` | `ERROR` | `EXPIRED`

**Metadata por plataforma:**
```json
// META_ADS
{ "adAccountId": "act_123456789", "pageId": "...", "pixelId": "..." }

// GOOGLE_ADS
{ "customerId": "123-456-7890", "loginCustomerId": "..." }

// GOOGLE_ANALYTICS
{ "propertyId": "123456789" }

// RD_STATION
{ "workspaceId": "..." }

// GOOGLE_CALENDAR
{ "calendarId": "marketing@autoforce.com" }
```

---

### GRUPO 4 — Campanhas

---

#### `Campaign`

| Campo | Tipo | Nullable | Default | Notas |
|---|---|---|---|---|
| id | String (UUID) | ✗ | uuid() | PK |
| name | String | ✗ | — | — |
| platform | CampaignPlatform | ✗ | — | Enum |
| status | CampaignStatus | ✗ | DRAFT | Enum |
| objective | String | ✓ | — | `awareness` \| `traffic` \| `leads` \| `conversions` \| `sales` |
| budget | Float | ✓ | — | Orçamento total |
| dailyBudget | Float | ✓ | — | Orçamento diário |
| startDate | DateTime (Date) | ✓ | — | — |
| endDate | DateTime (Date) | ✓ | — | — |
| externalId | String | ✓ | — | ID na plataforma externa |
| platformConnectionId | String | ✓ | — | FK → PlatformConnection.id |
| kpi | String | ✓ | — | KPI principal da campanha |
| notes | String (Text) | ✓ | — | — |
| createdAt | DateTime | ✗ | now() | — |
| updatedAt | DateTime | ✗ | @updatedAt | — |
| **deletedAt** | DateTime | ✓ | — | **Soft delete** |

**Relações:** `CampaignMetrics[]`, `LeadConversion[]`, `UTMLink[]`, `AssetItem[]`

**Enums:**
```
CampaignPlatform: META | GOOGLE_ADS | TIKTOK | LINKEDIN | EMAIL | ORGANIC | OTHER
CampaignStatus:   DRAFT | ACTIVE | PAUSED | REVIEW | ENDED | ARCHIVED
```

---

#### `CampaignMetrics`
> Snapshot diário imutável das métricas de uma campanha. Um registro por campanha por dia.

| Campo | Tipo | Notas |
|---|---|---|
| id | UUID | PK |
| campaignId | String | FK → Campaign.id |
| date | DateTime (Date) | Data do snapshot |
| impressions | Int | — |
| reach | Int | — |
| clicks | Int | — |
| ctr | Float | Click-through rate (%) |
| spend | Float | Gasto no dia |
| cpc | Float | Custo por clique |
| cpm | Float | Custo por 1.000 impressões |
| cpl | Float | Custo por lead |
| leads | Int | Leads gerados no dia |
| conversions | Int | Conversões |
| conversionValue | Float | Valor das conversões |
| roas | Float | Return on ad spend |
| videoViews | Int? | — |
| videoWatchPct | Float? | % médio assistido |

**Constraint único:** `@@unique([campaignId, date])`
**Indexes:** `campaignId`, `date`

---

### GRUPO 5 — UTM Links

---

#### `UTMLink`

| Campo | Tipo | Nullable | Notas |
|---|---|---|---|
| id | UUID | ✗ | PK |
| createdBy | String | ✗ | FK → User.email |
| title | String | ✓ | Nome amigável (opcional) |
| destinationUrl | String | ✗ | URL de destino |
| utmSource | String | ✗ | Sempre obrigatório |
| utmMedium | String | ✗ | Sempre obrigatório |
| utmCampaign | String | ✗ | Sempre obrigatório |
| utmContent | String | ✓ | — |
| utmTerm | String | ✓ | — |
| fullUrl | String (Text) | ✗ | URL completa gerada |
| shortUrl | String | ✓ | ex: `https://atf.link/polo-vw-abc` |
| shortCode | String | ✓ | UNIQUE — para analytics de clique |
| campaignId | String | ✓ | FK → Campaign.id |
| clicks | Int | ✗ | 0 | Contador de cliques |
| isTemplate | Boolean | ✗ | false | — |
| templateName | String | ✓ | Nome do template |
| isFavorite | Boolean | ✗ | false | — |
| createdAt | DateTime | ✗ | now() | — |
| updatedAt | DateTime | ✗ | @updatedAt | — |
| **deletedAt** | DateTime | ✓ | — | **Soft delete** |

**Indexes:** `createdBy`, `utmCampaign`, `campaignId`, `isTemplate`, `isFavorite`, `createdAt`, `shortCode`, `deletedAt`

---

### GRUPO 6 — Receita & Ganhos

---

#### `RevenueEntry` *(modelo existente, estendido)*

Campos adicionados sem breaking change:

| Campo novo | Tipo | Notas |
|---|---|---|
| leadEmail | String? | FK opcional → Lead.email |
| originType | RevenueOrigin | Enum — substitui/complementa `origin` string |
| closedBy | String? | Email do usuário que fechou |

**Enum `RevenueOrigin`:** `INBOUND` | `OUTBOUND` | `UPSELL` | `INDICATION` | `EVENT` | `OTHER`

**Todos os campos existentes são preservados sem alteração.**

---

### GRUPO 7 — OKRs

---

#### `OKR` *(modelo existente, ajuste mínimo)*

Campo adicionado:

| Campo novo | Tipo | Notas |
|---|---|---|
| year | Int | Extraído do `quarter` para facilitar filtros |
| status | OKRStatus | `ON_TRACK` \| `AT_RISK` \| `OFF_TRACK` \| `COMPLETED` |

**Todos os campos existentes são preservados.**

**Estrutura do JSON `keyResults`:**
```json
[
  {
    "id": "kr-1",
    "description": "Atingir 5.000 leads qualificados",
    "current": 3241,
    "target": 5000,
    "unit": "leads",
    "weight": 0.4
  }
]
```

---

### GRUPO 8 — Assets / Criativos

---

#### `AssetItem` *(modelo existente, estendido)*

| Campo novo | Tipo | Notas |
|---|---|---|
| campaignId | String? | FK opcional → Campaign.id |
| deletedAt | DateTime? | Soft delete |

**Enum `AssetCategory`:** `LP` | `CREATIVE` | `COPY` | `UTM` | `VIDEO` | `EMAIL_TEMPLATE` | `OTHER`

---

### GRUPO 9 — E-mail Marketing

---

#### `EmailCampaign` *(modelo existente, estendido)*

| Campo novo | Tipo | Notas |
|---|---|---|
| platformConnectionId | String? | FK → PlatformConnection.id |
| unsubscribes | Int | Novas métricas adicionadas |

---

#### `WorkflowEmailStat` *(modelo existente, sem alteração)*

---

### GRUPO 10 — Landing Pages (GA4)

---

#### `LandingPage` *(modelo existente, ajustes)*

| Campo alterado | Tipo anterior | Tipo novo | Notas |
|---|---|---|---|
| avgEngagementTime | String | Float | Era string "2m 14s", agora segundos numéricos |
| sessions | — | Int | Campo novo adicionado |
| lastSyncAt | — | DateTime? | Rastreamento de sync por LP |

---

### GRUPO 11 — Calendário

---

#### `CampaignEvent` *(modelo existente, estendido)*

| Campo novo | Tipo | Notas |
|---|---|---|
| description | String? | Descrição mais detalhada |
| type | EventType | Enum de tipo de evento |
| campaignId | String? | FK opcional → Campaign.id |
| externalId | String? | Google Calendar event ID |

**Enum `EventType`:** `CAMPAIGN` | `CONTENT` | `EVENT` | `MEETING` | `DEADLINE` | `OTHER`

---

### GRUPO 12–13 — DailyLead, TeamMember

Modelos preservados com ajustes mínimos:
- `DailyLead`: adiciona campo `notes String?` e index em `date`
- `TeamMember`: adiciona `email String? @unique` e `lastActive DateTime?` (era String)

---

### GRUPO 14 — Sistema (Logs)

---

#### `SyncLog` *(modelo existente, estendido)*

| Campo novo | Tipo | Notas |
|---|---|---|
| platformConnectionId | String? | FK → PlatformConnection |
| recordsProcessed | Int | Contagem de registros processados |

---

#### `WebhookLog` *(NOVO)*
> Log de todos os webhooks recebidos. Essencial para auditoria, debugging e deduplicação.

| Campo | Tipo | Notas |
|---|---|---|
| id | UUID | PK |
| source | String | `rdstation` \| `meta` \| `google` \| `manual` |
| payload | Json | Payload bruto recebido |
| status | String | `processed` \| `error` \| `duplicate` \| `ignored` |
| leadEmail | String? | Preenchido se processou com sucesso |
| error | String? | Mensagem de erro se falhou |
| receivedAt | DateTime | now() |
| processedAt | DateTime? | Quando o processamento terminou |

**Indexes:** `source`, `status`, `receivedAt`, `leadEmail`

---

#### `WebhookLead` *(DEPRECATED — mantido para migração)*
- Tabela preservada com o mapeamento `@@map("RdLead")` original
- Dados serão migrados para `Lead` + `LeadConversion`
- Renomear para `WebhookLead_archived` após validação da migração
- Remover 30 dias após produção estável

---

## Diagrama de Relacionamentos

```
User ──────────────────┬── UTMLink (created by)
                        └── RevenueEntry (closed by)
                        └── LeadStatusHistory (changed by)

Lead ──────────────────┬── LeadConversion (1:N)
                        ├── LeadStatusHistory (1:N)
                        └── RevenueEntry (1:N, optional)

LeadConversion ────────── Campaign (N:1, optional)

PlatformConnection ────┬── Campaign (1:N)
                        ├── EmailCampaign (1:N)
                        └── SyncLog (1:N)

Campaign ──────────────┬── CampaignMetrics (1:N)
                        ├── LeadConversion (1:N)
                        ├── UTMLink (1:N)
                        ├── AssetItem (1:N)
                        └── CampaignEvent (1:N, via campaignId)

AssetItem ─────────────── AssetVersion (1:N, cascade delete)
```

---

## Índices Críticos para Performance

| Tabela | Index | Justificativa |
|---|---|---|
| Lead | `email` (UNIQUE) | Toda busca de lead começa pelo email |
| Lead | `status` | Filtro mais comum: leads por etapa do funil |
| Lead | `lastSeenAt` | Ordenação e filtro por atividade recente |
| Lead | `score` | Filtro por lead score |
| Lead | `deletedAt` | Excluir soft-deleted de todas as queries |
| LeadConversion | `leadEmail` | JOIN principal com Lead |
| LeadConversion | `convertedAt` | Filtros por período |
| LeadConversion | `utmSource`, `utmCampaign` | Relatórios de atribuição |
| LeadConversion | `(externalId, source)` UNIQUE | Deduplicação |
| Campaign | `status` | Filtro por campanhas ativas |
| Campaign | `externalId` | Lookup durante sync de plataformas |
| CampaignMetrics | `(campaignId, date)` UNIQUE | Snapshot diário único |
| CampaignMetrics | `date` | Filtros por período em todas as campanhas |
| UTMLink | `shortCode` UNIQUE | Lookup para tracking de cliques |
| UTMLink | `utmCampaign` | Filtros por campanha |
| RevenueEntry | `date` | Filtros de período |
| RevenueEntry | `leadEmail` | JOIN com Lead |
| WebhookLog | `(source, receivedAt)` | Auditoria por fonte e período |
| SyncLog | `(source, startedAt)` | Histórico de syncs |

---

## Regras de Negócio no Nível de Dados

### Deduplicação de Leads
**Regra:** `Lead.email` tem constraint `@unique`. Antes de qualquer INSERT, o service normaliza o email:
```typescript
const normalizedEmail = email.toLowerCase().trim();
```
O processamento é sempre via **upsert** — nunca INSERT direto.

### Consolidação de Dados do Lead
**Regra:** Quando o mesmo email chega com uma nova conversão, o service aplica:
```typescript
// Só atualiza campos em branco. Nunca sobrescreve dados existentes.
name:    lead.name    || incomingData.name
phone:   lead.phone   || incomingData.phone
company: lead.company || incomingData.company
// ...
// Sempre atualiza:
lastSeenAt: now()
```

### Imutabilidade das Conversões
**Regra:** `LeadConversion` registra o estado exato do formulário no momento da conversão. Nunca editar. Se um dado mudar, é uma nova conversão, não uma edição da anterior.

### Atribuição First Touch
**Regra:** `Lead.firstSource`, `Lead.firstMedium`, `Lead.firstCampaign`, `Lead.firstLandingPage` são preenchidos apenas uma vez (na primeira conversão) e nunca alterados.
```typescript
// No service de upsert:
if (!existingLead.firstSource && conversion.utmSource) {
  lead.firstSource = conversion.utmSource;
  lead.firstMedium = conversion.utmMedium;
  // ...
}
```

### Soft Delete
**Regra:** Entidades com `deletedAt` NUNCA são retornadas em queries normais:
```typescript
// Em todas as listagens:
where: { deletedAt: null }
```

### Histórico de Status do Lead
**Regra:** Toda mudança de `Lead.status` deve ser acompanhada de um `LeadStatusHistory`:
```typescript
await prisma.$transaction([
  prisma.lead.update({ where: { email }, data: { status: newStatus } }),
  prisma.leadStatusHistory.create({
    data: { leadEmail: email, fromStatus: oldStatus, toStatus: newStatus, changedBy }
  })
]);
```

### Tokens de Plataforma
**Regra:** `accessToken` e `refreshToken` em `PlatformConnection` NUNCA são armazenados em texto puro. O service de plataforma aplica AES-256 antes do save e descriptografa ao usar.

### CampaignMetrics — Upsert Diário
**Regra:** O sync de métricas de campanha usa `upsert` com `@@unique([campaignId, date])`. Nunca duplicar snapshots do mesmo dia.

---

## Estratégia de Migração do Schema Atual

### Classificação dos modelos atuais

| Modelo atual | Ação | Risco |
|---|---|---|
| `User` | Adicionar `role` enum, `isActive`, `lastLoginAt` | Baixo |
| `DailyLead` | Adicionar `notes`, index em `date` | Nenhum |
| `RevenueEntry` | Adicionar `leadEmail?`, `originType?`, `closedBy?` | Nenhum (nullable) |
| `OKR` | Adicionar `year`, `status` | Nenhum (nullable) |
| `TeamMember` | Adicionar `email?`, corrigir `lastActive` (String→DateTime) | Baixo |
| `LandingPage` | Adicionar `sessions`, `lastSyncAt`; corrigir `avgEngagementTime` (String→Float) | Médio |
| `CampaignEvent` | Adicionar `description?`, `type?`, `campaignId?`, `externalId?` | Nenhum |
| `Campaign` | Adicionar `externalId?`, `platformConnectionId?`, `objective?`, `dailyBudget?`, `deletedAt?` | Nenhum |
| `AssetItem` | Adicionar `campaignId?`, `deletedAt?`; trocar `category String` → enum | Baixo |
| `AssetVersion` | Adicionar `notes?` | Nenhum |
| `EmailCampaign` | Adicionar `platformConnectionId?`, `unsubscribes` | Nenhum |
| `WorkflowEmailStat` | Sem alteração | Nenhum |
| `SyncLog` | Adicionar `platformConnectionId?`, `recordsProcessed` | Nenhum |
| `WebhookLead` | **DEPRECATED** — migrar dados; manter tabela até validação | Alto |

### Modelos NOVOS (não existem hoje)
- `Lead`
- `LeadConversion`
- `LeadStatusHistory`
- `PlatformConnection`
- `CampaignMetrics`
- `UTMLink`
- `WebhookLog`

### Migrations por fase

**Fase 1 — Fundação dos Leads:**
```sql
-- 1. Criar novas tabelas
CREATE TABLE "Lead" (...)
CREATE TABLE "LeadConversion" (...)
CREATE TABLE "LeadStatusHistory" (...)
CREATE TABLE "PlatformConnection" (...)
CREATE TABLE "WebhookLog" (...)

-- 2. Migrar WebhookLead → Lead + LeadConversion
-- (via script TypeScript — não via migration SQL)

-- 3. Colunas novas em tabelas existentes (todas nullable — sem risco)
ALTER TABLE "RevenueEntry" ADD COLUMN "leadEmail" TEXT;
ALTER TABLE "Campaign" ADD COLUMN "externalId" TEXT;
ALTER TABLE "Campaign" ADD COLUMN "deletedAt" TIMESTAMP;
```

**Fase 2 — Integrações:**
```sql
-- PlatformConnection já criada na Fase 1
-- Adicionar FKs nas tabelas que dependem dela
ALTER TABLE "Campaign" ADD COLUMN "platformConnectionId" UUID;
ALTER TABLE "EmailCampaign" ADD COLUMN "platformConnectionId" UUID;
ALTER TABLE "SyncLog" ADD COLUMN "platformConnectionId" UUID;

-- CampaignMetrics
CREATE TABLE "CampaignMetrics" (...)
```

**Fase 3+ — UTMLink e outros:**
```sql
CREATE TABLE "UTMLink" (...)
ALTER TABLE "AssetItem" ADD COLUMN "campaignId" UUID;
ALTER TABLE "CampaignEvent" ADD COLUMN "campaignId" UUID;
```

---

## Padrões de Query Principais

### Perfil completo de um lead
```typescript
prisma.lead.findUnique({
  where: { email: normalizedEmail, deletedAt: null },
  include: {
    conversions: {
      orderBy: { convertedAt: 'desc' },
      include: { campaign: { select: { name: true, platform: true } } }
    },
    statusHistory: { orderBy: { changedAt: 'asc' } },
    revenueEntries: { orderBy: { date: 'desc' } }
  }
})
```

### Dashboard — KPIs do período
```typescript
// Total leads no período
prisma.lead.count({
  where: { firstSeenAt: { gte: startDate, lte: endDate }, deletedAt: null }
})

// Por status
prisma.lead.groupBy({
  by: ['status'],
  where: { deletedAt: null },
  _count: true
})
```

### Funil de conversão
```typescript
prisma.lead.groupBy({
  by: ['status'],
  where: { createdAt: { gte: startDate }, deletedAt: null },
  _count: { status: true }
})
```

### Atribuição por UTM source
```typescript
prisma.leadConversion.groupBy({
  by: ['utmSource'],
  where: { convertedAt: { gte: startDate } },
  _count: { leadEmail: true }
})
```

### Performance de campanhas (período)
```typescript
prisma.campaignMetrics.groupBy({
  by: ['campaignId'],
  where: { date: { gte: startDate, lte: endDate } },
  _sum: { spend: true, leads: true, clicks: true, impressions: true },
  _avg: { roas: true, cpl: true }
})
```

---

## Decisões Técnicas Tomadas

| Decisão | Escolha | Motivo |
|---|---|---|
| Email como PK do Lead | `@unique` natural, não FK numérica | Simplifica upserts e joins; email não muda |
| Soft delete com `deletedAt` | Sim — nas entidades principais | Auditoria; dados nunca perdidos permanentemente |
| Métricas em tabela separada | `CampaignMetrics` separada de `Campaign` | Métricas mudam diariamente; evita UPDATE constante na tabela principal |
| JSON para rawData | Json | Formulários têm campos variáveis por campanha |
| JSON para keyResults | Json | Estrutura de OKR é variável |
| JSON para metadata de plataforma | Json | Cada plataforma tem configs diferentes |
| Float para valores monetários | Float | Suficiente para o volume atual; Decimal seria mais preciso mas adiciona complexidade |
| UUID para IDs | uuid() | Uniformidade; mais seguro para exposição em URLs |
| Tokens criptografados | AES-256 no service | Segurança; banco comprometido não expõe tokens |
| `@@unique([externalId, source])` | Em conversões, emails, workflows | Deduplicação segura em syncs idempotentes |
| Denormalizar `campaignName` em `LeadConversion` | Sim | Preserva o nome da campanha mesmo se ela for deletada |
| `WebhookLead` como deprecated | Manter com `@@map("RdLead")` | Não quebrar o banco existente; migração gradual |

---

*Documento de design criado em 2026-05-23. Referência para implementação das Fases 1–3.*
