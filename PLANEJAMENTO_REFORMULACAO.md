# Planejamento — AutoForce Marketing Hub (v2)

> Criado em: 2026-05-23 | Atualizado em: 2026-05-23 | Status: Em maturação
>
> **REGRA INVIOLÁVEL:** Esta é uma ATUALIZAÇÃO do sistema existente. Nenhum dado atual pode ser perdido. Tudo que está no banco hoje deve estar acessível no novo sistema.
>
> **DESIGN DE REFERÊNCIA:** Protótipo criado no Claude Design analisado e documentado na [Seção 0](#0-design-de-referência--protótipo-base). Usar como base visual fiel para o desenvolvimento.

---

## Índice

0. [Design de Referência — Protótipo Base](#0-design-de-referência--protótipo-base)
1. [Visão do Novo Sistema](#1-visão-do-novo-sistema)
2. [O que muda e o que fica](#2-o-que-muda-e-o-que-fica)
3. [Estratégia de Migração — Sem Perda de Dados](#3-estratégia-de-migração--sem-perda-de-dados)
4. [Módulo Central: Banco de Leads](#4-módulo-central-banco-de-leads)
5. [Integrações de Plataformas via UI](#5-integrações-de-plataformas-via-ui)
6. [Módulo UTM Tracker](#6-módulo-utm-tracker)
7. [Nova Estrutura de Navegação](#7-nova-estrutura-de-navegação)
8. [Redesign do Frontend](#8-redesign-do-frontend)
9. [Nova Arquitetura de Dados](#9-nova-arquitetura-de-dados)
10. [Nova Arquitetura de Backend](#10-nova-arquitetura-de-backend)
11. [Fases de Desenvolvimento](#11-fases-de-desenvolvimento)
12. [Riscos e Mitigações](#12-riscos-e-mitigações)
13. [Decisões Técnicas a Tomar](#13-decisões-técnicas-a-tomar)

---

---

## 0. Design de Referência — Protótipo Base

> Arquivo: `design_bundle/sistema-marketing/project/` (extraído do Claude Design)
> O protótipo é um HTML/React interativo com 10 telas navegáveis. Usar como referência pixel-perfect para o desenvolvimento do frontend.

### Design System — Tokens

#### Cores
```
Primária (AutoForce Blue):
  --autoforce-900: #242F84   --autoforce-600: #3754E2 ← primária
  --autoforce-800: #2531A8   --autoforce-500: #456CEC
  --autoforce-700: #273BCE   --autoforce-400: #6892F2
                              --autoforce-300: #98B7F8
                              --autoforce-100: #DDE6FC
                              --autoforce-50:  #F0F4FE

Neutros (Slate):
  --slate-900: #0F172A   --slate-500: #64748B
  --slate-800: #1E293B   --slate-400: #94A3B8
  --slate-700: #334155   --slate-300: #CBD5E1
  --slate-600: #475569   --slate-200: #E2E8F0
                          --slate-100: #F1F5F9
                          --slate-50:  #F8FAFC

Status:
  Success: #22C55E / #16A34A    Warning: #EAB308 / #CA8A04
  Danger:  #EF4444 / #DC2626
```

#### Tipografia
```
Font principal: Poppins (300, 400, 500, 600, 700)
Font mono:      JetBrains Mono (400, 500) — para UTMs, dados, código

Tamanhos:
  text-xs: 11.5px   text-md: 14px    text-2xl: 24px
  text-sm: 12.5px   text-lg: 16px    text-3xl: 32px
  text-sm: 13px     text-xl: 20px
```

#### Variáveis semânticas (light / dark)
```
Light theme:
  --bg-app: #FAFBFC          --fg-primary: slate-900
  --bg-surface: #FFFFFF       --fg-secondary: slate-700
  --bg-sidebar: #0B1230       --fg-muted: slate-500

Dark theme:
  --bg-app: #0A0F22           --fg-primary: #F1F5F9
  --bg-surface: #0F1631       --fg-secondary: #CBD5E1
  --bg-sidebar: #060A1C       --fg-muted: #94A3B8
```

#### Dimensões
```
Sidebar expandida:  248px    Border radius botão: 6px
Sidebar recolhida:  64px     Border radius card:  8px
Topbar height:       56px    Sombras: muito sutis, premium
Row height:          40px    (--shadow-xs, sm, md, lg, popover)
Card padding:        20px
```

### Componentes documentados no protótipo

| Componente | Arquivo | Descrição |
|---|---|---|
| `KPI` | `primitives.jsx` | Card de métrica com sparkline, delta colorido e footer |
| `AreaChart` | `charts.jsx` | Gráfico de área para séries temporais |
| `Sparkline` | `charts.jsx` | Mini gráfico inline para KPIs |
| `MiniBars` | `charts.jsx` | Barras mini para coluna de tendência em tabelas |
| `Donut` | `charts.jsx` | Gráfico donut para financeiro/composição |
| `FunnelMini` | `dashboard.jsx` | Barras horizontais do funil consolidado |
| `Segmented` | `primitives.jsx` | Controle segmentado (tabs de filtro) |
| `Field` | `primitives.jsx` | Campo de formulário com label e hint |
| `PresetSelect` | `primitives.jsx` | Dropdown com ícone de canal |
| `ChannelIcon` | `primitives.jsx` | Ícone de plataforma (Google/Meta/TikTok/etc.) |
| `StatusBadge` | `primitives.jsx` | Badge de status com dot colorido |
| `Sidebar` | `shell.jsx` | Sidebar dark retrátil com seções e nav items |
| `Topbar` | `shell.jsx` | Barra superior com breadcrumb, ações e toggle |
| `CommandPalette` | `shell.jsx` | Cmd+K com busca de páginas, ações, campanhas |
| `Toast` | `primitives.jsx` | Notificação temporária inferior |
| `Drawer` | via CSS | Painel lateral deslizante direito |
| `InsightCard` | via CSS | Card de alerta/oportunidade com tipos opportunity/warning/success/danger |
| `HeroStrip` | via CSS | Faixa gradiente escura para ações rápidas |
| `CreativeCard` | via CSS | Card de ativo criativo com thumb |
| `CalendarGrid` | via CSS | Grade de calendário 7 colunas |
| `Toggle` | via CSS | Toggle switch |

### Navegação atual no protótipo

```
VISÃO GERAL
  └─ Dashboard

MARKETING
  ├─ Campanhas (badge: 12)
  ├─ Tracking  (badge: Novo)
  └─ Conteúdo & Criativos

INTELIGÊNCIA COMERCIAL
  ├─ Funil
  └─ Capivara (badge: Beta)

OPERAÇÃO
  ├─ Ganhos
  ├─ Relatórios
  └─ Configurações
```

### Mapeamento das telas do protótipo → novo sistema

| Tela do protótipo | Status | O que muda no sistema real |
|---|---|---|
| **Dashboard** | ✅ Usar como base | Dados reais de todas as integrações |
| **Campanhas** (lista) | ✅ Usar como base | Dados do Meta Ads + Google Ads via API |
| **Detalhe de Campanha** | ✅ Usar como base | Dados reais da campanha |
| **Tracking** (UTM builder) | ✅ Usar como base | Salvar no banco `UTMLink`, UTMs vinculados às campanhas cadastradas |
| **Funil** | ✅ Usar como base | Dados reais do banco de leads + integrações |
| **Capivara** (busca) | ✅ Usar como base | Busca no banco `Lead` real |
| **Capivara** (perfil 360°) | ✅ Usar como base | Dados reais do `Lead` + `LeadConversion` |
| **Ganhos** | ✅ Usar como base | Dados reais da tabela `RevenueEntry` |
| **Relatórios** | ✅ Usar como base | Relatórios reais |
| **Configurações** | ✅ Usar como base | Adicionar seção "Conexões de Plataformas" aqui |
| **Login** | ✅ Usar como base | Google OAuth real com restrição @autoforce.com |
| **Banco de Leads** | 🆕 Criar nova | Listagem + filtros do `Lead` — inspirar no estilo tabela das Campanhas |
| **Conexões** | 🆕 Criar nova | Cards de plataformas no estilo do painel de Configurações |
| **Conteúdo & Criativos** | ✅ Usar como base | Dados reais de `AssetItem` |

### Telas a adicionar na sidebar

```
ANTES (protótipo):           DEPOIS (sistema real):
─────────────────────────    ──────────────────────────────
Visão geral                  Visão geral
  Dashboard                    Dashboard

Marketing                    Marketing
  Campanhas                    Campanhas
  Tracking                     Tracking (UTM Builder)
  Conteúdo & Criativos         Conteúdo & Criativos

Inteligência comercial       Leads                      ← grupo renomeado
  Funil                        Banco de Leads           ← NOVA
  Capivara                     Funil de Leads
                               Capivara

Operação                     Operação
  Ganhos                       Ganhos
  Relatórios                   Relatórios
  Configurações                Conexões                 ← NOVA
                               Configurações
```

### Referências de arquivos

```
design_bundle/sistema-marketing/project/
├── index.html          → ponto de entrada, loader de scripts
├── styles.css          → design system completo (2000+ linhas)
├── app.jsx             → roteamento principal + tweaks
├── components/
│   ├── icons.jsx       → ícones SVG inline (IconDashboard, IconLink, IconCapivara...)
│   ├── charts.jsx      → AreaChart, Sparkline, MiniBars, Donut
│   ├── primitives.jsx  → KPI, Field, Segmented, StatusBadge, ChannelIcon, useCopy...
│   └── shell.jsx       → Sidebar, Topbar, CommandPalette
└── screens/
    ├── dashboard.jsx   → Dashboard principal com KPIs, gráfico, funil, canais, insights
    ├── tracking.jsx    → Gerador de UTM com preview live, encurtador, templates, histórico
    ├── campaigns.jsx   → Lista de campanhas (tabela/kanban) + detalhe da campanha
    ├── funnel.jsx      → Funil detalhado com cortes por canal/campanha/produto
    ├── capivara.jsx    → Busca 360° + perfil completo do lead
    ├── wins.jsx        → Tabela de Ganhos (Setup + MRR) com totalizadores
    └── extras.jsx      → Relatórios, Configurações, Login, Criativos
```

---

## 1. Visão do Novo Sistema

O sistema deixa de ser um dashboard de métricas e passa a ser o **centro nervoso do marketing da Autoforce** — onde todas as ferramentas, dados, leads e campanhas convergem em um único lugar.

**Princípios do novo sistema:**
- **Central:** tudo conectado aqui, nenhuma ferramenta isolada
- **Orientado a lead:** o lead é a entidade mais importante do sistema
- **Automatizado:** dados chegam sozinhos, sem entrada manual
- **Rastreável:** todos os links com UTM, tudo medido
- **Visual:** interface moderna com identidade Autoforce
- **Preservação total:** nenhum dado existente é descartado durante a migração

---

## 2. O que muda e o que fica

### Seções que SAEM
| Seção atual | Motivo | O que fazer com os dados |
|---|---|---|
| `BlogView` | Sem propósito claro | Nenhum dado relevante a migrar |
| `SiteView` | Redundante com GA4 | Nenhum dado relevante a migrar |
| `WeeklyView` | Absorvido pelo novo dashboard | Nenhum dado relevante a migrar |
| `TeamView` (formato atual) | Gestão de pessoas não é o foco do hub | Manter tabela `TeamMember` no banco, remover da navegação por ora |

### Seções que FICAM (reformuladas)
| Seção atual | Nova versão | Dados migrados |
|---|---|---|
| Dashboard | Redesign completo, tempo real | Todos os KPIs recalculados do banco existente |
| Lead Tracker | Substituído pelo Banco de Leads | `DailyLead` preservado; `WebhookLead` migrado para `Lead` |
| Revenue Tracker | Mantém com melhorias visuais | `RevenueEntry` — zero alteração |
| OKR Tracker | Mantém com melhorias visuais | `OKR` — zero alteração |
| Campanhas | Conectada ao Meta e Google Ads via API | `Campaign` preservado; dados externos somados |
| Landing Pages | GA4 em tempo real | `LandingPage` preservado; sync reformulado |
| E-mails | RD Station em tempo real | `EmailCampaign` e `WorkflowEmailStat` preservados |
| Assets | Mantém com melhorias visuais | `AssetItem` + `AssetVersion` — zero alteração |
| Calendário | Mantém com integração Google Calendar | `CampaignEvent` — zero alteração |
| Webhook Leads | Migrado para Banco de Leads | `WebhookLead` → migrado para `Lead` + `LeadConversion` |

### Seções NOVAS
| Seção nova | Descrição |
|---|---|
| **Banco de Leads** | Central de todos os leads com perfil consolidado por e-mail |
| **UTM Tracker** | Gerador e biblioteca de links com UTM para a social media |
| **Conexões** | Painel para conectar plataformas via OAuth |
| **Funil Unificado** | Visão de funil de ponta a ponta com dados de todas as fontes |

---

## 3. Estratégia de Migração — Sem Perda de Dados

> Esta seção é crítica. Toda migração de banco de dados deve ter rollback garantido antes de executar.

### Princípio geral
- **Nunca deletar** uma tabela ou coluna sem antes confirmar que os dados foram migrados
- **Sempre adicionar** antes de remover: criar nova estrutura, migrar dados, validar, só então remover o antigo
- **Migrações incrementais:** cada fase do desenvolvimento gera sua própria migration do Prisma
- **Backup obrigatório** antes de qualquer migration em produção

### Mapa de migração por modelo existente

#### `User` → sem alteração
Tabela preservada integralmente. Nenhuma migration necessária.

#### `DailyLead` → preservado + complementado
Tabela preservada. Os dados históricos de leads diários continuam acessíveis.
- O novo Banco de Leads vai calcular totais diários dinamicamente a partir das conversões
- `DailyLead` passa a ser o registro de entrada manual (quando não há dado automático)
- Ambos coexistem: entrada manual via `DailyLead` + automática via `Lead`

#### `RevenueEntry` → sem alteração + nova FK opcional
- Tabela preservada integralmente
- Adicionar coluna `leadEmail String?` (nullable) para vincular à entidade `Lead`
- Migration simples: `ALTER TABLE ADD COLUMN leadEmail TEXT` — sem risco

#### `OKR` → sem alteração
Tabela preservada integralmente. Nenhuma migration necessária.

#### `TeamMember` → sem alteração
Tabela preservada. View removida da navegação, mas dados ficam no banco.

#### `LandingPage` → sem alteração
Tabela preservada. Sync reformulado para usar `PlatformConnection` no lugar de .env.

#### `CampaignEvent` → sem alteração
Tabela preservada integralmente.

#### `Campaign` → preservado + colunas novas
- Tabela preservada
- Adicionar `externalId String?` e `platformConnectionId String?` (nullable)
- Permite vincular campanhas manuais existentes com dados das APIs externas progressivamente

#### `AssetItem` + `AssetVersion` → sem alteração
Tabelas preservadas integralmente.

#### `EmailCampaign` + `WorkflowEmailStat` → sem alteração
Tabelas preservadas. Sync reformulado para usar `PlatformConnection`.

#### `SyncLog` → preservado + campo novo
- Adicionar campo `platformConnectionId String?` (nullable)
- Logs históricos sem vinculação continuam válidos

#### `WebhookLead` → MIGRAR para `Lead` + `LeadConversion`
Este é o único modelo que passa por migração real de dados.

**Plano de migração:**
1. Criar tabelas `Lead` e `LeadConversion` (nova migration)
2. Rodar script de migração: para cada `WebhookLead`, criar um `Lead` + uma `LeadConversion`
3. Validar contagens: `SELECT COUNT(*) FROM WebhookLead` deve igualar `SELECT COUNT(*) FROM Lead WHERE originSource = 'rdstation_webhook'`
4. Manter tabela `WebhookLead` por 30 dias após migração (renomear para `WebhookLead_backup`)
5. Só deletar após confirmação total

**Script de migração (pseudocódigo):**
```typescript
const webhookLeads = await prisma.webhookLead.findMany();

for (const wl of webhookLeads) {
  await prisma.lead.upsert({
    where: { email: wl.email },
    update: {
      // só atualiza campos que estão em branco
      name: lead.name || wl.name,
      phone: lead.phone || wl.phone,
      company: lead.company || wl.company,
      lastSeenAt: wl.lastConversionDate,
    },
    create: {
      email: wl.email,
      name: wl.name,
      phone: wl.phone,
      company: wl.company,
      originSource: 'rdstation_webhook',
      firstSeenAt: wl.lastConversionDate,
    }
  });

  await prisma.leadConversion.create({
    data: {
      leadEmail: wl.email,
      source: 'rdstation_webhook',
      rawData: wl.conversionInfo,
      convertedAt: wl.lastConversionDate,
    }
  });
}
```

### Backup antes de cada fase em produção
```bash
# Antes de qualquer migration em produção
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M).sql
```

---

## 4. Módulo Central: Banco de Leads

### Conceito
O **e-mail é a chave primária** de todo lead no sistema. Todo formulário de qualquer campanha (Meta Lead Ads, Google, landing pages, RD Station, webhooks) tem e-mail como campo obrigatório.

Quando um mesmo e-mail aparece em múltiplas campanhas, o sistema **não duplica** — atualiza o perfil e registra cada conversão como um evento no histórico.

### O que um perfil de lead contém

```
Lead (email como chave primária)
│
├── Dados pessoais
│   ├── Nome (do formulário mais recente com o campo preenchido)
│   ├── Telefone
│   ├── Empresa
│   └── Cargo
│
├── Status no funil
│   └── Lead → MQL → SQL → Cliente → Perdido
│
├── Origem original (primeira conversão: fonte, campanha, UTMs)
│
├── Tags (automáticas por campanha + manuais)
│
├── Anotações (campo livre para o time)
│
└── Histórico de conversões (ordem cronológica)
    ├── [2026-03-01] RD Station — Formulário "E-book X"
    │   utm_source=instagram, utm_medium=organico, utm_campaign=ebook-x
    │   Campos preenchidos: nome, email, telefone
    │
    ├── [2026-03-15] Meta Lead Ads — Campanha "Primavera"
    │   Campos preenchidos: nome, email, empresa
    │
    └── [2026-04-02] Landing Page — "/lp/trial"
        utm_source=google, utm_medium=cpc, utm_campaign=trial-abril
        Campos preenchidos: nome, email, cargo
```

### Regras de consolidação de dados
1. Chega lead com e-mail **novo** → cria perfil com todos os campos disponíveis
2. Chega lead com e-mail **existente** → preenche apenas campos que estão em branco no perfil; nunca sobrescreve dados existentes por dados novos (exceto `lastSeenAt`)
3. Toda chegada de lead (novo ou existente) gera uma nova `LeadConversion` no histórico
4. O campo `originSource` e `originCampaign` registra SEMPRE a **primeira** conversão e nunca muda

### Fontes de entrada de leads

| Fonte | Como chega | Campos obrigatórios |
|---|---|---|
| **RD Station (formulários)** | Webhook em tempo real | email |
| **Meta Lead Ads** | Sync via API do Meta (a cada 5 min) | email |
| **Google Ads (formulários)** | Sync via Google Ads API | email |
| **Landing pages próprias** | Webhook POST da LP para o sistema | email |
| **Entrada manual** | Interface do sistema | email + nome |

### Visões do módulo Banco de Leads

**Lista de leads:**
- Tabela paginada com busca por nome/email/empresa
- Filtros: status no funil, tag, origem, data de criação, data de última interação
- Ordenação por qualquer coluna
- Exportação para CSV (todos os filtros aplicados)
- Contador: total de leads, por status

**Perfil do lead (página individual):**
- Dados pessoais consolidados
- Status atual no funil (editável)
- Tags (adicionáveis/removíveis)
- Campo de anotações
- Linha do tempo de conversões (do mais recente ao mais antigo)
- Cada conversão mostra: fonte, campanha, UTMs, campos preenchidos, data

**Funil de leads:**
- Visualização de quantos leads em cada etapa
- Conversão entre etapas (%)
- Filtro por período e origem

---

## 5. Integrações de Plataformas via UI

### Painel de Conexões (`/conexoes`)

Cards para cada plataforma, cada um com:
- Ícone e nome da plataforma
- Status: Conectado (verde) / Não conectado (cinza) / Erro (vermelho)
- Nome da conta conectada e ID
- Última sincronização
- Botões: "Conectar" / "Desconectar" / "Sincronizar agora"

```
┌─────────────────────────────────────────────────────┐
│  Meta Ads            ● Conectado                    │
│  Conta: Autoforce — act_123456789                   │
│  Última sync: há 8 minutos                          │
│  [Sincronizar agora]              [Desconectar]     │
├─────────────────────────────────────────────────────┤
│  Google Ads          ○ Não conectado                │
│                                  [Conectar]         │
├─────────────────────────────────────────────────────┤
│  Google Analytics 4  ● Conectado                    │
│  Property: Autoforce — 123456789                    │
│  Última sync: há 12 minutos                         │
│  [Sincronizar agora]              [Desconectar]     │
├─────────────────────────────────────────────────────┤
│  RD Station          ● Conectado                    │
│  Workspace: Autoforce Marketing                     │
│  Última sync: há 3 minutos                          │
│  [Sincronizar agora]              [Desconectar]     │
├─────────────────────────────────────────────────────┤
│  Google Calendar     ● Conectado                    │
│  Calendário: marketing@autoforce.com                │
│  Última sync: há 10 minutos                         │
│  [Sincronizar agora]              [Desconectar]     │
└─────────────────────────────────────────────────────┘
```

### Migração das conexões existentes (.env → banco)
As credenciais que hoje estão no `.env` serão migradas para a tabela `PlatformConnection` na Fase 2. O processo:
1. Sistema lê as variáveis do `.env` na primeira inicialização da nova versão
2. Cria automaticamente os registros de `PlatformConnection` com esses dados
3. Remove a dependência das variáveis de ambiente para tokens (mantém apenas variáveis de configuração como `PORT`, `DATABASE_URL`)

### Dados sincronizados por plataforma

| Plataforma | Dados sincronizados | Frequência |
|---|---|---|
| **Meta Ads** | Campanhas, ad sets, anúncios, gastos, impressões, cliques, CPM, CPC, CTR, ROAS, Leads (Lead Ads) | Campanhas: 1h / Leads: 5min |
| **Google Ads** | Campanhas, grupos, palavras-chave, gastos, impressões, cliques, CPC, Quality Score, conversões | 1h |
| **GA4** | Sessões, usuários, pageviews por LP, taxa de conversão, bounce rate, tempo na página, eventos | 30min |
| **RD Station** | Leads (webhook + pull), campanhas de e-mail, workflows, tags de lead, conversões | Leads: tempo real / E-mail: 15min |
| **Google Calendar** | Eventos de marketing, datas de campanhas | 15min |

### Segurança dos tokens
- Tokens OAuth armazenados com criptografia AES-256 no banco
- Chave de criptografia definida em variável de ambiente (`ENCRYPTION_KEY`)
- Tokens nunca retornados nas respostas da API (apenas status e metadados da conexão)
- Refresh token automático antes da expiração

---

## 6. Módulo UTM Tracker

### Conceito
A social media acessa esta seção e cria links rastreados de forma simples e padronizada. Os valores de `utm_source` e `utm_medium` são selecionados em dropdowns (sem digitação livre) para garantir consistência nos relatórios.

### Interface do gerador de UTM

```
CRIAR LINK RASTREADO
────────────────────────────────────────────────────

URL de destino *
┌────────────────────────────────────────────────┐
│ https://autoforce.com/...                      │
└────────────────────────────────────────────────┘

Campanha *                          Origem *
┌────────────────────────┐         ┌───────────────────┐
│ [Selecionar campanha ▼]│         │ Instagram       ▼ │
│  — ou digitar nome —   │         │ Facebook          │
└────────────────────────┘         │ LinkedIn          │
                                   │ Google            │
Mídia *                            │ YouTube           │
┌────────────────────────┐         │ TikTok            │
│ Orgânico             ▼ │         │ WhatsApp          │
│ Pago                   │         │ E-mail            │
│ Stories                │         └───────────────────┘
│ Reels                  │
│ Feed                   │
│ Carrossel              │
│ Display                │
└────────────────────────┘

Conteúdo (opcional)              Termo (opcional)
┌────────────────────────┐       ┌────────────────────┐
│ ex: post-carrossel-maio│       │ ex: palavra-chave  │
└────────────────────────┘       └────────────────────┘

─────────────────────────────────────────────────────────
LINK GERADO:
https://autoforce.com/...?utm_source=instagram&utm_medium=organico&...

                        [Copiar link]    [Salvar na biblioteca]
```

### Biblioteca de links
Tabela com todos os links já criados:
- Título, URL destino, Origem, Mídia, Campanha, Data de criação, Criador
- Filtros por campanha, origem, data
- Coluna de cliques (dados do GA4, se disponível)
- Botão copiar em cada linha
- Busca por qualquer campo

### Templates de UTM
Salvar combinações frequentes como template com nome:
- Ex: "Instagram Stories Orgânico" → pré-preenche origem + mídia
- Selecionável no gerador para agilizar a criação

### Valores padronizados (sem digitação livre)

**utm_source:**
`instagram` | `facebook` | `linkedin` | `google` | `youtube` | `tiktok` | `whatsapp` | `email` | `direto`

**utm_medium:**
`organico` | `pago` | `stories` | `reels` | `feed` | `carrossel` | `display` | `email` | `cpc` | `video`

**utm_campaign:** selecionado das campanhas cadastradas no sistema (ou digitado livremente quando não há campanha)

---

## 7. Nova Estrutura de Navegação

```
AUTOFORCE MARKETING HUB

  ◈  Dashboard

── LEADS ──────────────────
  ◈  Banco de Leads
  ◈  Funil de Leads

── PERFORMANCE ────────────
  ◈  Campanhas
  ◈  Analytics (GA4 / LPs)
  ◈  E-mails

── RECEITA & METAS ────────
  ◈  Revenue Tracker
  ◈  OKR Tracker

── CONTEÚDO ───────────────
  ◈  Assets
  ◈  UTM Tracker
  ◈  Calendário

── CONFIG ─────────────────
  ◈  Conexões
  ◈  Configurações
```

---

## 8. Redesign do Frontend

### Identidade visual
- Definir paleta de cores com base na identidade Autoforce
- Tipografia moderna e legível (Inter ou Geist)
- Interface escura por padrão (dark mode) com toggle para claro
- Espaçamentos generosos, componentes com bordas suaves

### Componentes novos

| Componente | Descrição |
|---|---|
| `MetricCard` | KPI com número grande, variação colorida e sparkline inline |
| `LeadProfilePage` | Página de perfil completo do lead com linha do tempo |
| `ConversionTimeline` | Linha do tempo de conversões de um lead |
| `PlatformConnectionCard` | Card de integração com status, última sync e ações |
| `UTMBuilder` | Formulário guiado de geração de UTM |
| `UTMLinkLibrary` | Tabela de links criados com filtros |
| `FunnelChart` | Visualização do funil de ponta a ponta |
| `SyncStatusBadge` | Indicador de última sincronização por fonte de dados |
| `FilterBar` | Barra de filtros reutilizável entre diferentes telas |
| `EmptyState` | Estado vazio padronizado com ilustração e CTA |
| `DataTable` | Tabela reutilizável com sort, filtro, paginação e export CSV |

### Tecnologias de UI (a confirmar)
- **shadcn/ui** — componentes acessíveis, customizáveis, sem dependência pesada
- Manter **Tailwind CSS** (já em uso)
- Manter **Recharts** para gráficos (ou Tremor como alternativa mais pronta)
- Manter **React 19 + TypeScript + Vite**

---

## 9. Nova Arquitetura de Dados

### Novos modelos

#### `Lead`
```prisma
model Lead {
  id             String           @id @default(uuid())
  email          String           @unique
  name           String?
  phone          String?
  company        String?
  jobTitle       String?
  status         LeadStatus       @default(LEAD)
  originSource   String?
  originCampaign String?
  originMedium   String?
  tags           String[]
  notes          String?
  firstSeenAt    DateTime         @default(now())
  lastSeenAt     DateTime         @updatedAt
  conversions    LeadConversion[]
  createdAt      DateTime         @default(now())
  updatedAt      DateTime         @updatedAt

  @@index([status])
  @@index([originSource])
  @@index([lastSeenAt])
}

enum LeadStatus {
  LEAD
  MQL
  SQL
  CLIENT
  LOST
}
```

#### `LeadConversion`
```prisma
model LeadConversion {
  id           String   @id @default(uuid())
  leadEmail    String
  lead         Lead     @relation(fields: [leadEmail], references: [email])
  source       String
  campaignName String?
  formName     String?
  landingPage  String?
  utmSource    String?
  utmMedium    String?
  utmCampaign  String?
  utmContent   String?
  utmTerm      String?
  rawData      Json
  convertedAt  DateTime
  createdAt    DateTime @default(now())

  @@index([leadEmail])
  @@index([convertedAt])
  @@index([source])
}
```

#### `PlatformConnection`
```prisma
model PlatformConnection {
  id              String    @id @default(uuid())
  platform        Platform
  status          String    @default("disconnected")
  accountId       String?
  accountName     String?
  accessToken     String?   // criptografado AES-256
  refreshToken    String?   // criptografado AES-256
  tokenExpiry     DateTime?
  metadata        Json?
  lastSyncAt      DateTime?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  @@unique([platform])
}

enum Platform {
  META_ADS
  GOOGLE_ADS
  GOOGLE_ANALYTICS
  RD_STATION
  GOOGLE_CALENDAR
}
```

#### `UTMLink`
```prisma
model UTMLink {
  id             String   @id @default(uuid())
  title          String
  destinationUrl String
  utmSource      String
  utmMedium      String
  utmCampaign    String
  utmContent     String?
  utmTerm        String?
  fullUrl        String
  shortUrl       String?
  createdBy      String
  clicks         Int      @default(0)
  createdAt      DateTime @default(now())

  @@index([utmCampaign])
  @@index([createdBy])
  @@index([createdAt])
}
```

### Alterações em modelos existentes (sem perda de dados)

```prisma
// RevenueEntry — adicionar FK opcional para Lead
model RevenueEntry {
  // ... campos existentes mantidos ...
  leadEmail String?   // NOVO — nullable, sem breaking change
}

// Campaign — adicionar vínculo com plataformas externas
model Campaign {
  // ... campos existentes mantidos ...
  externalId           String?   // NOVO — ID na plataforma externa
  platformConnectionId String?   // NOVO — FK opcional para PlatformConnection
}

// SyncLog — adicionar vínculo com conexão
model SyncLog {
  // ... campos existentes mantidos ...
  platformConnectionId String?   // NOVO — nullable
}
```

### Modelos que permanecem sem alteração
- `User`
- `DailyLead`
- `OKR`
- `TeamMember`
- `LandingPage`
- `CampaignEvent`
- `AssetItem`
- `AssetVersion`
- `EmailCampaign`
- `WorkflowEmailStat`

### `WebhookLead` — estratégia de deprecação segura
1. Manter a tabela durante toda a Fase 1 e 2
2. Após migração e validação na Fase 1: renomear para `WebhookLead_archived`
3. Remover apenas após 30 dias de produção estável no novo sistema

---

## 10. Nova Arquitetura de Backend

### Novos serviços

| Serviço | Responsabilidade |
|---|---|
| `leads.service.ts` | Upsert por email, listagem, perfil completo, mudança de status |
| `lead-conversions.service.ts` | Histórico de conversões, registro de nova conversão |
| `platform-connections.service.ts` | CRUD de conexões, criptografia de tokens, status |
| `oauth.service.ts` | Fluxos OAuth de todas as plataformas |
| `utm-links.service.ts` | Criação, listagem, analytics de links UTM |
| `sync-scheduler.service.ts` | Orquestrador de sincronizações com frequências por plataforma |
| `lead-ingestion.service.ts` | Roteador central de entrada de leads (webhook unificado) |

### Serviços existentes reformulados

| Serviço | O que muda |
|---|---|
| `rdstation.service.ts` | Lê token de `PlatformConnection` em vez de `.env` |
| `metaAds.service.ts` | Lê token de `PlatformConnection`; adiciona sync de Lead Ads |
| `googleAnalytics.service.ts` | Lê credenciais de `PlatformConnection` |
| `webhook-leads.service.ts` | Reescrito para usar `lead-ingestion.service.ts` |

### Novos endpoints

```
# Leads
GET    /api/leads                         Listar com filtros e paginação
POST   /api/leads                         Criar/atualizar lead (upsert por email)
GET    /api/leads/:email                  Perfil completo do lead
PATCH  /api/leads/:email/status           Alterar status no funil
PATCH  /api/leads/:email/tags             Adicionar/remover tags
PATCH  /api/leads/:email/notes            Atualizar anotações
GET    /api/leads/:email/conversions      Histórico de conversões
GET    /api/leads/export                  Exportar CSV com filtros

# Conexões de Plataformas
GET    /api/connections                   Listar conexões e status
POST   /api/connections/:platform/oauth   Iniciar fluxo OAuth
GET    /api/connections/:platform/callback Callback OAuth
DELETE /api/connections/:platform         Desconectar plataforma
POST   /api/connections/:platform/sync    Forçar sincronização

# UTM Links
GET    /api/utm-links                     Listar links com filtros
POST   /api/utm-links                     Criar link UTM
GET    /api/utm-links/:id                 Detalhes do link
DELETE /api/utm-links/:id                 Remover link

# Webhook unificado
POST   /api/webhooks/ingest               Receber leads de qualquer fonte
  Header X-Source: rdstation | meta | google | manual
```

### Webhook unificado
Um único endpoint recebe leads de qualquer plataforma. O `lead-ingestion.service.ts` identifica a fonte pelo header e roteia para o parser correto antes de executar o upsert.

```
POST /api/webhooks/ingest
  ├── X-Source: rdstation   → parser RD Station → upsert Lead
  ├── X-Source: meta        → parser Meta Leads → upsert Lead
  ├── X-Source: google      → parser Google     → upsert Lead
  └── X-Source: manual      → parser manual     → upsert Lead
```

---

## 11. Fases de Desenvolvimento

> Regra: cada fase entrega funcionalidade completa. Nunca subir código pela metade.

### Fase 0 — Preparação (antes de qualquer código)
- [ ] Backup completo do banco de produção
- [ ] Confirmar decisões técnicas pendentes (seção 13)
- [ ] Definir design system / biblioteca de UI
- [ ] Criar branch `v2` separada para desenvolvimento

### Fase 1 — Fundação do Banco de Leads
**Entrega:** Leads consolidados e acessíveis via API

- [ ] Criar modelos `Lead`, `LeadConversion`, `PlatformConnection`, `UTMLink` no Prisma
- [ ] Adicionar colunas opcionais nos modelos existentes (`leadEmail` em `RevenueEntry`, etc.)
- [ ] Rodar e validar migrations sem downtime
- [ ] Criar `lead-ingestion.service.ts` com lógica de upsert e consolidação
- [ ] Rodar script de migração de `WebhookLead` → `Lead` + `LeadConversion`
- [ ] Validar contagens e integridade após migração
- [ ] Criar endpoints de leads (CRUD + filtros + export CSV)
- [ ] Manter endpoint `/api/webhooks/leads` existente apontando para o novo serviço

### Fase 2 — Integrações via UI
**Entrega:** Plataformas conectadas pela interface, sem .env para tokens

- [ ] Implementar `PlatformConnection` com criptografia de tokens
- [ ] Script de migração: ler .env atual e popular `PlatformConnection`
- [ ] OAuth flow para Meta Ads
- [ ] OAuth flow para Google (GA4 + Calendar compartilham escopo)
- [ ] OAuth flow para RD Station
- [ ] Adicionar Google Ads ao OAuth Google
- [ ] Reformular todos os serviços existentes para ler token de `PlatformConnection`
- [ ] Sync de leads do Meta Lead Ads para `Lead`
- [ ] Orquestrador de sync com frequências corretas
- [ ] Painel de Conexões no frontend

### Fase 3 — Banco de Leads (Frontend)
**Entrega:** Interface completa de gestão de leads

- [ ] Tela de listagem de leads com filtros e paginação
- [ ] Perfil completo do lead com linha do tempo de conversões
- [ ] Alteração de status no funil
- [ ] Adição/remoção de tags e anotações
- [ ] Funil de leads (visão por status)
- [ ] Exportação CSV

### Fase 4 — UTM Tracker
**Entrega:** Ferramenta pronta para a social media usar no dia a dia

- [ ] Interface de criação de UTM com dropdowns padronizados
- [ ] Integração com campanhas cadastradas no sistema
- [ ] Biblioteca de links criados com busca e filtros
- [ ] Templates de UTM frequentes
- [ ] Botão copiar em um clique

### Fase 5 — Redesign do Frontend
**Entrega:** Nova interface visual em todas as telas

- [ ] Implementar design system (cores, tipografia, tokens)
- [ ] Redesign do Dashboard com dados em tempo real
- [ ] Redesign de Campanhas (dados Meta + Google Ads integrados)
- [ ] Redesign de Analytics (GA4 em tempo real)
- [ ] Redesign de E-mails (RD Station em tempo real)
- [ ] Redesign de Revenue Tracker, OKR Tracker, Assets, Calendário
- [ ] Remover BlogView, SiteView, WeeklyView da navegação
- [ ] Responsividade e estados de loading/erro/vazio

### Fase 6 — Google Ads
**Entrega:** Dados do Google Ads no sistema

- [ ] Sincronização de campanhas Google Ads
- [ ] Métricas: cliques, impressões, gasto, CPC, conversões
- [ ] Exibição integrada com a tela de Campanhas
- [ ] Leads de formulários Google Ads → Banco de Leads

### Fase 7 — Funil Unificado e Analytics Avançado
**Entrega:** Visão completa de ROI por campanha

- [ ] Funil de ponta a ponta (Impressão → Clique → Lead → MQL → SQL → Cliente)
- [ ] Atribuição de origem por lead (first touch)
- [ ] ROI por campanha (gasto Meta/Google vs receita em `RevenueEntry`)
- [ ] Relatórios por período exportáveis

---

## 12. Riscos e Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| Dados perdidos na migração de `WebhookLead` | Baixa | Alto | Backup antes + script com validação de contagens + manter tabela original por 30 dias |
| Token OAuth expirado sem aviso | Média | Alto | Verificar expiração antes de cada sync + alertas no painel de conexões |
| Leads duplicados por variações de e-mail (letras maiúsculas, espaços) | Média | Médio | Normalizar e-mail (lowercase + trim) antes de qualquer upsert |
| Rate limit das APIs (Meta, Google) | Alta | Médio | Implementar backoff exponencial + cache de resultados |
| Breaking change nas migrations | Baixa | Alto | Sempre adicionar colunas nullable primeiro; nunca remover sem migrar |
| Dados do .env não migrados para `PlatformConnection` | Baixa | Alto | Script automático de migração na inicialização + validação antes de deprecar .env |
| Performance com muitos leads | Baixa no início | Médio no futuro | Indexes corretos desde o início; paginação em todas as listagens |

---

## 13. Decisões Técnicas a Tomar

Esses pontos precisam ser definidos antes de iniciar a Fase 0:

| # | Decisão | Opções | Quem decide |
|---|---|---|---|
| 1 | **Biblioteca de UI** | shadcn/ui, Tremor, Ant Design, Material UI | Time |
| 2 | **Dark mode** | Padrão dark com toggle, ou padrão light | Time |
| 3 | **Encurtador de URL** | Bitly API, Rebrandly, sem encurtador por ora | Time |
| 4 | **Atribuição de leads** | First touch apenas, ou last touch também | Time |
| 5 | **Deploy** | Docker local atual vs cloud (Railway, Render, Fly.io) | Time |
| 6 | **Chave de criptografia** | Variável de ambiente `ENCRYPTION_KEY` — onde guardar com segurança? | Time |
| 7 | **Google Ads na Fase 6** | Prioridade alta ou pode esperar? | Time |
| 8 | **Encurtar Fase 5** | Fazer redesign parcial (dashboard + leads) ou total de uma vez? | Time |

---

## Notas Finais

1. **Esta é uma atualização, não uma reescrita.** O sistema atual continua rodando. A v2 é desenvolvida em paralelo e ativada quando estável.
2. **Backup antes de cada fase em produção.** Sem exceção.
3. **Migrations sempre incrementais** — adicionar antes de remover, nunca o contrário.
4. **Validar dados após cada migração** — conferir contagens e integridade antes de avançar.
5. **`WebhookLead` não é deletado** até 30 dias após a migração validada.
6. **Tokens OAuth nunca no .env final** — toda credencial de plataforma mora em `PlatformConnection`, criptografada.

---

*Última atualização: 2026-05-23*
