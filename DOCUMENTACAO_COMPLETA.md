# AutoForce Marketing Hub — Documentação Completa do Sistema

> **Versão:** 2.0 — Reformulação  
> **Data:** Maio 2026  
> **Ambiente:** React 19 + Node.js/Express + PostgreSQL (Railway)

---

## Índice

1. [Visão Geral](#1-visão-geral)
2. [Arquitetura Técnica](#2-arquitetura-técnica)
3. [Autenticação e Acesso](#3-autenticação-e-acesso)
4. [Navegação — Estrutura de Telas](#4-navegação--estrutura-de-telas)
5. [Tela: Dashboard (Visão Geral)](#5-tela-dashboard-visão-geral)
6. [Tela: Banco de Leads](#6-tela-banco-de-leads)
7. [Tela: Perfil do Lead](#7-tela-perfil-do-lead)
8. [Tela: UTM Tracker](#8-tela-utm-tracker)
9. [Tela: Funil Unificado](#9-tela-funil-unificado)
10. [Tela: Campanhas](#10-tela-campanhas)
11. [Tela: Analytics (GA4)](#11-tela-analytics-ga4)
12. [Tela: E-mails](#12-tela-e-mails)
13. [Tela: Ganhos (Receita)](#13-tela-ganhos-receita)
14. [Tela: Conexões](#14-tela-conexões)
15. [Tela: Documentação](#15-tela-documentação)
16. [Banco de Leads — Funcionalidades Avançadas](#16-banco-de-leads--funcionalidades-avançadas)
17. [Regras de Classificação de Leads](#17-regras-de-classificação-de-leads)
18. [Webhooks de Entrada](#18-webhooks-de-entrada)
19. [Integrações Externas](#19-integrações-externas)
20. [Banco de Dados — Modelos](#20-banco-de-dados--modelos)
21. [API — Endpoints Completos](#21-api--endpoints-completos)
22. [Fluxo de Dados — Jornada do Lead](#22-fluxo-de-dados--jornada-do-lead)
23. [Segurança](#23-segurança)
24. [Tela: Automações](#24-tela-automações)

---

## 1. Visão Geral

O **AutoForce Marketing Hub** é o sistema central de marketing da Autoforce. Ele agrega dados de todas as plataformas de marketing (Meta Ads, Google Ads, GA4, RD Station, Pipedrive), gerencia o banco de leads, rastreia a jornada do lead desde a primeira conversão até se tornar cliente, e automatiza classificações e ações via regras configuráveis.

### Para que serve

| Área | O que o sistema faz |
|------|-------------------|
| **Leads** | Captura, organiza e enriquece todos os leads vindos de qualquer canal |
| **Atribuição** | Rastreia a origem exata de cada lead via UTM e identifica o canal de entrada |
| **Funil** | Acompanha cada lead em cada etapa: Lead → MQL → SQL → Agendado → Demo → Proposta → Cliente / Perdido |
| **Campanhas** | Centraliza métricas de Meta Ads e Google Ads em um único lugar |
| **Receita** | Registra cada venda com produto, valor, origem e vendedor |
| **Automação** | Cria regras que classificam, pontuam e movem leads automaticamente |
| **Pipedrive** | Quando um lead vira MQL, cria automaticamente o negócio no Pipedrive |

### Quem usa

Sistema interno exclusivo para a equipe Autoforce. Acesso via Google OAuth restrito ao domínio `@autoforce.com`.

---

## 2. Arquitetura Técnica

```
┌─────────────────────────────────────────────────────────┐
│                     FRONTEND                             │
│  React 19 + TypeScript + Vite                            │
│  Deploy: Vercel                                          │
│  Porta local: 5173                                       │
└──────────────────┬──────────────────────────────────────┘
                   │ HTTPS / REST API
┌──────────────────▼──────────────────────────────────────┐
│                     BACKEND                              │
│  Node.js + Express + TypeScript                          │
│  ORM: Prisma 5                                           │
│  Deploy: Railway                                         │
│  Porta local: 5000                                       │
│  Start: prisma migrate deploy && node dist/server.js     │
└──────────────────┬──────────────────────────────────────┘
                   │ DATABASE_URL
┌──────────────────▼──────────────────────────────────────┐
│                   BANCO DE DADOS                         │
│  PostgreSQL 15                                           │
│  Hosting: Railway                                        │
│  30+ tabelas, migrations incrementais                    │
└─────────────────────────────────────────────────────────┘

Integrações Externas:
  ├── Meta Ads (Graph API v19.0)
  ├── Google Ads (API v17)
  ├── Google Analytics 4 (Data API v1beta)
  ├── RD Station (OAuth 2.0)
  ├── Pipedrive (API v1)
  └── Microsoft Clarity (Metrics API)
```

### Stack completa

| Camada | Tecnologia | Versão |
|--------|-----------|--------|
| Frontend | React | 19 |
| Linguagem | TypeScript | 5.3 |
| Build | Vite | latest |
| Roteamento | React Router | v7 |
| Gráficos | Recharts | latest |
| Ícones | Lucide React | latest |
| Backend | Node.js + Express | 4.18 |
| ORM | Prisma | 5.7 |
| Banco | PostgreSQL | 15 |
| Auth | JWT + Google OAuth 2.0 | — |
| Criptografia | AES-256-GCM | — |

---

## 3. Autenticação e Acesso

### Tela de Login

**Localização:** `/` (quando não autenticado)

A tela de login exibe o logotipo da Autoforce com um único botão **"Entrar com Google"**. O sistema usa Google OAuth 2.0 com restrição de domínio — apenas emails `@autoforce.com` conseguem autenticar.

**Fluxo de autenticação:**
1. Usuário clica em "Entrar com Google"
2. Redirecionado para o Google OAuth (`/api/auth/google/redirect`)
3. Google autentica e redireciona de volta com `?auth_token=...&auth_user=...`
4. Frontend salva o JWT no `localStorage` com validade de 30 dias
5. Todas as requisições incluem `Authorization: Bearer <token>`

**Ambiente de desenvolvimento:** Login local disponível via token especial `dev-local-bypass`.

**Screenshot:** `[LOGIN — tela com logo Autoforce e botão "Entrar com Google"]`

---

## 4. Navegação — Estrutura de Telas

A navegação é uma **sidebar lateral** fixa com grupos organizados por área. Suporta tema **claro e escuro** (toggle no topo da sidebar). Em mobile, a sidebar vira menu hambúrguer.

```
┌─── SIDEBAR ───────────────────────────────┐
│  [Logo Autoforce]        [☀ / 🌙]         │
│                                            │
│  LEADS                                     │
│  ├── Banco de Leads         /leads         │
│  └── UTM Tracker            /utm           │
│                                            │
│  PERFORMANCE                               │
│  ├── Funil Unificado        /funnel        │
│  ├── Campanhas              /campaigns     │
│  ├── Analytics (GA4)        /analytics     │
│  └── E-mails                /emails        │
│                                            │
│  RECEITA & METAS                           │
│  └── Ganhos                 /revenue       │
│                                            │
│  CONFIG                                    │
│  ├── Conexões               /connections   │
│  └── Documentação           /docs          │
│                                            │
│  [Avatar] Nome Usuário                     │
│  [Sair]                                    │
└────────────────────────────────────────────┘
```

**Dashboard** (`/` ou `/dashboard`) — tela inicial ao fazer login.

**Screenshot:** `[SIDEBAR — navegação lateral com grupos LEADS, PERFORMANCE, RECEITA & METAS, CONFIG]`

---

## 5. Tela: Dashboard (Visão Geral)

**Rota:** `/` ou `/dashboard`

Painel executivo com visão consolidada de todas as métricas de marketing. Atualizado com dados reais de todas as integrações ativas.

### Seção superior — Filtro de período

Seletor de data (início / fim) que filtra todos os dados da tela. Padrão: mês atual.

### Seção de KPIs — Cards de métricas

4 cards principais com comparação mês a mês (variação em % com seta de tendência):

| Card | Métrica | Fonte |
|------|---------|-------|
| Total de Leads | Leads gerados no período | Banco de Leads |
| Taxa de Qualificação | % leads que viraram MQL | Banco de Leads |
| MRR | Receita Recorrente Mensal | Ganhos |
| Vendas | Número de clientes novos | Ganhos |

### Histórico de performance

Gráfico de barras mostrando os últimos 7 meses com:
- Leads por mês
- MRR por mês

### Funil visual

Gráfico de funil interativo mostrando a conversão entre etapas:
**Lead → MQL → SQL → Agendado → Demo → Proposta → Cliente**

Cada etapa exibe o número absoluto de leads naquele estágio.

### Grid inferior — 5 painéis analíticos

**1. Leads por Canal**
Lista os top 6 canais de origem (ex: Google Ads, Facebook, Orgânico) com barra de proporção mostrando % do total.

**2. Lead por Etapa**
Lista todas as etapas do funil com contagem e percentual atual:
- Lead (cinza)
- MQL (laranja)
- SQL (roxo)
- Agendado (amarelo)
- Demo (laranja escuro)
- Proposta (violeta)
- Cliente (verde)
- Perdido (vermelho)
- Desqualificado (cinza)

**3. Top Produtos**
Ranking dos produtos mais vendidos com quantidade de vendas e MRR acumulado.
Produtos disponíveis: Autódromo, Autopilot, Autobot, Nitroads, Fluxo de IA.

**4. Origem dos Ganhos**
Breakdown de receita por canal de aquisição (Google Ads, Facebook/Meta, Indicação, Orgânico, Outros).

**5. MRR por Mês**
Gráfico de barras horizontais dos últimos meses com MRR total.

**Screenshot:** `[DASHBOARD — visão geral com KPIs, funil e grid de 5 painéis]`

---

## 6. Tela: Banco de Leads

**Rota:** `/leads`

Central de gestão de todos os leads do sistema. É a tela mais completa do sistema — nela é possível ver, filtrar, editar e automatizar todos os leads.

### Aba: Leads

#### Barra de pesquisa e filtros

- **Campo de busca:** pesquisa por nome, email, empresa, telefone
- **Filtro de status:** dropdown com todas as etapas do funil
- **Filtro de tags:** dropdown com todas as tags existentes
- **Filtro "Leads quentes":** toggle para mostrar apenas leads marcados como quentes (ícone de chama)
- **Botão Exportar CSV:** exporta todos os leads filtrados

#### Barra de funil

Exibe o total de leads em cada etapa do funil em formato de barra horizontal clicável. Ao clicar em uma etapa, filtra a lista automaticamente.

#### Lista de leads

Tabela paginada (padrão 50 por página) com colunas:
- **Lead** — avatar inicial, nome, email, empresa, cargo
- **Status** — badge colorido com a etapa do funil
- **Score** — pontuação numérica do lead
- **Tags** — chips de tags associadas
- **Fonte** — origem do lead (firstSource)
- **Visto** — data da última interação
- **Hot** — ícone de chama se marcado como quente

Ao clicar em qualquer linha, abre o **Perfil do Lead** em painel lateral (ou página completa).

**Screenshot:** `[BANCO DE LEADS — lista com filtros, barra de funil e tabela de leads]`

### Aba: Campos Personalizados

Permite definir campos extras que aparecem no perfil de cada lead.

**Campos de configuração:**
- **Nome interno** (usado nas regras e APIs): ex. `interesses_produto`
- **Label de exibição:** ex. "Interesses em Produto"
- **Tipo:** Texto, Número, Booleano (Sim/Não), Data, Seleção (com opções), URL
- **Opções** (para tipo Seleção): lista de valores possíveis
- **Obrigatório:** se marcado, aparece destaque no perfil quando vazio
- **Visível:** controla se aparece no perfil
- **Placeholder:** texto de ajuda no formulário
- **Dica de fonte:** texto interno para lembrar de onde esse campo vem

**Ações:** Criar, editar, reordenar (drag), deletar campos.

**Screenshot:** `[CAMPOS PERSONALIZADOS — tabela de campos com tipo, label e ações]`

### Aba: Webhooks

Gerencia os endpoints que recebem leads de fontes externas (formulários, landing pages, RD Station, etc.).

**Para cada webhook:**
- **Nome:** identificação interna
- **Tipo:** RD Station, Generic, HubSpot, Custom
- **URL única:** `https://api.autoforce.com/api/webhooks/lead/{publicId}` (copiável)
- **Status:** ativo/inativo
- **Tags automáticas:** tags adicionadas automaticamente a todo lead que chegar
- **Mapeamento de campos:** define qual campo do payload mapeia para qual campo do lead
- **Valores padrão:** source, medium, campaign quando o payload não informar

**Screenshot:** `[WEBHOOKS — lista de endpoints com URL única e configurações]`

### Aba: Regras de Classificação

Veja seção [17. Regras de Classificação de Leads](#17-regras-de-classificação-de-leads).

---

## 7. Tela: Perfil do Lead

**Rota:** `/leads/:leadId` (página completa) ou painel lateral na lista

Visão 360° de um lead específico. Layout em duas colunas na versão página.

### Cabeçalho

- Avatar com inicial do nome
- Nome completo + ícone de chama (se lead quente)
- Badge de status clicável (abre dropdown para mudar o status)
- Email do lead

### Coluna esquerda — Dados e histórico

#### Seção: Dados do Lead (editável)

Form com campos editáveis inline:
- Nome, Telefone, Empresa, Cargo
- Cidade, Estado
- Responsável (assignedTo)
- Score (campo numérico)
- Toggle "Lead quente"

Botão **Salvar dados** aparece quando há alteração pendente.

#### Seção: Campos Personalizados

Um bloco para cada campo personalizado definido (tipo texto, número, select, etc.). Cada campo é editável individualmente com salvamento automático ao sair do campo.

#### Seção: Notas

Campo de texto livre para notas internas sobre o lead. Salvo automaticamente.

#### Seção: Conversões (N)

Linha do tempo de todas as conversões desse lead — cada vez que ele preencheu um formulário ou entrou por algum canal:
- Nome do formulário / fonte
- Data da conversão
- Campanha
- UTMs (source, medium, campaign)

Botão "Ver todas" carrega o histórico completo.

#### Seção: Histórico de Status (N)

Linha do tempo das mudanças de etapa do funil:
- De qual status → para qual status
- Quem mudou (usuário ou sistema)
- Motivo (ex: "Negócio criado no Pipedrive #4865")
- Data/hora

#### Seção: Ganhos

Lista de receitas associadas a esse lead (negócios fechados).

### Coluna direita — Atribuição e integrações

#### Seção: Informações de Atribuição

- **Primeiro contato:** data do primeiro registro
- **Fonte:** firstSource (ex: "google")
- **Mídia:** firstMedium (ex: "cpc")
- **Campanha:** firstCampaign (ex: "autodromo-q1-2026")
- **Landing page:** URL da primeira página visitada
- **Deal Pipedrive:** badge `#1234 ↗` clicável que abre o negócio no Pipedrive (quando existe)

#### Seção: Tags

Chips de todas as tags do lead. Botão "+" para adicionar nova tag com autocomplete. Clique no X de cada tag para remover.

**Screenshot:** `[PERFIL DO LEAD — layout duas colunas com dados, histórico e atribuição]`

---

## 8. Tela: UTM Tracker

**Rota:** `/utm`

Ferramenta para criação e rastreamento de links com parâmetros UTM padronizados. Garante consistência nos relatórios impedindo digitação livre de valores.

### Criador de links

Formulário com campos:

| Campo | Tipo | Descrição |
|-------|------|-----------|
| URL de destino | Texto | URL base do site/landing page |
| Destino salvo | Select | URLs salvas anteriormente |
| UTM Source | Select padronizado | Origem: google, facebook, instagram, linkedin, email, etc. |
| UTM Medium | Select padronizado | Mídia: cpc, social, email, organic, referral, etc. |
| UTM Campaign | Texto | Nome da campanha (linked ao Campanhas) |
| UTM Content | Texto | Variação do anúncio (opcional) |
| UTM Term | Texto | Palavra-chave (opcional) |

**Preview em tempo real** do link gerado antes de copiar.

**Ações:**
- **Copiar link** — copia para área de transferência
- **Encurtar** — gera URL curta (via integrador de encurtador)
- **Salvar como template** — salva a configuração para reutilizar
- **Favoritar** — marca como favorito para acesso rápido

### Lista de links gerados

Tabela com todos os links criados:
- Link completo / curto
- UTM Source, Medium, Campaign
- Cliques (contador)
- Data de criação
- Quem criou
- Ações: copiar, favoritar, deletar

**Filtros:** por source, medium, campaign, período, criador.

**Templates:** aba separada com links salvos como template para reutilização rápida.

**Screenshot:** `[UTM TRACKER — formulário de criação à esquerda, lista de links à direita]`

---

## 9. Tela: Funil Unificado

**Rota:** `/funnel`

Visão estratégica de múltiplos funis personalizáveis. Diferente do Dashboard que mostra o funil global, aqui é possível criar funis segmentados por campanha, canal, produto, etc.

### Lista de funis

Painel à esquerda com todos os funis criados. Cada funil mostra:
- Nome e cor personalizada
- Contagem de leads ativos
- Última atualização

Botão **"+ Novo Funil"** para criar.

### Configuração de um funil

Ao criar/editar um funil:

**Critérios de inclusão de leads:**
- **Por tags:** leads que possuem determinadas tags
- **Por UTM:** filtros de source, medium, campaign, landing page
- **Misto:** combinação de tags e UTMs

**Configurações:**
- Nome do funil
- Cor (paleta de cores customizável)
- Campanhas vinculadas (para buscar gastos com anúncios)

### Estatísticas do funil

Ao selecionar um funil, exibe:

**Cards de KPI:**
- Total de leads no funil
- Conversões (que viraram cliente)
- Gasto total em anúncios (soma das campanhas vinculadas)
- CTR médio
- ROAS
- CPC médio
- Visitas (impressões GA4)

**Distribuição por etapa:**
Barra visual mostrando quantos leads estão em cada etapa do funil dentro dos critérios.

**MRR atribuído:**
Soma do MRR gerado pelos clientes dentro do funil.

**Screenshot:** `[FUNIL UNIFICADO — lista de funis à esquerda, KPIs e distribuição à direita]`

---

## 10. Tela: Campanhas

**Rota:** `/campaigns`

Visão centralizada de campanhas de Meta Ads e Google Ads sincronizadas via integração OAuth.

### Abas

#### Meta Ads

Tabela de campanhas Meta com:
- Nome da campanha
- Status (Ativa / Pausada / Em Revisão)
- Gasto (R$)
- Alcance
- Impressões
- Cliques
- CTR (%)
- CPC (R$)
- CPM (R$)

**Filtros:** período, status.
**Ordenação:** clique em qualquer coluna.

#### Google Ads

Tabela de campanhas Google com:
- Nome da campanha
- Status
- Gasto (R$)
- Budget diário (R$)
- Conversões
- Impressões
- Cliques

**Dados sincronizados:** a cada ciclo de sync ou manualmente via botão "Sincronizar" na tela de Conexões.

**Screenshot:** `[CAMPANHAS — abas Meta Ads e Google Ads com tabela de métricas]`

---

## 11. Tela: Analytics (GA4)

**Rota:** `/analytics`

Dados de comportamento do site vindos do Google Analytics 4.

### Landing Pages

Tabela com todas as páginas do site que receberam visitas:
- Caminho da página (ex: `/autodromo`, `/autopilot`)
- Título da página
- Visualizações
- Usuários únicos
- Conversões
- Taxa de rejeição (Bounce Rate %)
- Tempo médio de sessão

**Filtros:** período (start date / end date).

**Botão "Sincronizar GA4"** — força atualização dos dados do Google Analytics.

**Screenshot:** `[ANALYTICS — tabela de landing pages com métricas GA4]`

---

## 12. Tela: E-mails

**Rota:** `/emails`

Métricas de campanhas e automações de e-mail vindas do RD Station.

### Abas

#### Campanhas de E-mail (RD Station)

Tabela de campanhas enviadas:
- Nome da campanha
- Data de envio
- Enviados
- Abertos + Taxa de abertura (%)
- Cliques + CTR (%)
- Conversões
- Bounce (rejeições)

**Botão "Sincronizar RD"** — força atualização dos dados.

#### Automações (Workflows RD Station)

Tabela de automações ativas:
- Nome do workflow
- Período de referência
- Enviados
- Abertos
- Cliques
- Taxas (abertura, clique)

**Screenshot:** `[E-MAILS — abas com campanhas e automações do RD Station]`

---

## 13. Tela: Ganhos (Receita)

**Rota:** `/revenue`

Registro manual de cada venda fechada. Permite rastrear MRR, produtos vendidos e origem de cada receita.

### Formulário de nova receita

Campos:
- **Empresa/cliente** — nome do cliente ou empresa
- **Data da venda** — data de fechamento
- **Valor de setup** (R$) — valor único de implementação
- **Valor MRR** (R$) — mensalidade recorrente
- **Origem** — como o cliente chegou:
  - Google Ads
  - Facebook / Meta
  - Indicação Parceiro
  - Orgânico
  - Outros
- **Produtos vendidos** (múltipla seleção):
  - Autódromo
  - Autopilot
  - Autobot
  - Nitroads
  - Fluxo de IA
  - Associações Automotivas
  - (e outros)
- **Lead vinculado** — email do lead no sistema (opcional, para vincular ao perfil)

### Lista de ganhos

Tabela paginada com todos os registros:
- Empresa / data
- Produtos
- Origem
- Setup (R$)
- MRR (R$)
- Ações: editar, deletar

**Filtros:** período, origem, produto.

**Totais:** soma de Setup e MRR do período filtrado.

**Screenshot:** `[GANHOS — formulário de nova receita e tabela de registros]`

---

## 14. Tela: Conexões

**Rota:** `/connections`

Central de gerenciamento de todas as integrações com plataformas externas.

### Cards de plataformas

Cada plataforma tem um card com:
- Ícone e nome da plataforma
- Status visual: **Conectado** (verde), **Desconectado** (cinza), **Erro** (vermelho), **Expirado** (amarelo)
- Nome da conta conectada
- Data da última sincronização
- Botões de ação

### Plataformas disponíveis

| Plataforma | Tipo de auth | O que sincroniza |
|-----------|-------------|-----------------|
| **Meta Ads** | OAuth 2.0 | Campanhas, gastos, métricas de anúncios |
| **Google Ads** | OAuth 2.0 | Campanhas, métricas, conversões |
| **Google Analytics** | OAuth 2.0 | Landing pages, sessões, eventos |
| **RD Station** | OAuth 2.0 | E-mails, workflows, automações |
| **Pipedrive** | API Token | Sincroniza deals e status de leads |
| **Microsoft Clarity** | — | Desativado (card visível como "Desativado") |

### Ações por plataforma

- **Conectar / Reconectar** — inicia o fluxo OAuth
- **Sincronizar agora** — força sync imediato
- **Desconectar** — revoga o token e limpa a conexão
- **Histórico de sync** — lista das últimas sincronizações com status e erros

### Fluxo OAuth

1. Clicar em "Conectar"
2. Abre popup/redirect para o Google / Meta / RD Station
3. Usuário autoriza o acesso
4. Token retorna criptografado com AES-256-GCM e salvo no banco
5. Card atualiza para status "Conectado"

**Screenshot:** `[CONEXÕES — grid de cards com status de cada plataforma]`

---

## 15. Tela: Documentação

**Rota:** `/docs`

Exibe documentação interna do sistema em formato renderizado (Markdown). Referência para equipe técnica sobre como usar as APIs, webhooks e configurações.

**Screenshot:** `[DOCUMENTAÇÃO — página de docs internos]`

---

## 16. Banco de Leads — Funcionalidades Avançadas

### Modelo de dados do Lead

O lead é a entidade central do sistema. Identificado de forma única pelo **email**.

```
Lead {
  id              — UUID gerado automaticamente
  email           — chave única (normalizado para minúsculas)
  name            — nome completo
  phone           — telefone
  company         — empresa
  jobTitle        — cargo
  city            — cidade
  state           — estado
  status          — etapa do funil (enum)
  firstSource     — origem do primeiro contato (utm_source)
  firstMedium     — mídia do primeiro contato (utm_medium)
  firstCampaign   — campanha do primeiro contato (utm_campaign)
  firstLandingPage — URL da primeira página
  score           — pontuação (inteiro, default 0)
  isHot           — lead quente (boolean)
  tags            — array de strings
  notes           — texto livre interno
  assignedTo      — email do responsável
  customFields    — JSON com campos personalizados
  pipedrivePersonId — ID da Pessoa no Pipedrive
  pipedriveDealId   — ID do Negócio no Pipedrive
  firstSeenAt     — data do primeiro registro
  lastSeenAt      — data da última interação
  qualifiedAt     — data de quando virou MQL
  convertedAt     — data de quando virou Cliente
  createdAt / updatedAt / deletedAt
}
```

### Etapas do funil (LeadStatus)

| Status | Label | Significado |
|--------|-------|------------|
| `LEAD` | Lead | Entrou no sistema, ainda não qualificado |
| `MQL` | MQL | Marketing Qualified Lead — pronto para abordagem comercial |
| `SQL` | SQL | Sales Qualified Lead — comercial aceitou |
| `SCHEDULED` | Agendado | Reunião/demo agendada |
| `DEMO` | Demo | Demo realizada |
| `PROPOSAL` | Proposta | Proposta comercial enviada |
| `CLIENT` | Cliente | Negócio fechado |
| `LOST` | Perdido | Negócio perdido |
| `DISQUALIFIED` | Desqualificado | Lead não tem fit |

### Estratégia de upsert (fill-blank)

Quando um mesmo lead chega por fontes diferentes, o sistema **nunca sobrescreve dados existentes** — apenas preenche campos que estão vazios. Exemplo:

```
Lead existe com { name: "João", phone: null }
Novo dado chega: { name: "JOÃO SILVA", phone: "(11) 9999-9999" }
Resultado: { name: "João", phone: "(11) 9999-9999" }
```
O nome não é sobrescrito (já existia), mas o telefone é preenchido (estava vazio).

### Conversões imutáveis

Cada vez que um lead entra por qualquer canal (formulário, webhook, RD Station, etc.), uma **LeadConversion** é criada. Essa tabela é append-only — nunca deletada.

Cada conversão registra: fonte, campanha, formulário, landing page, UTMs, payload bruto.

**Deduplicação:** identificada por `(externalId, source)` — o mesmo evento não é duplicado.

---

## 17. Regras de Classificação de Leads

**Localização:** Banco de Leads → aba "Regras de Classificação"

Motor de automação que permite criar regras que executam automaticamente quando um lead é atualizado ou criado.

### Como funciona

1. Lead entra ou é atualizado
2. Sistema avalia todas as regras ativas em ordem de prioridade
3. Para cada regra: avalia as **condições**
4. Se todas as condições passam (`matched = true`): executa as **ações**
5. Registra a execução na tabela de histórico

### Formulário de criação/edição de regra

**Layout:** formulário em duas colunas com preview à direita

#### Seção 1 — CONDIÇÕES

"Define quando a regra dispara"

Cada condição tem:
- **Campo** — o que avaliar:
  - Tags
  - Status
  - Score
  - Nome, Email, Empresa, Cargo, Cidade, Estado
  - Fonte, Mídia, Campanha, Landing Page
  - Campos personalizados
- **Operador:**
  - `tem a tag` (tag_exists) — verifica se a tag existe no array
  - `contém` — campo contém o texto
  - `contém qualquer um de` — contém qualquer valor da lista
  - `é igual a` — igualdade exata
  - `está preenchido` — campo não é nulo/vazio
  - `score maior que` — comparação numérica
- **Valor** — o texto/número/tag a comparar

Múltiplas condições com conectores **E / OU**.

Botão **"+ Adicionar critério"**

#### Seção 2 — AÇÕES INTERNAS

"Atualiza o banco de leads"

| Ação | Parâmetros | O que faz |
|------|-----------|-----------|
| Adicionar tag | tag(s) | Adiciona uma ou mais tags ao lead |
| Remover tag | tag(s) | Remove tags do lead |
| Adicionar pontos | pontos | Incrementa o score |
| Mudar status | novo status | Muda a etapa do funil |
| Definir campo personalizado | campo + valor | Salva um valor num campo personalizado |

#### Seção 3 — AÇÕES EXTERNAS

"Envia dados para outras plataformas"

| Ação | Plataforma | O que faz |
|------|-----------|-----------|
| Criar conversão no RD Station | RD Station | Dispara uma conversão na plataforma |
| Criar negócio no Pipedrive | Pipedrive | Cria o deal no funil configurado |

**Ações em breve:** WhatsApp Flow, Notificar equipe, Enviar evento Meta.

#### Configuração da ação Pipedrive

Ao escolher "Criar negócio no Pipedrive", aparecem:

**Pipeline:**
- Novo Cliente (id=2, estágio inicial: 1. MQL)
- Upsell (id=5, estágio inicial: SQL)

**Mapeamento de campos:**
Tabela com todos os campos do negócio no Pipedrive e como preenchê-los:

| Campo Pipedrive | Tipo de fonte | Opções |
|----------------|--------------|--------|
| Título do negócio | Campo do lead / Fixo | Nome, email, empresa, etc. |
| Canal de Origem | Fixo | Inbound, Indicação, Eventos, Outbound... |
| Detalhamento MKT | Campo do lead | Mapeia utm_medium → opção do Pipedrive |
| Referência da Origem | Campo do lead | Normalmente utm_campaign |
| Qualificador | Fixo | Membro da equipe |
| Vendedor | Fixo | Membro da equipe |
| Produto da Venda | Fixo | Produto(s) da Autoforce |
| Valor de Setup | Campo do lead / Fixo | — |
| Valor | Fixo | — |

**Nota no negócio (opcional):**
Editor de texto com variáveis inseríveis via clique:
- Variáveis padrão: `{nome}`, `{email}`, `{telefone}`, `{empresa}`, `{cargo}`, `{fonte}`, `{mídia}`, `{campanha}`, `{score}`
- Variáveis de campos personalizados: `{cf.nomeDoCampo}`

#### Configurações gerais da regra

- **Nome** da regra
- **Prioridade** (1–999, menor = executa primeiro)
- **Modo de execução:**
  - "Somente novos leads" — executa apenas para leads que entrarem/atualizarem daqui em diante
  - "Leads existentes + novos" — ao ativar, executa em todos os leads do banco que corresponderem às condições

#### Botões de salvar

- **Salvar rascunho** — salva com `isActive: false` (não executa)
- **✓ Ativar regra** — salva com `isActive: true` e executa imediatamente se selecionado modo "existentes"

### Lista de regras

Tabela com todas as regras:
- Nome
- Condições (resumo)
- Ações (resumo)
- Prioridade
- Execuções (contador)
- Última execução
- Status (ativo/inativo)
- Ações: editar, executar manualmente, deletar

**Screenshot:** `[REGRAS DE CLASSIFICAÇÃO — lista de regras e formulário de criação]`

---

## 18. Webhooks de Entrada

O sistema recebe leads via webhook HTTP. Qualquer plataforma que suporte envio de dados por POST pode enviar leads.

### URL do webhook

```
POST https://SEU_BACKEND/api/webhooks/lead/{publicId}
```

Cada webhook tem um `publicId` único. A URL é copiada direto da tela de Webhooks.

### Payload aceito

O sistema aceita payloads em vários formatos (normalização automática):

```json
{
  "email": "joao@empresa.com",
  "name": "João Silva",
  "phone": "(11) 98888-7777",
  "company": "Empresa X",
  "job_title": "Gerente",
  "utm_source": "google",
  "utm_medium": "cpc",
  "utm_campaign": "autodromo-q1",
  "form_name": "LP Autódromo"
}
```

Também aceita formatos aninhados (RD Station, HubSpot, etc.) com normalização automática.

### O que acontece ao receber

1. Log na tabela `WebhookLog` com payload bruto
2. Normalização do payload
3. Upsert do lead (fill-blank strategy)
4. Criação de `LeadConversion` imutável
5. Aplicação das tags automáticas configuradas no webhook
6. Disparo das regras de classificação
7. Resposta `{ success: true, leadId, email }`

---

## 19. Integrações Externas

### Meta Ads

**Tipo:** OAuth 2.0  
**API:** Facebook Graph API v19.0  
**Scopes:** `ads_read`, `ads_management`, `pages_read_engagement`

**O que sincroniza:**
- Lista de campanhas ativas e pausadas
- Por campanha: gasto, alcance, impressões, cliques, CTR, CPC, CPM
- Status da campanha (Ativa / Pausada / Em Revisão)

**Frequência:** Sob demanda (botão "Sincronizar") ou via agendador automático.

---

### Google Ads

**Tipo:** OAuth 2.0 + Developer Token  
**API:** Google Ads API v17

**O que sincroniza:**
- Lista de campanhas
- Por campanha: gasto, budget, conversões, impressões, cliques
- Métricas salvas na tabela `CampaignMetrics` (snapshot diário)

---

### Google Analytics 4

**Tipo:** OAuth 2.0 ou Service Account  
**API:** Google Analytics Data API v1beta

**O que sincroniza:**
- Landing pages: caminho, título, visualizações, usuários, conversões, bounce rate, tempo médio de sessão

**Property ID:** configurado por usuário na tela de Conexões.

---

### RD Station

**Tipo:** OAuth 2.0  
**API:** RD Station Platform API

**O que sincroniza:**
- Campanhas de e-mail: sends, opens, clicks, conversions, bounces
- Workflows/automações: métricas por workflow

**Funcionalidade bidirecional:**
- O sistema pode enviar conversões para o RD Station (via ação em regras)

---

### Pipedrive

**Tipo:** API Token  
**API:** Pipedrive API v1  
**Domínio:** `autoforce2.pipedrive.com`

**Fluxo de criação de negócio:**
1. Lead vira MQL (via regra ou manualmente)
2. Sistema busca ou cria **Pessoa** no Pipedrive pelo email
3. Sistema busca ou cria **Organização** pelo nome da empresa
4. Pessoa é vinculada à Organização
5. **Negócio** é criado no pipeline configurado (Novo Cliente ou Upsell)
6. Campos mapeados são preenchidos (Canal de Origem, Detalhamento MKT, etc.)
7. Nota opcional é criada no negócio com variáveis do lead
8. IDs do Pipedrive são salvos no lead (`pipedriveDealId`, `pipedrivePersonId`)
9. Lead é marcado como MQL no sistema

**Pipelines:**

| Pipeline | ID | Estágio inicial |
|----------|----|----------------|
| Novo Cliente | 2 | 1. (MQL) — id=6 |
| Upsell | 5 | SQL — id=26 |

**Campos personalizados mapeados:**

| Campo no Pipedrive | Chave | Tipo |
|-------------------|-------|------|
| Canal de Origem | `9459f9b4...` | Enum |
| Detalhamento MKT | `973cdb7b...` | Enum |
| Referência da Origem | `cfd4bf93...` | Texto |
| Qualificador | `2d1b008a...` | Enum |
| Vendedor | `d0c46ae2...` | Enum |
| Produto da Venda | `1d44a1c1...` | Set (múltipla seleção) |
| Valor de Setup | `4a5f006a...` | Monetário |

---

### Microsoft Clarity

**Status:** Card visível na tela de Conexões mas marcado como **"Desativado"**  
**Motivo:** Token JWT disponível tem escopo `Data.Export`, não acesso à Metrics API necessária.

---

## 20. Banco de Dados — Modelos

### Modelos principais

```
Lead                    — central de leads
LeadConversion          — histórico de conversões (imutável)
LeadStatusHistory       — auditoria de mudanças de status
LeadCustomFieldDef      — definição dos campos personalizados
LeadClassificationRule  — regras de automação
LeadClassificationRuleExecution — histórico de execuções
LeadWebhookSource       — configuração dos webhooks de entrada
WebhookLog              — log bruto de todos os webhooks recebidos

PlatformConnection      — tokens e configuração de cada integração
Campaign                — campanhas (Meta/Google)
CampaignMetrics         — métricas diárias das campanhas
CampaignEvent           — eventos do calendário

UTMLink                 — links gerados com UTM
UTMDestination          — destinos de URL salvos

Funnel                  — funis personalizados
RevenueEntry            — registros de receita
DailyLead               — agregado diário do funil
LandingPage             — dados das landing pages (GA4)

EmailCampaign           — campanhas de e-mail (RD Station)
WorkflowEmailStat       — stats de automações RD Station

User                    — usuários do sistema
OKR                     — objetivos e resultados-chave
TeamMember              — membros da equipe
AssetItem               — ativos criativos
AssetVersion            — versões dos ativos
SyncLog                 — log de sincronizações
```

### Migrations em produção

O Prisma gerencia todas as migrations. O comando `prisma migrate deploy` é executado **automaticamente** ao iniciar o servidor (configurado no `start` do `package.json`).

Lista de migrations (ordem cronológica):
1. `20260122144227_primeira_versao` — estrutura base
2. `20260523100000_lead_foundation` — banco de leads, plataformas, UTM
3. `20260523200000_lead_custom_fields_pipedrive` — campos personalizados, Pipedrive
4. `20260525000000_add_funnel_model` — funis personalizados
5. `20260527000000_lead_webhook_sources` — webhooks configuráveis
6. `20260527002000_lead_classification_rules` — motor de regras
7. `20260528003000_lead_status_scheduled_demo_proposal` — novos status do funil
8. `...` (e outras intermediárias)

---

## 21. API — Endpoints Completos

**Base URL:** `https://SEU_BACKEND/api`  
**Autenticação:** `Authorization: Bearer <JWT>` em todos os endpoints (exceto auth e webhooks públicos)

### Autenticação
```
POST   /api/auth/google           — verificar token Google
GET    /api/auth/google/redirect  — redirect OAuth
GET    /api/auth/me               — dados do usuário logado
```

### Banco de Leads
```
GET    /api/lead-hub              — listar leads (paginado + filtros)
POST   /api/lead-hub              — criar lead manualmente
GET    /api/lead-hub/funnel       — contagem por status
GET    /api/lead-hub/tags         — todas as tags existentes
GET    /api/lead-hub/by-source    — leads agrupados por origem
GET    /api/lead-hub/export       — exportar CSV

GET    /api/lead-hub/:email       — perfil por email
PATCH  /api/lead-hub/:email/status        — mudar status
PATCH  /api/lead-hub/:email/notes         — salvar notas
PATCH  /api/lead-hub/:email/custom-fields — salvar campo personalizado
POST   /api/lead-hub/:email/tags          — adicionar tag
DELETE /api/lead-hub/:email/tags/:tag     — remover tag

GET    /api/lead-hub/id/:id       — perfil por ID
PATCH  /api/lead-hub/id/:id       — atualizar perfil por ID
PATCH  /api/lead-hub/id/:id/status
PATCH  /api/lead-hub/id/:id/notes
PATCH  /api/lead-hub/id/:id/custom-fields
POST   /api/lead-hub/id/:id/tags
DELETE /api/lead-hub/id/:id/tags/:tag
DELETE /api/lead-hub/id/:id       — soft delete
GET    /api/lead-hub/id/:id/conversions — todas as conversões

GET    /api/lead-hub/custom-fields        — listar campos personalizados
POST   /api/lead-hub/custom-fields        — criar campo
PATCH  /api/lead-hub/custom-fields/:id    — editar campo
DELETE /api/lead-hub/custom-fields/:id    — deletar campo

POST   /api/lead-hub/migrate-webhook  — migrar RdLead → Lead (one-time)
```

### Regras de Classificação
```
GET    /api/lead-rules            — listar regras
POST   /api/lead-rules            — criar regra
GET    /api/lead-rules/:id        — detalhe da regra
PATCH  /api/lead-rules/:id        — editar regra
DELETE /api/lead-rules/:id        — deletar regra
POST   /api/lead-rules/:id/run-existing — executar em leads existentes
```

### Webhooks de Entrada
```
GET    /api/lead-webhooks         — listar webhooks configurados
POST   /api/lead-webhooks         — criar webhook
PATCH  /api/lead-webhooks/:id     — editar webhook
DELETE /api/lead-webhooks/:id     — deletar webhook
POST   /api/webhooks/lead/:publicId — endpoint público de recebimento
```

### Campanhas
```
GET    /api/campaigns             — todas as campanhas
GET    /api/campaigns/meta        — campanhas Meta Ads
GET    /api/campaigns/google      — campanhas Google Ads
POST   /api/campaigns             — criar campanha
PUT    /api/campaigns/:id         — editar
DELETE /api/campaigns/:id         — deletar
```

### Conexões (Integrações)
```
GET    /api/connections                      — todas as conexões
GET    /api/connections/:platform/auth-url   — URL OAuth
GET    /api/connections/:platform/callback   — callback OAuth
POST   /api/connections/:platform/disconnect — desconectar
POST   /api/connections/:platform/sync       — sincronizar agora
PUT    /api/connections/:platform/config     — salvar configuração
```

### Funis
```
GET    /api/funnels               — listar funis
POST   /api/funnels               — criar funil
GET    /api/funnels/stats         — estatísticas com filtros
PATCH  /api/funnels/:id           — editar
DELETE /api/funnels/:id           — deletar (soft)
```

### Receita
```
GET    /api/revenue/transactions  — listar ganhos
POST   /api/revenue/transactions  — registrar venda
PUT    /api/revenue/transactions/:id  — editar
DELETE /api/revenue/transactions/:id  — deletar
```

### Analytics
```
GET    /api/analytics/landing-pages  — landing pages GA4
POST   /api/analytics/sync-ga4       — forçar sync GA4
```

### E-mails
```
GET    /api/email/campaigns                  — campanhas de e-mail
GET    /api/email/campaigns/rdstation/sync   — sincronizar RD Station
GET    /api/email/automation/rdstation       — automações
GET    /api/email/automation/rdstation/sync  — sincronizar automações
GET    /api/email/sync/logs                  — logs de sync
```

### UTM Links
```
GET    /api/utm-links             — listar links (paginado + filtros)
POST   /api/utm-links             — criar link
GET    /api/utm-links/templates   — templates salvos
GET    /api/utm-links/campaigns   — campanhas para picker
PATCH  /api/utm-links/:id/favorite — favoritar/desfavoritar
DELETE /api/utm-links/:id         — deletar
```

### Dashboard
```
GET    /api/dashboard/metrics     — KPIs do mês atual
GET    /api/dashboard/history     — histórico dos últimos 7 meses
```

### Health Check
```
GET    /api/health                — { status: "ok" }
```

---

## 22. Fluxo de Dados — Jornada do Lead

```
                    ENTRADA DO LEAD
                         │
          ┌──────────────┼──────────────┐
          │              │              │
     Webhook         RD Station    Manual
     (formulário)    (automação)   (via UI)
          │              │              │
          └──────────────┼──────────────┘
                         │
                  LEAD HUB SERVICE
                  upsertLead()
                  - fill-blank strategy
                  - normaliza email
                  - registra LeadConversion
                         │
                  REGRAS AUTOMÁTICAS
                  - avalia condições
                  - executa ações:
                    · tags, score, status
                    · RD Station conversion
                    · Pipedrive deal
                         │
                  ┌──────┴──────┐
                  │             │
             Permanece      Vira MQL
             como Lead          │
                            PIPEDRIVE
                            createDealForLead()
                            - find/create Person
                            - find/create Org
                            - create Deal
                            - create Note
                            - save IDs no lead
                                 │
                          FUNIL COMERCIAL
                          (Pipedrive gerencia)
                          MQL → SQL → Agendado
                          → Demo → Proposta
                                 │
                          ┌──────┴──────┐
                          │             │
                      CLIENTE        PERDIDO
                          │
                    REVENUE ENTRY
                    (registrar venda manual)
```

---

## 23. Segurança

### Autenticação

- **Google OAuth 2.0** com verificação de domínio (`@autoforce.com`)
- **JWT** com expiração de 30 dias
- Token salvo no `localStorage` do navegador
- Todas as rotas da API exigem `Authorization: Bearer <token>` (exceto webhooks públicos e `/auth`)

### Criptografia de tokens de integração

- Tokens OAuth das plataformas (Meta, Google, RD Station) são criptografados com **AES-256-GCM** antes de salvar no banco
- Chave de criptografia via variável de ambiente `ENCRYPTION_KEY`
- IV (vetor de inicialização) único por token, salvo junto com o token criptografado

### CORS

Configurado para aceitar requisições apenas de origens autorizadas (`CORS_ORIGIN`). Headers permitidos: `Content-Type`, `Authorization`.

### Webhooks públicos

O endpoint `POST /api/webhooks/lead/:publicId` é público (sem JWT), mas protegido por:
- `publicId` longo e randômico (UUID)
- Rate limiting implícito
- Validação do payload antes de processar

### Variáveis de ambiente sensíveis

Nunca commitadas no repositório. Gerenciadas pelo Railway (produção) e `.env` local (desenvolvimento):

```
DATABASE_URL          — conexão com PostgreSQL
JWT_SECRET            — assinar tokens JWT
ENCRYPTION_KEY        — criptografia AES-256
GOOGLE_CLIENT_ID/SECRET — OAuth Google
META_APP_ID/SECRET    — OAuth Meta
RD_STATION_CLIENT_ID/SECRET — OAuth RD Station
PIPEDRIVE_API_TOKEN   — autenticação Pipedrive
PIPEDRIVE_DOMAIN      — subdomínio Pipedrive (ex: autoforce2)
CORS_ORIGIN           — domínio(s) do frontend autorizados
```

---

## 24. Tela: Automações

A tela de Automações permite criar, editar, monitorar e ativar **jornadas automatizadas de leads** — fluxos visuais compostos por blocos conectados que definem o que deve acontecer quando um determinado evento ocorre. É a camada de orquestração central do sistema: integra ações internas, RD Station, WhatsApp e Pipedrive em um único fluxo configurável.

![screenshot](prints/20_automacoes_lista.png)

---

### 24.1 Lista de Jornadas

A tela inicial de Automações exibe todos as jornadas cadastradas no sistema em formato de cards.

![screenshot](prints/21_automacoes_cards.png)

#### Campos exibidos por card

| Campo | Descrição |
|-------|-----------|
| **Nome** | Nome da jornada definido na criação |
| **Status badge** | Rascunho (cinza), Ativa (verde), Pausada (amarelo) |
| **Toggle liga/desliga** | Ativa ou pausa a jornada diretamente no card, sem abrir o editor |
| **Contador de execuções** | Número total de execuções da jornada; clicável — abre o painel de monitoramento |
| **Botão lápis (editar)** | Abre o editor canvas da jornada |
| **Ícone Activity (monitorar)** | Abre o painel de monitoramento (ExecutionsDrawer) diretamente |

#### Busca e filtros

- **Campo de busca:** filtra jornadas por nome (busca client-side, em tempo real)
- **Filtro por status:** Todos / Rascunho / Ativa / Pausada

#### Criar nova jornada

O botão **"+ Automação"** no canto superior direito cria uma nova jornada em branco (status Rascunho) e abre o editor canvas imediatamente.

---

### 24.2 Editor Canvas

Ao clicar no ícone de edição de uma jornada, o sistema abre o **editor canvas** — uma tela de edição visual de fluxo com grade infinita.

![screenshot](prints/22_automacoes_editor.png)

#### Grade e navegação

| Interação | Comportamento |
|-----------|---------------|
| **Espaço vazio — clicar e arrastar** | Move o viewport (pan); cursor muda para `grab` / `grabbing` |
| **Grade de pontos** | Referência visual infinita; escala com o viewport |
| **Arrastar bloco da barra superior** | Solta o bloco na posição exata onde foi solto no canvas |
| **Clicar em bloco** | Seleciona o bloco (destaque visual) |
| **Duplo-clique em bloco** | Abre o modal de configuração do bloco |
| **Tecla Delete / Backspace** | Remove o bloco selecionado e todas as suas conexões |

#### Conexões entre blocos

1. Cada bloco exibe um botão **"Conectar"** quando selecionado.
2. Ao clicar em "Conectar", o modo de conexão é ativado — o cursor muda e o próximo bloco clicado torna-se o destino.
3. A conexão é representada por uma **seta** entre os dois blocos.
4. Para **remover uma conexão**, clicar no ícone **X** exibido no meio da seta.

#### Barra de status (canto inferior esquerdo)

Contador fixo com o formato **"X blocos · Y conexões"**, atualizado em tempo real conforme o fluxo é editado.

#### Botões da barra superior

| Botão | Ação |
|-------|------|
| **Testar** | Abre modal de seleção de lead para execução imediata do fluxo |
| **Execuções** | Abre o painel de monitoramento (ExecutionsDrawer) |
| **Salvar rascunho** | Persiste o estado atual do canvas no banco sem publicar |
| **Publicar** | Salva e ativa a jornada (status → Ativa); triggers passam a ser disparados |

---

### 24.3 Tipos de Bloco

O editor dispõe de **7 tipos de bloco**, cada um com cor distinta e configurações próprias.

![screenshot](prints/23_automacoes_blocos.png)

---

#### 24.3.1 Entrada (Trigger)

**Cor:** Azul `#456CEC`

Define o evento que inicia a execução da jornada. Cada jornada deve ter exatamente um bloco de Entrada.

| Gatilho | Descrição | Filtro opcional |
|---------|-----------|-----------------|
| `lead_created` | Lead criado no sistema | — |
| `tag_added` | Tag adicionada ao lead | Tag específica |
| `status_changed` | Status do lead alterado | Status destino |
| `score_updated` | Score do lead atualizado | — |
| `conversion_received` | Nova conversão recebida pelo lead | — |

- Para `tag_added`: campo para informar a tag que deve disparar o trigger (deixar vazio = qualquer tag).
- Para `status_changed`: campo para informar o status destino (deixar vazio = qualquer mudança de status).

---

#### 24.3.2 Condição

**Cor:** Verde `#22C55E`

Avalia uma regra sobre o lead no momento da execução e redireciona o fluxo com base no resultado.

| Campo avaliável | Operadores disponíveis |
|-----------------|------------------------|
| `tag` | `has_tag` / `not_has_tag` |
| `status` | `=` |
| `score` | `>` / `<` / `>=` / `<=` / `=` |
| `source` | `=` |
| `company` | `=` |

**Branching:** a **1ª aresta** de saída representa o caminho **Sim** (condição verdadeira); a **2ª aresta** representa o caminho **Não**.

---

#### 24.3.3 Esperar

**Cor:** Amarelo `#F59E0B`

Pausa a execução por um período configurável antes de seguir para o próximo bloco.

| Configuração | Opções |
|-------------|--------|
| Valor | Número inteiro positivo |
| Unidade | `minutes` / `hours` / `days` / `weeks` |

**Comportamento técnico:**
- A execução fica com status `waiting` no banco, com o campo `resumeAt` preenchido com a data/hora de retomada.
- Um scheduler backend executa a cada **60 segundos** e retoma todas as execuções cujo `resumeAt` já passou.
- O painel de monitoramento exibe "Retoma em: \[data/hora\]" para execuções em espera.

---

#### 24.3.4 Ação Interna

**Cor:** Teal `#14B8A6`

Executa uma ação diretamente no lead dentro do sistema, sem chamar APIs externas.

| Ação | Descrição |
|------|-----------|
| `add_tag` | Adiciona uma tag ao lead |
| `remove_tag` | Remove uma tag do lead |
| `add_score` | Incrementa o score em N pontos |
| `set_score` | Define o score para um valor absoluto |
| `set_status` | Muda o status do lead |
| `set_hot` | Marca o lead como "quente" |
| `unset_hot` | Remove a marcação "quente" |
| `assign_to` | Atribui o lead a um usuário do sistema |

---

#### 24.3.5 RD Station

**Cor:** Roxo `#8B5CF6`

Registra uma conversão no RD Station Marketing para o lead em questão.

| Campo | Descrição |
|-------|-----------|
| **Identificador da conversão** | String livre (ex: `lead_qualificado`, `demo_agendada`). O RD cria o identificador automaticamente se ainda não existir. |

**Comportamento:** cria ou atualiza o contato no RD Station e registra o evento de conversão com o identificador configurado.

---

#### 24.3.6 WhatsApp

**Cor:** Verde `#10B981`

Envia uma mensagem via WhatsApp Business usando um template aprovado pela Meta.

| Campo | Descrição |
|-------|-----------|
| **Número de envio** | Seletor populado via API Meta (Business Account); exibe os números cadastrados |
| **Template** | Lista de templates com status `APPROVED` para o WABA do número selecionado |

**Comportamento:** ao trocar o número de envio, os templates são **recarregados automaticamente** (cada número pertence a um WABA, e os templates são por WABA). Apenas templates com status `APPROVED` aparecem na lista.

---

#### 24.3.7 Pipedrive

**Cor:** Vermelho `#EF4444`

Executa ações no Pipedrive relacionadas ao lead.

| Ação | Campos configuráveis |
|------|---------------------|
| `create_deal` | Pipeline (Novo Cliente / Upsell), título do negócio (suporta variáveis), nota com variáveis, Referência da Origem (auto-preenchida com `utm_campaign` da última conversão) |
| `update_stage` | Seletor de estágio com dados reais do Pipedrive |
| `mark_won` | Usa o `pipedriveDealId` vinculado ao lead |
| `mark_lost` | Usa o `pipedriveDealId` vinculado ao lead |

---

### 24.4 Modal de Configuração dos Blocos

Acessado via **duplo-clique** em qualquer bloco no canvas.

![screenshot](prints/24_automacoes_modal_config.png)

- Exibe os campos específicos do tipo de bloco (conforme seção 24.3).
- O botão **"Salvar alterações"** persiste a configuração do bloco **imediatamente no banco**, de forma independente do estado geral da jornada — não é necessário salvar ou publicar a jornada para que a configuração do bloco seja salva.

---

### 24.5 Botão Testar

Permite executar o fluxo manualmente sobre um lead específico, sem aguardar o disparo natural do trigger.

![screenshot](prints/25_automacoes_testar.png)

**Fluxo de uso:**

1. Clicar em **"Testar"** na barra do editor.
2. Modal abre com campo de busca de leads (busca por nome ou e-mail).
3. Selecionar o lead desejado.
4. O fluxo é executado **imediatamente** para aquele lead.
5. Ao concluir, o **painel de monitoramento** (ExecutionsDrawer) é aberto automaticamente com o resultado.

---

### 24.6 Painel de Monitoramento (ExecutionsDrawer)

Painel lateral deslizante com overlay, acessível via botão "Execuções" no editor, pelo ícone Activity nos cards da lista, ou pelo contador de execuções.

![screenshot](prints/26_automacoes_monitoring.png)

#### Cards de estatísticas

| Stat | Descrição |
|------|-----------|
| **Rodando** | Execuções com status `running` no momento |
| **Aguardando** | Execuções com status `waiting` (em bloco Esperar) |
| **Concluídos** | Execuções finalizadas com sucesso |
| **Falhou** | Execuções que encontraram erro |

#### Lista de execuções

Cada item exibe:
- Nome e e-mail do lead
- Data/hora de início
- Badge de status (`running` / `waiting` / `completed` / `failed`)
- Duração total

#### Log passo a passo

Ao expandir uma execução, o log detalhado é exibido com:
- Sequência de nós percorridos
- Timestamp de cada passo
- Erros em **vermelho** com a mensagem exata do erro
- Para blocos Esperar: texto "**Retoma em:** \[data/hora\]"

#### Atualização

Botão de **atualizar** no topo do drawer recarrega a lista de execuções manualmente.

---

### 24.7 Motor de Execução (Backend)

O motor de execução é responsável por disparar e processar as jornadas automaticamente em resposta a eventos do sistema.

#### Triggers automáticos

| Evento | Quando dispara |
|--------|---------------|
| `lead_created` | Um novo lead é inserido no banco |
| `tag_added` | Uma tag é adicionada a um lead |
| `status_changed` | O status de um lead é alterado |
| `score_updated` | O score de um lead é modificado |
| `conversion_received` | Uma nova conversão é registrada para o lead |

Quando qualquer um desses eventos ocorre, o motor busca todas as jornadas **Ativas** com um bloco de Entrada correspondente ao evento (e, se aplicável, com o filtro de tag ou status satisfeito) e inicia uma execução para o lead em questão.

#### Guard de re-entrância

Para evitar execuções duplicadas da mesma jornada para o mesmo lead:

- **Modo padrão (instância única):** controle via `Set` em memória, com chave `journey_id:lead_id`.
- **Fallback multi-instância:** verificação no banco de dados para ambientes com múltiplas réplicas do backend (Railway scale-out).

#### Startup recovery

Ao iniciar o servidor, o backend verifica se há execuções com status `running` que ficaram presas (ex: crash de instância anterior). Essas execuções são marcadas automaticamente como `failed` durante o boot, garantindo que o estado do banco seja sempre consistente.

#### Scheduler de retomada (bloco Esperar)

- Executado a cada **60 segundos**.
- Busca no banco todas as execuções com status `waiting` e `resumeAt <= now()`.
- Retoma o processamento do fluxo a partir do nó seguinte ao bloco Esperar.

---

## Apêndice — Prints do Sistema

> **Instrução:** Capture os prints do sistema rodando em `http://localhost:5173` e substitua as referências abaixo pelos arquivos de imagem.

| Tela | Arquivo sugerido |
|------|-----------------|
| Login | `prints/01_login.png` |
| Dashboard — KPIs | `prints/02_dashboard_kpis.png` |
| Dashboard — Funil e grid | `prints/03_dashboard_funil.png` |
| Banco de Leads — Lista | `prints/04_leads_lista.png` |
| Banco de Leads — Filtros | `prints/05_leads_filtros.png` |
| Campos Personalizados | `prints/06_campos_personalizados.png` |
| Webhooks | `prints/07_webhooks.png` |
| Regras — Lista | `prints/08_regras_lista.png` |
| Regras — Formulário | `prints/09_regras_formulario.png` |
| Regras — Ação Pipedrive | `prints/10_regras_pipedrive.png` |
| Perfil do Lead | `prints/11_perfil_lead.png` |
| UTM Tracker | `prints/12_utm_tracker.png` |
| Funil Unificado | `prints/13_funil.png` |
| Campanhas — Meta | `prints/14_campanhas_meta.png` |
| Campanhas — Google | `prints/15_campanhas_google.png` |
| Analytics GA4 | `prints/16_analytics.png` |
| E-mails | `prints/17_emails.png` |
| Ganhos | `prints/18_ganhos.png` |
| Conexões | `prints/19_conexoes.png` |
| Automações — Lista de jornadas | `prints/20_automacoes_lista.png` |
| Automações — Cards | `prints/21_automacoes_cards.png` |
| Automações — Editor canvas | `prints/22_automacoes_editor.png` |
| Automações — Tipos de bloco | `prints/23_automacoes_blocos.png` |
| Automações — Modal de configuração | `prints/24_automacoes_modal_config.png` |
| Automações — Testar fluxo | `prints/25_automacoes_testar.png` |
| Automações — Monitoramento | `prints/26_automacoes_monitoring.png` |

---

*Documento gerado em 2026-05-28. AutoForce Marketing Hub v2.0.*
