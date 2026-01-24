# ✅ Dados Reais - Setup Completo

## 🎉 O que foi feito:

### 1. ✅ Backend Conectado ao Banco Real
- **Prisma Client** configurado (`backend/src/config/database.ts`)
- **Todos os services** atualizados para usar dados reais do PostgreSQL
- **Cálculos dinâmicos** de métricas baseados nos dados do banco

### 2. ✅ Dados Mock Removidos
- **Frontend**: Removidos dados mock, agora usa apenas API
- **Backend**: Services calculam métricas a partir dos dados reais
- **Seed criado**: Banco populado com dados iniciais

### 3. ✅ Services Atualizados

#### Dashboard Service
- `getDashboardMetrics()`: Calcula métricas do mês atual vs anterior
- `getPerformanceHistory()`: Busca dados dos últimos 7 meses

#### Leads Service
- `getDailyLeads()`: Busca leads do banco
- `saveDailyLead()`: Salva/atualiza leads no banco

#### Revenue Service
- `getRevenueHistory()`: Busca receitas do banco
- `saveRevenueEntry()`: Salva receitas no banco

#### OKRs Service
- `getOKRs()`: Busca OKRs do banco
- `saveOKR()`: Salva/atualiza OKRs no banco

#### Team Service
- `getTeamMembers()`: Busca membros da equipe do banco

#### Analytics Service
- `getLandingPages()`: Busca landing pages do banco

---

## 🗄️ Dados Populados no Banco

O seed criou:

- ✅ **30 dias de leads** (últimos 30 dias)
- ✅ **4 transações de receita**
- ✅ **2 OKRs** (Q1 e Q2 2026)
- ✅ **4 membros da equipe**
- ✅ **5 landing pages**

---

## 🚀 Como Usar

### 1. Certifique-se de que o backend está rodando:

```powershell
cd backend
npm run dev
```

### 2. Se precisar popular dados novamente:

```powershell
cd backend
npm run prisma:seed
```

### 3. Visualizar dados no Prisma Studio:

```powershell
cd backend
npm run prisma:studio
```

Isso abre uma interface web em `http://localhost:5555` onde você pode:
- Ver todos os dados
- Editar dados
- Adicionar novos dados
- Deletar dados

### 4. Iniciar o frontend:

```powershell
npm run dev
```

---

## 📊 Como as Métricas São Calculadas

### Total de Leads
- Soma de todos os `mql` (Marketing Qualified Leads) do mês atual
- Comparado com o mês anterior para calcular mudança

### Taxa de Qualificação
- `(SQL / MQL) * 100` do mês atual
- Comparado com o mês anterior

### MRR Novo
- Soma de todos os `mrrValue` do mês atual
- Comparado com o mês anterior

### Vendas Realizadas
- Soma de todos os `sales` do mês atual
- Comparado com o mês anterior

### Histórico de Performance
- Agrupa dados por mês dos últimos 7 meses
- Calcula totais de leads, qualificados e vendas por mês

---

## 🔄 Adicionar Dados Reais

### Via Prisma Studio (Recomendado)

1. Execute: `cd backend && npm run prisma:studio`
2. Selecione a tabela (ex: `DailyLead`)
3. Clique em "Add record"
4. Preencha os dados
5. Salve

### Via API (Programaticamente)

```typescript
// Exemplo: Adicionar lead diário
await apiClient.post('/leads/daily', {
  date: '2025-01-22',
  mql: 25,
  sql: 18,
  sales: 5,
  conversionRate: 20.0
});
```

### Via Seed (Para dados iniciais)

Edite `backend/prisma/seed.ts` e execute:
```powershell
npm run prisma:seed
```

---

## 🧪 Testar

### 1. Verificar se API retorna dados:

```bash
# Métricas
curl http://localhost:5000/api/dashboard/metrics

# Histórico
curl http://localhost:5000/api/dashboard/history

# Leads
curl http://localhost:5000/api/leads/daily

# Receita
curl http://localhost:5000/api/revenue/transactions

# OKRs
curl http://localhost:5000/api/okrs

# Equipe
curl http://localhost:5000/api/team

# Landing Pages
curl http://localhost:5000/api/analytics/landing-pages
```

### 2. Verificar no Frontend:

1. Abra `http://localhost:3000`
2. Faça login
3. Veja o dashboard - deve mostrar dados reais do banco!

---

## 📝 Próximos Passos

1. ✅ Dados reais funcionando
2. ⏳ Conectar com fontes reais de dados:
   - Google Analytics API (para landing pages)
   - CRM (para leads e vendas)
   - Sistema financeiro (para receita)
3. ⏳ Adicionar autenticação JWT
4. ⏳ Implementar cache para performance
5. ⏳ Adicionar validação de dados

---

## 🐛 Troubleshooting

### API retorna arrays vazios

**Causa:** Banco não tem dados.

**Solução:**
```powershell
cd backend
npm run prisma:seed
```

### Erro ao calcular métricas

**Causa:** Pode não haver dados suficientes.

**Solução:** O sistema retorna valores 0 ou calcula com base nos dados disponíveis.

### Dados não aparecem no frontend

**Causa:** API não está rodando ou CORS.

**Solução:**
1. Verifique se backend está rodando: `http://localhost:5000/health`
2. Verifique console do navegador para erros
3. Verifique Network tab no DevTools

---

## ✅ Status Final

- ✅ Backend usando dados reais do PostgreSQL
- ✅ Frontend conectado à API
- ✅ Dados mock removidos
- ✅ Seed criado e executado
- ✅ Métricas calculadas dinamicamente
- ✅ Pronto para adicionar dados reais!

🎉 **Sistema totalmente funcional com dados reais!**
