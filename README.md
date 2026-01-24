<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# 🚀 AutoForce Performance Dashboard

Dashboard de performance para análise de métricas, leads, receita e OKRs.

## 📋 Pré-requisitos

- Node.js 18+ 
- npm ou yarn

## 🏃 Rodar Localmente

### Frontend

1. Instalar dependências:
   ```bash
   npm install
   ```

2. Iniciar servidor de desenvolvimento:
   ```bash
   npm run dev
   ```

3. Acessar: `http://localhost:3000`

### Backend (Opcional)

Veja a documentação completa em [`BACKEND_GUIDE.md`](./BACKEND_GUIDE.md) e [`backend/README.md`](./backend/README.md).

**Início rápido:**
```bash
cd backend
npm install
cp .env.example .env
# Configure o DATABASE_URL no .env
npm run prisma:generate
npm run prisma:migrate
npm run dev
```

## 📁 Estrutura do Projeto

```
autoforce-performance/
├── components/          # Componentes React
├── services/           # Serviços (dataService, etc)
├── types.ts           # Tipos TypeScript
├── backend/           # API Backend (Node.js + Express)
│   ├── src/
│   │   ├── controllers/
│   │   ├── services/
│   │   ├── routes/
│   │   └── server.ts
│   └── prisma/        # Schema do banco de dados
└── README.md
```

## 🔧 Tecnologias

**Frontend:**
- React 19 + TypeScript
- Vite
- Recharts (gráficos)
- Tailwind CSS
- Lucide Icons

**Backend:**
- Node.js + Express
- TypeScript
- Prisma ORM
- PostgreSQL

## 📚 Documentação

- [`BACKEND_GUIDE.md`](./BACKEND_GUIDE.md) - Guia completo do backend
- [`backend/README.md`](./backend/README.md) - Documentação da API
- [`backend/INTEGRATION.md`](./backend/INTEGRATION.md) - Como integrar frontend e backend
