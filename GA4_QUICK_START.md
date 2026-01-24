# 🚀 Google Analytics 4 - Início Rápido

## ✅ O que foi feito:

1. ✅ **Dados fake removidos** do banco
2. ✅ **Integração com GA4 API** criada
3. ✅ **Biblioteca googleapis** instalada
4. ✅ **Service de sincronização** implementado

---

## 📋 Passo a Passo Rápido (5 minutos)

### 1. Criar Credenciais no Google Cloud

1. Acesse: https://console.cloud.google.com/
2. Crie um projeto (ou use existente)
3. Vá em **"APIs e Serviços"** → **"Biblioteca"**
4. Procure **"Google Analytics Data API"** → **"Habilitar"**
5. Vá em **"Credenciais"** → **"Criar credenciais"** → **"Conta de serviço"**
6. Nome: `autoforce-ga4`
7. Role: **"Visualizador"**
8. Na conta criada, vá em **"Chaves"** → **"Adicionar chave"** → **"JSON"**
9. **Baixe o arquivo JSON**

### 2. Adicionar Permissões no GA4

1. Acesse: https://analytics.google.com/
2. **Admin** → **"Acesso à propriedade"** → **"+"**
3. Cole o **email da conta de serviço** (está no JSON, campo `client_email`)
4. Permissão: **"Visualizador"**

### 3. Obter Property ID

1. No GA4: **Admin** → **"Detalhes da propriedade"**
2. Copie o **"ID da propriedade"** (ex: `123456789`)

### 4. Configurar no Backend

1. **Mova o JSON** para: `backend/credentials/ga4-credentials.json`

2. **Edite `backend/.env`** e adicione:
   ```env
   GA4_PROPERTY_ID=123456789
   GA4_CREDENTIALS_PATH=./credentials/ga4-credentials.json
   ```

3. **Reinicie o backend:**
   ```bash
   cd backend
   npm run dev
   ```

### 5. Testar

```bash
# Sincronizar com GA4
curl -X POST http://localhost:5000/api/analytics/sync-ga4

# Ver landing pages
curl http://localhost:5000/api/analytics/landing-pages
```

---

## 🎯 Pronto!

Agora os dados vêm diretamente do Google Analytics 4! 🎉

---

## 📚 Documentação Completa

Veja: `backend/GOOGLE_ANALYTICS_SETUP.md` para guia detalhado.
