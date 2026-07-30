# AutoForce Marketing Hub

Sistema central de marketing da Autoforce — gestão de leads, campanhas, receita, automações e integrações com Meta Ads, Google Ads, GA4, RD Station, Pipedrive e WhatsApp.

**Produção:**
- Frontend: Vercel
- Backend: `https://autoforce-performance-1-production.up.railway.app`

---

## Telas do sistema

| Tela | Rota | Descrição |
|---|---|---|
| Dashboard | `/dashboard` | KPIs, gráficos de funil, receita e leads por dia |
| Banco de Leads | `/leads` | Lista completa com filtros, busca e exportação CSV |
| Perfil do Lead | `/leads/:id` | 360° do lead: dados, conversões, status, timeline Pipedrive |
| UTM Tracker | `/utm` | Criação e gestão de links rastreados |
| Funil | `/funnel` | Visualização do funil com filtros por fonte/campanha |
| Campanhas | `/campaigns` | Meta Ads + Google Ads centralizados |
| Analytics | `/analytics` | Landing pages e tráfego via GA4 |
| E-mails | `/email` | Campanhas e workflows do RD Station |
| Ganhos | `/revenue` | Receita registrada com produto, vendedor e origem |
| **Automações** | `/automation` | Jornadas de automação com motor de execução |
| Conexões | `/connections` | Status e configuração das integrações |

---

## Início Rápido

### Pré-requisitos

- Node.js 20+
- PostgreSQL (local ou Railway)
- Arquivo `backend/.env` configurado

### 1. Instalar dependências

```bash
# Frontend
npm install

# Backend
cd backend && npm install
```

### 2. Configurar variáveis de ambiente

Crie `backend/.env`:

```env
DATABASE_URL=postgresql://usuario:senha@host:5432/banco
JWT_SECRET=gere-com-openssl-rand-hex-32
ENCRYPTION_KEY=gere-com-openssl-rand-hex-32

# Google OAuth
GOOGLE_CLIENT_ID=SEU_CLIENT_ID.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=SEU_CLIENT_SECRET
GOOGLE_ALLOWED_DOMAIN=autoforce.com

# Meta / WhatsApp
META_APP_ID=SEU_APP_ID
META_APP_SECRET=SEU_APP_SECRET
WHATSAPP_ACCESS_TOKEN=SEU_TOKEN
WHATSAPP_BUSINESS_ACCOUNT_ID=SEU_WABA_ID

# RD Station
RD_STATION_CLIENT_ID=SEU_CLIENT_ID
RD_STATION_CLIENT_SECRET=SEU_CLIENT_SECRET

# IA / Pre-qualificacao
GEMINI_API_KEY=SUA_CHAVE_GEMINI
AI_PROVIDER=gemini
GEMINI_MODEL=gemini-2.5-flash
AI_REQUEST_TIMEOUT_MS=45000

# Pipedrive
PIPEDRIVE_API_TOKEN=SEU_TOKEN
PIPEDRIVE_DOMAIN=suaempresa
PIPEDRIVE_WEBHOOK_SECRET=gere-com-openssl-rand-hex-32

# App
CORS_ORIGIN=http://localhost:5173
NODE_ENV=development
APP_URL=http://localhost:5000
```

### 3. Rodar migrations e iniciar

```bash
# Banco
cd backend && npx prisma migrate deploy

# Terminal 1 — Backend
cd backend && npm run dev

# Terminal 2 — Frontend
npm run dev
```

Acesse: **http://localhost:5173**

---

## Login

Google OAuth 2.0. Apenas `@autoforce.com` tem acesso.  
Em desenvolvimento: botão "Entrar sem Google" disponível na tela de login.

---

## Automações

O sistema de automações permite criar jornadas visuais que executam ações automaticamente quando um lead satisfaz um gatilho.

**Gatilhos disponíveis:** lead criado, tag adicionada, status mudou, score atualizado, conversão recebida

**Blocos de ação:** Condição, Esperar, Ação interna, RD Station, WhatsApp, Pipedrive

**Motor de execução:**
- Execuções persistidas no banco (`AutomationExecution`)
- Bloco Esperar: pausa e retoma automaticamente via scheduler (60s)
- Guard de re-entrância: impede execuções duplicadas
- Monitoramento em tempo real com log por bloco

---

## Estrutura do projeto

```
autoforce-performance--1-/
├── App.tsx                          — roteamento principal e auth
├── components/                      — telas
│   ├── AutomationJourneysView.tsx   — editor de automações
│   ├── LeadHubView.tsx              — banco de leads
│   ├── LeadProfilePanel.tsx         — perfil 360° do lead
│   ├── ConnectionsView.tsx          — integrações
│   └── ...
├── services/
│   ├── apiClient.ts                 — HTTP client (httpOnly cookie)
│   └── dataService.ts               — métodos de API
├── types.ts                         — tipos TypeScript globais
├── tests/e2e/                       — testes Playwright
│
├── backend/
│   ├── src/
│   │   ├── server.ts                — Express + middleware
│   │   ├── routes/                  — rotas
│   │   ├── controllers/             — handlers HTTP
│   │   ├── services/                — lógica de negócio
│   │   │   ├── automation-engine.service.ts  — motor de execução
│   │   │   ├── lead-hub.service.ts           — gestão de leads
│   │   │   ├── pipedrive.service.ts          — Pipedrive API
│   │   │   └── ...
│   │   └── middleware/
│   └── prisma/
│       ├── schema.prisma            — modelos do banco
│       └── migrations/
│
├── API_DOC.md                       — referência completa da API
├── DOCUMENTACAO_COMPLETA.md         — documentação de todas as telas
└── README.md                        — este arquivo
```

---

## Testes

```bash
# Testes de API (roda contra Railway, sem frontend)
npm run test:e2e:api

# Setup de sessão (uma vez, faz login Google)
npm run test:e2e:setup

# Todos os testes E2E (precisa do frontend rodando)
npm run test:e2e

# Interface visual do Playwright
npm run test:e2e:ui

# Relatório HTML
npm run test:e2e:report
```

---

## Deploy (Railway)

Push para `main` triggera deploy automático.

**Start script:**
```bash
prisma migrate deploy && node dist/server.js
```

Migrations rodam automaticamente. Todas são aditivas.

---

## Segurança

- Autenticação via **httpOnly cookie** (`af_session`) — token não acessível ao JavaScript
- Tokens de terceiros criptografados com **AES-256-GCM** no banco
- **CSP**, `X-Frame-Options`, `X-Content-Type-Options` configurados no Vercel
- Rate limiting em todos os endpoints públicos e de autenticação
- Webhook Pipedrive autenticado via Basic Auth

---

## Comandos úteis

```bash
# Prisma
cd backend && npx prisma generate       # regenerar client
cd backend && npx prisma migrate dev    # nova migration (dev)
cd backend && npx prisma studio         # UI do banco

# TypeScript
cd backend && npx tsc --noEmit         # check backend
npx tsc --noEmit                        # check frontend

# Build
cd backend && npm run build
npm run build
```

---

*AutoForce Marketing Hub v2.1 — Junho 2026*
