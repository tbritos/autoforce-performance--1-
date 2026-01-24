# AutoForce Performance - Backend API

Backend REST API para o dashboard de performance da AutoForce.

## 🚀 Início Rápido

### 1. Instalar Dependências

```bash
npm install
```

### 2. Configurar Variáveis de Ambiente

Copie o arquivo `.env.example` para `.env` e configure:

```bash
cp .env.example .env
```

Edite o `.env` com suas configurações:
- `DATABASE_URL` - URL de conexão do PostgreSQL
- `JWT_SECRET` - Chave secreta para JWT
- `PORT` - Porta do servidor (padrão: 5000)

### 3. Configurar Banco de Dados

```bash
# Gerar cliente Prisma
npm run prisma:generate

# Criar migrações
npm run prisma:migrate

# (Opcional) Abrir Prisma Studio para visualizar dados
npm run prisma:studio
```

### 4. Iniciar Servidor

```bash
# Desenvolvimento
npm run dev

# Produção
npm run build
npm start
```

## 📚 Estrutura do Projeto

```
backend/
├── src/
│   ├── controllers/    # Controllers (lógica de requisições)
│   ├── services/       # Services (lógica de negócio)
│   ├── routes/         # Rotas da API
│   ├── middleware/     # Middlewares (auth, error handling)
│   ├── types/          # Tipos TypeScript
│   └── server.ts       # Ponto de entrada
├── prisma/
│   └── schema.prisma   # Schema do banco de dados
└── package.json
```

## 🔌 Endpoints

### Dashboard
- `GET /api/dashboard/metrics` - Métricas principais
- `GET /api/dashboard/history` - Histórico de performance

### Leads
- `GET /api/leads/daily` - Histórico diário
- `POST /api/leads/daily` - Criar entrada

### Revenue
- `GET /api/revenue/transactions` - Histórico de receita
- `POST /api/revenue/transactions` - Criar transação

### OKRs
- `GET /api/okrs` - Listar OKRs
- `POST /api/okrs` - Criar/atualizar OKR

### Team
- `GET /api/team` - Listar membros

### Analytics
- `GET /api/analytics/landing-pages` - Landing pages do GA4

## 🗄️ Banco de Dados

O projeto usa **PostgreSQL** com **Prisma ORM**.

### Modelos Principais:
- `User` - Usuários
- `DailyLead` - Leads diários
- `RevenueEntry` - Transações de receita
- `OKR` - Objetivos e resultados-chave
- `TeamMember` - Membros da equipe
- `LandingPage` - Dados de landing pages

## 🔐 Autenticação

(Em desenvolvimento) JWT será implementado para autenticação.

## 📝 Próximos Passos

1. ✅ Estrutura básica criada
2. ⏳ Configurar PostgreSQL
3. ⏳ Implementar autenticação JWT
4. ⏳ Conectar services com Prisma
5. ⏳ Integrar Google Analytics API
6. ⏳ Adicionar testes
7. ⏳ Deploy

## 🛠️ Tecnologias

- **Node.js** + **TypeScript**
- **Express** - Framework web
- **Prisma** - ORM
- **PostgreSQL** - Banco de dados
- **JWT** - Autenticação
- **Zod** - Validação de dados

## ✅ Endpoints adicionais

### Calendar
- `GET /api/calendar/events` - Listar eventos
- `POST /api/calendar/events` - Criar evento
- `PUT /api/calendar/events/:id` - Atualizar evento
- `DELETE /api/calendar/events/:id` - Remover evento

### Campaigns
- `GET /api/campaigns` - Listar campanhas
- `POST /api/campaigns` - Criar campanha
- `PUT /api/campaigns/:id` - Atualizar campanha
- `DELETE /api/campaigns/:id` - Remover campanha

### Assets
- `GET /api/assets` - Listar ativos
- `POST /api/assets` - Criar ativo
- `PUT /api/assets/:id` - Atualizar ativo
- `DELETE /api/assets/:id` - Remover ativo

### Emails
- `GET /api/emails/campaigns` - Listar campanhas de email
- `POST /api/emails/campaigns` - Criar campanha de email
- `PUT /api/emails/campaigns/:id` - Atualizar campanha de email
- `DELETE /api/emails/campaigns/:id` - Remover campanha de email

## 📌 Modelos adicionais
- `CampaignEvent` - Eventos do calendário
- `Campaign` - Campanhas (Meta/Google)
- `AssetItem` - Ativos (LP, criativo, copy, UTM)
- `EmailCampaign` - Campanhas de email

## 📦 Exemplos de Request

### Criar evento no calendário
`POST /api/calendar/events`
```json
{
  "title": "Campanha de Feirao",
  "startDate": "2026-02-01",
  "endDate": "2026-02-10",
  "color": "#2563eb",
  "notes": "Foco em SUVs"
}
```

### Criar campanha
`POST /api/campaigns`
```json
{
  "name": "Search AutoForce",
  "platform": "Google",
  "status": "Ativa",
  "budget": 6200,
  "startDate": "2026-02-01",
  "endDate": "2026-02-28",
  "kpi": "CPC R$ 3.10",
  "notes": "Palavras de marca"
}
```

### Criar ativo
`POST /api/assets`
```json
{
  "name": "LP Feirao SUVs",
  "category": "LP",
  "link": "https://autoforce.com.br/feirao-suv",
  "notes": "LP principal"
}
```

### Criar campanha de email
`POST /api/emails/campaigns`
```json
{
  "name": "Newsletter Fev",
  "date": "2026-02-05",
  "sends": 12000,
  "opens": 4200,
  "clicks": 980,
  "conversions": 120,
  "bounce": 35
}
```
