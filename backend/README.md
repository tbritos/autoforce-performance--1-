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
