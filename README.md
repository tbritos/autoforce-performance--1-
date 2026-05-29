# AutoForce Marketing Hub

Sistema central de marketing da Autoforce — gestão de leads, campanhas, receita e integrações com Meta Ads, Google Ads, GA4, RD Station e Pipedrive.

---

## Início Rápido

### Pré-requisitos

- Node.js 20+
- PostgreSQL (local ou Railway)
- Arquivo `.env` configurado (ver seção abaixo)

---

### 1. Instalar dependências

```bash
# Frontend
npm install

# Backend
cd backend && npm install
```

### 2. Configurar variáveis de ambiente

Crie `backend/.env` com:

```env
DATABASE_URL=postgresql://usuario:senha@host:5432/banco
JWT_SECRET=um-segredo-longo-e-aleatorio
ENCRYPTION_KEY=chave-de-32-bytes-para-aes-256

# Google OAuth
GOOGLE_CLIENT_ID=SEU_CLIENT_ID.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=SEU_CLIENT_SECRET

# Meta Ads (opcional)
META_APP_ID=SEU_APP_ID
META_APP_SECRET=SEU_APP_SECRET

# RD Station (opcional)
RD_STATION_CLIENT_ID=SEU_CLIENT_ID
RD_STATION_CLIENT_SECRET=SEU_CLIENT_SECRET

# Pipedrive (opcional)
PIPEDRIVE_API_TOKEN=SEU_TOKEN
PIPEDRIVE_DOMAIN=suaempresa

# CORS
CORS_ORIGIN=http://localhost:5173
NODE_ENV=development
```

### 3. Rodar as migrations do banco

```bash
cd backend
npx prisma migrate deploy
```

### 4. Iniciar o sistema

```bash
# Terminal 1 — Backend
cd backend && npm run dev

# Terminal 2 — Frontend
npm run dev
```

Acesse: **http://localhost:5173**

---

## Login

O sistema usa **Google OAuth 2.0**. Apenas emails `@autoforce.com` têm acesso.

Em ambiente de desenvolvimento, use o bypass local se necessário.

---

## Deploy em Produção (Railway)

O deploy é feito via GitHub. O Railway conecta ao repositório e auto-deploys a cada push.

**Start script** (já configurado em `package.json`):
```bash
prisma migrate deploy && node dist/server.js
```

As migrations rodam automaticamente a cada deploy. Todas são aditivas — sem perda de dados.

**Variáveis de ambiente em produção:** configurar no painel do Railway (nunca commitar o `.env`).

---

## Estrutura do projeto

```
autoforce-performance--1-/
├── App.tsx                    — roteamento principal
├── components/                — todos os componentes de tela
│   ├── LeadHubView.tsx        — banco de leads
│   ├── LeadProfilePanel.tsx   — perfil do lead
│   ├── DocsView.tsx           — tela de documentação
│   └── ...
├── services/                  — chamadas à API
├── types.ts                   — tipos TypeScript globais
│
├── backend/
│   ├── src/
│   │   ├── server.ts          — entrada do Express
│   │   ├── routes/            — definição das rotas
│   │   ├── services/          — lógica de negócio
│   │   └── middleware/        — auth, erros
│   └── prisma/
│       ├── schema.prisma      — modelos do banco
│       └── migrations/        — histórico de migrations
│
├── SISTEMA_DOCUMENTACAO.md   — documentação do sistema (aba "Sistema" em /docs)
├── API_DOC.md                 — referência da API (aba "API" em /docs)
└── README.md                  — este arquivo (aba "Início rápido" em /docs)
```

---

## Comandos úteis

```bash
# Gerar Prisma Client após mudança no schema
cd backend && npx prisma generate

# Criar nova migration
cd backend && npx prisma migrate dev --name nome_da_migration

# Ver banco via Prisma Studio
cd backend && npx prisma studio

# Build de produção
cd backend && npm run build
npm run build
```

---

## Integrações por API

Use `Authorization: Bearer <JWT>` em todas as requisições.

Endpoints principais do Lead Hub (preferir rotas por `id`):

```
GET    /api/lead-hub/id/:id             — ficha completa do lead
PATCH  /api/lead-hub/id/:id             — atualizar dados
PATCH  /api/lead-hub/id/:id/status      — mudar etapa do funil
PATCH  /api/lead-hub/id/:id/custom-fields — salvar campos personalizados
POST   /api/lead-hub/id/:id/tags        — adicionar tag
```

Webhook público (sem autenticação):
```
POST   /api/webhooks/lead/:publicId     — receber lead de formulário externo
```

Ver documentação completa na aba **API** desta página.

---

*AutoForce Marketing Hub v2.0 — 2026*
