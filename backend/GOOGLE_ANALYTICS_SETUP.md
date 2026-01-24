# 📊 Configuração do Google Analytics 4 API

## 🎯 Objetivo

Conectar o sistema com a Google Analytics 4 API para buscar dados reais de landing pages, tráfego e conversões.

---

## 📋 Pré-requisitos

1. Conta Google com acesso ao Google Analytics 4
2. Uma propriedade GA4 configurada
3. Acesso para criar credenciais de serviço

---

## 🔧 Passo a Passo

### 1. Criar Projeto no Google Cloud Console

1. Acesse: https://console.cloud.google.com/
2. Clique em **"Selecionar projeto"** → **"Novo Projeto"**
3. Nome: `autoforce-analytics` (ou outro nome)
4. Clique em **"Criar"**

### 2. Habilitar Google Analytics Data API

1. No menu lateral, vá em **"APIs e Serviços"** → **"Biblioteca"**
2. Procure por **"Google Analytics Data API"**
3. Clique em **"Habilitar"**

### 3. Criar Credenciais de Serviço

1. Vá em **"APIs e Serviços"** → **"Credenciais"**
2. Clique em **"Criar credenciais"** → **"Conta de serviço"**
3. Nome: `autoforce-ga4-service`
4. Clique em **"Criar e continuar"**
5. Role: **"Visualizador"** (ou "Editor" se precisar de mais permissões)
6. Clique em **"Concluído"**

### 4. Criar Chave JSON

1. Clique na conta de serviço criada
2. Vá na aba **"Chaves"**
3. Clique em **"Adicionar chave"** → **"Criar nova chave"**
4. Tipo: **JSON**
5. Clique em **"Criar"**
6. O arquivo JSON será baixado automaticamente

### 5. Adicionar Permissões no Google Analytics

1. Acesse: https://analytics.google.com/
2. Vá em **"Admin"** (ícone de engrenagem)
3. Na coluna **"Propriedade"**, clique em **"Acesso à propriedade"**
4. Clique em **"+"** → **"Adicionar usuários"**
5. Cole o **email da conta de serviço** (está no arquivo JSON baixado, campo `client_email`)
6. Permissão: **"Visualizador"**
7. Clique em **"Adicionar"**

### 6. Obter Property ID

1. No Google Analytics, vá em **"Admin"**
2. Na coluna **"Propriedade"**, clique em **"Detalhes da propriedade"**
3. Copie o **"ID da propriedade"** (formato: `123456789`)

### 7. Configurar no Backend

1. **Mova o arquivo JSON** para a pasta `backend/credentials/`:
   ```
   backend/
   └── credentials/
       └── ga4-credentials.json
   ```

2. **Adicione ao `.env` do backend**:
   ```env
   GA4_PROPERTY_ID=123456789
   GA4_CREDENTIALS_PATH=./credentials/ga4-credentials.json
   ```

3. **Adicione `credentials/` ao `.gitignore`**:
   ```
   credentials/
   *.json
   ```

---

## 🚀 Testar a Integração

### 1. Instalar Dependências

```bash
cd backend
npm install
```

### 2. Limpar Dados Fake

```bash
npm run prisma:clear
```

### 3. Sincronizar com GA4

```bash
# Via API
curl -X POST http://localhost:5000/api/analytics/sync-ga4

# Ou automaticamente ao buscar landing pages
curl http://localhost:5000/api/analytics/landing-pages
```

### 4. Verificar Dados

```bash
# Ver landing pages sincronizadas
curl http://localhost:5000/api/analytics/landing-pages
```

---

## 📊 O que é Sincronizado

A integração busca do GA4:

- ✅ **Page Path** - Caminho da página
- ✅ **Page Title** - Título da página
- ✅ **Screen Page Views** - Visualizações
- ✅ **Active Users** - Usuários únicos
- ✅ **Conversions** - Conversões
- ✅ **Average Session Duration** - Tempo médio de engajamento
- ✅ **Conversion Rate** - Taxa de conversão (calculada)

---

## 🔄 Sincronização Automática

A sincronização acontece automaticamente quando:

1. Você busca landing pages via API: `GET /api/analytics/landing-pages`
2. Os dados são atualizados do GA4 e salvos no banco
3. Próximas buscas retornam dados do banco (mais rápido)

### Sincronização Manual

Para forçar sincronização:

```bash
POST /api/analytics/sync-ga4
```

---

## 🛠️ Troubleshooting

### Erro: "GA4_CREDENTIALS_PATH não encontrado"

**Solução:**
- Verifique se o arquivo JSON está em `backend/credentials/ga4-credentials.json`
- Verifique o caminho no `.env`

### Erro: "Permission denied"

**Solução:**
- Verifique se adicionou o email da conta de serviço no GA4
- Verifique se a conta de serviço tem permissão de "Visualizador"

### Erro: "Property not found"

**Solução:**
- Verifique se o `GA4_PROPERTY_ID` está correto
- Verifique se a conta de serviço tem acesso à propriedade

### Dados não aparecem

**Solução:**
- Verifique se há landing pages no GA4 com `/lp` no caminho
- Ajuste o filtro em `googleAnalytics.service.ts` se necessário

---

## 📝 Personalizar Filtros

Para mudar quais páginas são buscadas, edite `backend/src/services/googleAnalytics.service.ts`:

```typescript
dimensionFilter: {
  filter: {
    fieldName: 'pagePath',
    stringFilter: {
      matchType: 'CONTAINS',
      value: '/lp', // Altere aqui para seu padrão
    },
  },
},
```

---

## ✅ Checklist

- [ ] Projeto criado no Google Cloud Console
- [ ] Google Analytics Data API habilitada
- [ ] Conta de serviço criada
- [ ] Chave JSON baixada
- [ ] Arquivo JSON movido para `backend/credentials/`
- [ ] Email da conta de serviço adicionado no GA4
- [ ] Property ID copiado
- [ ] `.env` configurado com `GA4_PROPERTY_ID` e `GA4_CREDENTIALS_PATH`
- [ ] Dependências instaladas (`npm install`)
- [ ] Dados fake limpos (`npm run prisma:clear`)
- [ ] Testado sincronização

---

## 🎉 Pronto!

Agora seus dados de landing pages vêm diretamente do Google Analytics 4! 🚀
