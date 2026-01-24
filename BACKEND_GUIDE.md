# 🚀 Guia de Implementação do Backend - AutoForce Performance

## 📋 Visão Geral

Atualmente o projeto usa **LocalStorage** para simular um banco de dados. Este guia mostra como implementar um backend real.

## 🏗️ Arquitetura Recomendada

### Opção 1: Node.js + Express + TypeScript + PostgreSQL (Recomendado)
- ✅ Mesma linguagem do frontend (TypeScript)
- ✅ Fácil integração
- ✅ Performance excelente
- ✅ Ecossistema maduro

### Opção 2: NestJS + PostgreSQL
- ✅ Framework mais estruturado
- ✅ Decorators e injeção de dependência
- ✅ Melhor para projetos grandes

### Opção 3: Python + FastAPI + PostgreSQL
- ✅ Boa para integrações com IA/ML
- ✅ Performance excelente
- ✅ Documentação automática

## 📦 Estrutura do Backend (Node.js/Express)

```
backend/
├── src/
│   ├── config/
│   │   ├── database.ts          # Configuração do PostgreSQL
│   │   └── env.ts               # Variáveis de ambiente
│   ├── controllers/
│   │   ├── dashboard.controller.ts
│   │   ├── leads.controller.ts
│   │   ├── revenue.controller.ts
│   │   ├── okrs.controller.ts
│   │   ├── team.controller.ts
│   │   └── analytics.controller.ts
│   ├── services/
│   │   ├── dashboard.service.ts
│   │   ├── leads.service.ts
│   │   └── ...
│   ├── models/
│   │   ├── Metric.ts
│   │   ├── Lead.ts
│   │   ├── Revenue.ts
│   │   └── ...
│   ├── routes/
│   │   ├── dashboard.routes.ts
│   │   ├── leads.routes.ts
│   │   └── ...
│   ├── middleware/
│   │   ├── auth.middleware.ts
│   │   └── error.middleware.ts
│   └── app.ts                   # Configuração do Express
├── prisma/
│   └── schema.prisma            # Schema do banco (Prisma ORM)
├── .env.example
├── package.json
└── tsconfig.json
```

## 🗄️ Schema do Banco de Dados (PostgreSQL)

### Tabelas Principais:

1. **users** - Usuários do sistema
2. **metrics** - Métricas do dashboard
3. **leads** - Histórico de leads diários
4. **revenue** - Transações de receita
5. **okrs** - Objetivos e resultados-chave
6. **team_members** - Membros da equipe
7. **landing_pages** - Dados do Google Analytics

## 🔌 Endpoints da API

### Dashboard
- `GET /api/dashboard/metrics` - Métricas principais
- `GET /api/dashboard/history` - Histórico de performance
- `GET /api/dashboard/landing-pages` - Landing pages do GA4

### Leads
- `GET /api/leads/daily` - Histórico diário de leads
- `POST /api/leads/daily` - Criar/atualizar entrada diária
- `GET /api/leads/:id` - Detalhes de um lead

### Revenue
- `GET /api/revenue/transactions` - Histórico de receita
- `POST /api/revenue/transactions` - Criar nova transação
- `GET /api/revenue/summary` - Resumo de receita

### OKRs
- `GET /api/okrs` - Listar OKRs
- `POST /api/okrs` - Criar/atualizar OKR
- `GET /api/okrs/:id` - Detalhes de um OKR

### Team
- `GET /api/team` - Listar membros da equipe
- `POST /api/team` - Adicionar membro
- `PUT /api/team/:id` - Atualizar membro

## 🔐 Autenticação

- JWT (JSON Web Tokens) para autenticação
- Middleware de autenticação em todas as rotas protegidas
- Refresh tokens para segurança

## 🔄 Integração com Frontend

1. Criar arquivo `.env.local` no frontend:
```
VITE_API_URL=http://localhost:5000/api
```

2. Atualizar `services/dataService.ts` para usar `fetch` ou `axios`

3. Adicionar interceptors para autenticação

## 📝 Próximos Passos

1. ✅ Estrutura básica criada (veja pasta `backend/`)
2. ⏳ Configurar banco de dados PostgreSQL
3. ⏳ Implementar autenticação JWT
4. ⏳ Criar endpoints da API
5. ⏳ Integrar com Google Analytics API
6. ⏳ Deploy (Heroku, Railway, ou AWS)

## 🚀 Comandos para Iniciar

```bash
# Instalar dependências
cd backend
npm install

# Configurar banco de dados
npx prisma migrate dev

# Iniciar servidor de desenvolvimento
npm run dev

# Build para produção
npm run build
```
