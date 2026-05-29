# AutoForce Marketing Hub — Documentação do Sistema

> **Versão:** 2.0 — Reformulação  
> **Data:** Maio 2026  
> **Ambiente:** React 19 + Node.js/Express + PostgreSQL (Railway)

---

## Índice

1. [Visão Geral](#1-visão-geral)
2. [Arquitetura Técnica](#2-arquitetura-técnica)
3. [Autenticação e Acesso](#3-autenticação-e-acesso)
4. [Navegação — Estrutura de Telas](#4-navegação--estrutura-de-telas)
5. [Tela: Dashboard](#5-tela-dashboard)
6. [Tela: Banco de Leads](#6-tela-banco-de-leads)
7. [Tela: Perfil do Lead](#7-tela-perfil-do-lead)
8. [Tela: UTM Tracker](#8-tela-utm-tracker)
9. [Tela: Funil Unificado](#9-tela-funil-unificado)
10. [Tela: Campanhas](#10-tela-campanhas)
11. [Tela: Analytics (GA4)](#11-tela-analytics-ga4)
12. [Tela: E-mails](#12-tela-e-mails)
13. [Tela: Ganhos](#13-tela-ganhos)
14. [Tela: Conexões](#14-tela-conexões)
15. [Banco de Leads — Funcionalidades Avançadas](#15-banco-de-leads--funcionalidades-avançadas)
16. [Regras de Classificação de Leads](#16-regras-de-classificação-de-leads)
17. [Webhooks de Entrada](#17-webhooks-de-entrada)
18. [Integrações Externas](#18-integrações-externas)
19. [Fluxo de Dados — Jornada do Lead](#19-fluxo-de-dados--jornada-do-lead)
20. [Segurança](#20-segurança)

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
  └── Microsoft Clarity (desativado)
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

---

## 5. Tela: Dashboard

**Rota:** `/` ou `/dashboard`

Painel executivo com visão consolidada de todas as métricas de marketing. Atualizado com dados reais de todas as integrações ativas.

### Filtro de período

Seletor de data (início / fim) que filtra todos os dados da tela. Padrão: mês atual.

### Cards de KPI

4 cards principais com comparação mês a mês (variação em % com seta de tendência):

| Card | Métrica | Fonte |
|------|---------|-------|
| Total de Leads | Leads gerados no período | Banco de Leads |
| Taxa de Qualificação | % leads que viraram MQL | Banco de Leads |
| MRR | Receita Recorrente Mensal | Ganhos |
| Vendas | Número de clientes novos | Ganhos |

### Histórico de performance

Gráfico de barras mostrando os últimos 7 meses com leads por mês e MRR por mês.

### Funil visual

Gráfico de funil interativo mostrando a conversão entre etapas:
**Lead → MQL → SQL → Agendado → Demo → Proposta → Cliente**

### Grid inferior — 5 painéis analíticos

**1. Leads por Canal** — top 6 canais com barra de proporção.

**2. Lead por Etapa** — contagem e percentual de cada etapa do funil.

**3. Top Produtos** — ranking dos produtos mais vendidos com MRR acumulado.

**4. Origem dos Ganhos** — breakdown de receita por canal de aquisição.

**5. MRR por Mês** — gráfico de barras horizontais dos últimos meses.

---

## 6. Tela: Banco de Leads

**Rota:** `/leads`

Central de gestão de todos os leads do sistema. Possui 4 abas.

### Aba: Leads

#### Barra de pesquisa e filtros

- **Campo de busca:** pesquisa por nome, email, empresa, telefone
- **Filtro de status:** dropdown com todas as etapas do funil
- **Filtro de tags:** dropdown com todas as tags existentes
- **Filtro "Leads quentes":** toggle para mostrar apenas leads com ícone de chama
- **Botão Exportar CSV:** exporta todos os leads filtrados

#### Barra de funil

Barra horizontal clicável com total de leads em cada etapa. Ao clicar filtra a lista.

#### Lista de leads

Tabela paginada (padrão 50 por página) com colunas:
- **Lead** — avatar, nome, email, empresa, cargo
- **Status** — badge colorido com a etapa do funil
- **Score** — pontuação numérica
- **Tags** — chips de tags
- **Fonte** — origem (firstSource)
- **Visto** — data da última interação
- **Hot** — ícone de chama se marcado como quente

Ao clicar em qualquer linha, abre o Perfil do Lead em painel lateral.

### Aba: Campos Personalizados

Define campos extras que aparecem no perfil de cada lead.

**Configuração de cada campo:**
- **Nome interno** (usado nas regras e APIs): ex. `interesses_produto`
- **Label de exibição:** ex. "Interesses em Produto"
- **Tipo:** Texto, Número, Booleano (Sim/Não), Data, Seleção (com opções), URL
- **Opções** (para tipo Seleção): lista de valores possíveis
- **Obrigatório, Visível, Placeholder, Dica de fonte**

**Ações:** Criar, editar, reordenar (drag), deletar campos.

### Aba: Webhooks

Gerencia endpoints que recebem leads de fontes externas (formulários, landing pages, RD Station, etc.).

**Para cada webhook:**
- Nome, Tipo (RD Station / Generic / HubSpot / Custom)
- **URL única:** `https://api.autoforce.com/api/webhooks/lead/{publicId}` (copiável)
- Status ativo/inativo
- Tags automáticas
- Mapeamento de campos e valores padrão

### Aba: Regras de Classificação

Veja seção [16. Regras de Classificação de Leads](#16-regras-de-classificação-de-leads).

---

## 7. Tela: Perfil do Lead

**Rota:** `/leads/:leadId` (página completa) ou painel lateral na lista

Visão 360° de um lead específico. Layout em duas colunas.

### Cabeçalho

- Avatar com inicial do nome
- Nome completo + ícone de chama (se lead quente)
- Badge de status clicável (dropdown para mudar status)
- Email do lead

### Coluna esquerda — Dados e histórico

**Seção: Dados do Lead (editável)**
- Nome, Telefone, Empresa, Cargo, Cidade, Estado, Responsável, Score, Toggle "Lead quente"
- Botão **Salvar dados** aparece quando há alteração pendente

**Seção: Campos Personalizados**
- Um bloco para cada campo personalizado. Editável individualmente com salvamento automático.

**Seção: Notas**
- Campo de texto livre salvo automaticamente.

**Seção: Conversões**
- Linha do tempo de todas as conversões: formulário, data, campanha, UTMs.

**Seção: Histórico de Status**
- Linha do tempo das mudanças de etapa: de/para, quem mudou, motivo, data.

**Seção: Ganhos**
- Lista de receitas associadas ao lead.

### Coluna direita — Atribuição e integrações

**Seção: Informações de Atribuição**
- Primeiro contato, Fonte, Mídia, Campanha, Landing page
- **Deal Pipedrive:** badge `#1234 ↗` clicável que abre o negócio no Pipedrive (quando existe)

**Seção: Tags**
- Chips de todas as tags. Botão "+" para adicionar com autocomplete. X para remover.

---

## 8. Tela: UTM Tracker

**Rota:** `/utm`

Ferramenta para criação e rastreamento de links com parâmetros UTM padronizados.

### Criador de links

| Campo | Tipo | Descrição |
|-------|------|-----------|
| URL de destino | Texto | URL base do site/landing page |
| Destino salvo | Select | URLs salvas anteriormente |
| UTM Source | Select padronizado | google, facebook, instagram, linkedin, email, etc. |
| UTM Medium | Select padronizado | cpc, social, email, organic, referral, etc. |
| UTM Campaign | Texto | Nome da campanha |
| UTM Content | Texto | Variação do anúncio (opcional) |
| UTM Term | Texto | Palavra-chave (opcional) |

**Preview em tempo real** do link gerado antes de copiar.

**Ações:** Copiar link, Encurtar, Salvar como template, Favoritar.

### Lista de links gerados

Tabela com todos os links: URL completa/curta, UTMs, cliques, data, criador. Filtros por source, medium, campaign, período.

**Templates:** aba separada com links salvos para reutilização rápida.

---

## 9. Tela: Funil Unificado

**Rota:** `/funnel`

Visão estratégica de múltiplos funis personalizáveis segmentados por campanha, canal, produto, etc.

### Lista de funis

Painel à esquerda com todos os funis: nome, cor personalizada, contagem de leads, última atualização.

### Configuração de um funil

**Critérios de inclusão de leads:**
- Por tags
- Por UTM (source, medium, campaign, landing page)
- Misto (combinação)

### Estatísticas do funil

**KPIs:** Total de leads, Conversões, Gasto total em anúncios, CTR, ROAS, CPC, Visitas.

**Distribuição por etapa:** barra visual com leads em cada etapa.

**MRR atribuído:** soma do MRR gerado pelos clientes dentro do funil.

---

## 10. Tela: Campanhas

**Rota:** `/campaigns`

Visão centralizada de campanhas de Meta Ads e Google Ads.

### Aba: Meta Ads

Tabela com: nome, status, gasto (R$), alcance, impressões, cliques, CTR, CPC, CPM.

### Aba: Google Ads

Tabela com: nome, status, gasto (R$), budget diário, conversões, impressões, cliques.

Dados sincronizados via integração OAuth. Botão "Sincronizar" na tela de Conexões.

---

## 11. Tela: Analytics (GA4)

**Rota:** `/analytics`

Dados de comportamento do site vindos do Google Analytics 4.

### Landing Pages

Tabela com: caminho da página, título, visualizações, usuários únicos, conversões, bounce rate, tempo médio de sessão.

**Filtros:** período (start date / end date). **Botão "Sincronizar GA4"** força atualização.

---

## 12. Tela: E-mails

**Rota:** `/emails`

Métricas de campanhas e automações de e-mail vindas do RD Station.

### Aba: Campanhas de E-mail

Tabela com: nome, data de envio, enviados, abertos + taxa, cliques + CTR, conversões, bounce.

**Botão "Sincronizar RD"** força atualização.

### Aba: Automações (Workflows)

Tabela com: nome, período, enviados, abertos, cliques, taxas.

---

## 13. Tela: Ganhos

**Rota:** `/revenue`

Registro manual de cada venda fechada. Rastreia MRR, produtos e origem de cada receita.

### Formulário de nova receita

- **Empresa/cliente**, **Data da venda**
- **Valor de setup** (R$), **Valor MRR** (R$)
- **Origem:** Google Ads, Facebook/Meta, Indicação Parceiro, Orgânico, Outros
- **Produtos:** Autódromo, Autopilot, Autobot, Nitroads, Fluxo de IA, etc.
- **Lead vinculado** — email do lead (opcional)

### Lista de ganhos

Tabela paginada com filtros por período, origem, produto. Totais de Setup e MRR do período.

---

## 14. Tela: Conexões

**Rota:** `/connections`

Central de gerenciamento de todas as integrações com plataformas externas.

### Plataformas disponíveis

| Plataforma | Tipo de auth | O que sincroniza |
|-----------|-------------|-----------------|
| **Meta Ads** | OAuth 2.0 | Campanhas, gastos, métricas de anúncios |
| **Google Ads** | OAuth 2.0 | Campanhas, métricas, conversões |
| **Google Analytics** | OAuth 2.0 | Landing pages, sessões, eventos |
| **RD Station** | OAuth 2.0 | E-mails, workflows, automações |
| **Pipedrive** | API Token | Sincroniza deals e status de leads |
| **Microsoft Clarity** | — | Desativado |

### Ações por plataforma

- **Conectar / Reconectar** — inicia o fluxo OAuth
- **Sincronizar agora** — força sync imediato
- **Desconectar** — revoga o token
- **Histórico de sync** — lista das últimas sincronizações

### Fluxo OAuth

1. Clicar em "Conectar"
2. Redirect para o provedor externo
3. Usuário autoriza o acesso
4. Token retorna criptografado com AES-256-GCM e salvo no banco
5. Card atualiza para status "Conectado"

---

## 15. Banco de Leads — Funcionalidades Avançadas

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

Quando um mesmo lead chega por fontes diferentes, o sistema **nunca sobrescreve dados existentes** — apenas preenche campos que estão vazios.

```
Lead existe: { name: "João", phone: null }
Novo dado:   { name: "JOÃO SILVA", phone: "(11) 9999-9999" }
Resultado:   { name: "João", phone: "(11) 9999-9999" }
```

### Conversões imutáveis

Cada vez que um lead entra por qualquer canal, uma **LeadConversion** é criada. Essa tabela é append-only (nunca deletada).

Cada conversão registra: fonte, campanha, formulário, landing page, UTMs, payload bruto.

**Deduplicação:** identificada por `(externalId, source)` — o mesmo evento não é duplicado.

---

## 16. Regras de Classificação de Leads

**Localização:** Banco de Leads → aba "Regras de Classificação"

Motor de automação que executa automaticamente quando um lead é atualizado ou criado.

### Como funciona

1. Lead entra ou é atualizado
2. Sistema avalia todas as regras ativas em ordem de prioridade
3. Para cada regra: avalia as **condições**
4. Se todas as condições passam: executa as **ações**
5. Registra a execução no histórico

### Condições disponíveis

**Campos avaliados:**
- Tags, Status, Score
- Nome, Email, Empresa, Cargo, Cidade, Estado
- Fonte, Mídia, Campanha, Landing Page
- Campos personalizados

**Operadores:**

| Operador | Como funciona |
|----------|--------------|
| `tem a tag` | Verifica se a tag existe no array do lead |
| `contém` | Campo contém o texto |
| `contém qualquer um de` | Contém qualquer valor da lista |
| `é igual a` | Igualdade exata |
| `está preenchido` | Campo não é nulo/vazio |
| `score maior que` | Comparação numérica |

Múltiplas condições com conectores **E / OU**.

### Ações Internas

| Ação | O que faz |
|------|-----------|
| Adicionar tag | Adiciona uma ou mais tags ao lead |
| Remover tag | Remove tags do lead |
| Adicionar pontos | Incrementa o score |
| Mudar status | Muda a etapa do funil |
| Definir campo personalizado | Salva um valor num campo personalizado |

### Ações Externas

| Ação | Plataforma | O que faz |
|------|-----------|-----------|
| Criar conversão no RD Station | RD Station | Dispara uma conversão na plataforma |
| Criar negócio no Pipedrive | Pipedrive | Cria o deal no funil configurado |

### Configuração da ação Pipedrive

**Pipeline:**
- Novo Cliente (id=2, estágio inicial: MQL)
- Upsell (id=5, estágio inicial: SQL)

**Nota no negócio (opcional):**
Editor de texto com variáveis inseríveis:
- Padrão: `{nome}`, `{email}`, `{telefone}`, `{empresa}`, `{cargo}`, `{fonte}`, `{midia}`, `{campanha}`, `{score}`
- Campos personalizados: `{cf.nomeDoCampo}`

### Configurações gerais

- **Nome** e **Prioridade** (1–999, menor = executa primeiro)
- **Modo de execução:**
  - "Somente novos leads" — somente daqui em diante
  - "Leads existentes + novos" — ao ativar, executa em todos os leads que corresponderem

### Botões de salvar

- **Salvar rascunho** — salva com `isActive: false` (não executa)
- **Ativar regra** — salva com `isActive: true` e executa imediatamente se selecionado modo "existentes"

---

## 17. Webhooks de Entrada

O sistema recebe leads via webhook HTTP. Qualquer plataforma que suporte POST pode enviar leads.

### URL do webhook

```
POST https://SEU_BACKEND/api/webhooks/lead/{publicId}
```

### Payload aceito

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

## 18. Integrações Externas

### Meta Ads

**Tipo:** OAuth 2.0 | **API:** Facebook Graph API v19.0  
**O que sincroniza:** Campanhas com gasto, alcance, impressões, cliques, CTR, CPC, CPM.

### Google Ads

**Tipo:** OAuth 2.0 + Developer Token | **API:** Google Ads API v17  
**O que sincroniza:** Campanhas com gasto, budget, conversões, impressões, cliques.

### Google Analytics 4

**Tipo:** OAuth 2.0 ou Service Account | **API:** Google Analytics Data API v1beta  
**O que sincroniza:** Landing pages — caminho, título, visualizações, usuários, conversões, bounce, tempo médio.

### RD Station

**Tipo:** OAuth 2.0 | **API:** RD Station Platform API  
**O que sincroniza:** E-mails (sends, opens, clicks, conversions, bounces), Workflows.  
**Bidirecional:** O sistema pode enviar conversões para o RD Station via ação em regras.

### Pipedrive

**Tipo:** API Token | **API:** Pipedrive API v1 | **Domínio:** `autoforce2.pipedrive.com`

**Fluxo de criação de negócio:**
1. Lead vira MQL (via regra ou manualmente)
2. Sistema busca ou cria **Pessoa** no Pipedrive pelo email
3. Sistema busca ou cria **Organização** pelo nome da empresa
4. **Negócio** criado no pipeline configurado
5. Campos mapeados preenchidos (Canal de Origem, Detalhamento MKT, etc.)
6. Nota opcional criada no negócio com variáveis do lead
7. IDs salvos no lead (`pipedriveDealId`, `pipedrivePersonId`)

**Pipelines:**

| Pipeline | ID | Estágio inicial |
|----------|----|----------------|
| Novo Cliente | 2 | MQL — id=6 |
| Upsell | 5 | SQL — id=26 |

### Microsoft Clarity

**Status:** Desativado — card visível na tela de Conexões mas sem funcionalidade ativa.

---

## 19. Fluxo de Dados — Jornada do Lead

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

## 20. Segurança

### Autenticação

- **Google OAuth 2.0** com verificação de domínio (`@autoforce.com`)
- **JWT** com expiração de 30 dias
- Token salvo no `localStorage` do navegador
- Todas as rotas da API exigem `Authorization: Bearer <token>` (exceto webhooks públicos e `/auth`)

### Criptografia de tokens de integração

- Tokens OAuth (Meta, Google, RD Station) são criptografados com **AES-256-GCM** antes de salvar no banco
- Chave de criptografia via variável de ambiente `ENCRYPTION_KEY`
- IV único por token, salvo junto com o token criptografado

### CORS

Configurado para aceitar requisições apenas de origens autorizadas (`CORS_ORIGIN`). Headers permitidos: `Content-Type`, `Authorization`.

### Webhooks públicos

O endpoint `POST /api/webhooks/lead/:publicId` é público (sem JWT), protegido por:
- `publicId` longo e randômico (UUID)
- Validação do payload antes de processar

### Variáveis de ambiente sensíveis

Gerenciadas pelo Railway (produção) e `.env` local (desenvolvimento):

```
DATABASE_URL          — conexão com PostgreSQL
JWT_SECRET            — assinar tokens JWT
ENCRYPTION_KEY        — criptografia AES-256
GOOGLE_CLIENT_ID/SECRET — OAuth Google
META_APP_ID/SECRET    — OAuth Meta
RD_STATION_CLIENT_ID/SECRET — OAuth RD Station
PIPEDRIVE_API_TOKEN   — autenticação Pipedrive
PIPEDRIVE_DOMAIN      — subdomínio (ex: autoforce2)
CORS_ORIGIN           — domínio(s) do frontend autorizados
```

---

*Documento atualizado em 2026-05-28. AutoForce Marketing Hub v2.0.*
