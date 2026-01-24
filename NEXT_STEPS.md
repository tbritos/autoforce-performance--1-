# 🎯 Próximos Passos - AutoForce Performance

## ✅ Checklist do que fazer AGORA

### 📦 Passo 1: Instalar Docker Desktop (SE AINDA NÃO TEM)

1. **Baixe:** https://www.docker.com/products/docker-desktop/
2. **Instale** o arquivo `Docker Desktop Installer.exe`
3. **Reinicie** o computador
4. **Abra** o Docker Desktop
5. **Aguarde** até o ícone ficar verde na bandeja do sistema

⏱️ **Tempo:** ~10 minutos (primeira vez)

---

### 🔧 Passo 2: Instalar Dependências do Backend

Abra o PowerShell na pasta do projeto e execute:

```powershell
cd backend
npm install
```

⏱️ **Tempo:** ~2 minutos

---

### 🐳 Passo 3: Iniciar PostgreSQL com Docker

```powershell
cd backend
docker-compose up -d
```

**O que isso faz:**
- ✅ Baixa a imagem do PostgreSQL (primeira vez)
- ✅ Cria o container com o banco de dados
- ✅ Configura usuário e senha automaticamente

⏱️ **Tempo:** ~2 minutos (primeira vez), depois ~10 segundos

**Verificar se funcionou:**
```powershell
docker ps
```

Você deve ver o container `autoforce-postgres` rodando.

---

### 🗄️ Passo 4: Criar Tabelas no Banco

```powershell
cd backend

# Gerar cliente Prisma
npm run prisma:generate

# Criar tabelas (migração)
npm run prisma:migrate
```

Quando perguntar o nome da migração, digite: `init`

⏱️ **Tempo:** ~30 segundos

---

### 🚀 Passo 5: Iniciar o Servidor Backend

```powershell
cd backend
npm run dev
```

Você deve ver:
```
🚀 Server running on http://localhost:5000
📊 AutoForce Performance API
🌍 Environment: development
```

⏱️ **Tempo:** Imediato

---

### 🧪 Passo 6: Testar se Está Funcionando

Abra no navegador:
```
http://localhost:5000/health
```

Deve retornar:
```json
{
  "status": "ok",
  "message": "AutoForce Performance API is running"
}
```

Teste também:
```
http://localhost:5000/api/dashboard/metrics
```

---

## 🎯 Resumo Rápido (Copiar e Colar)

Se você já tem Docker instalado, execute tudo de uma vez:

```powershell
# 1. Ir para pasta backend
cd backend

# 2. Instalar dependências (se ainda não instalou)
npm install

# 3. Iniciar PostgreSQL
docker-compose up -d

# 4. Aguardar 5 segundos
Start-Sleep -Seconds 5

# 5. Criar tabelas
npm run prisma:generate
npm run prisma:migrate

# 6. Iniciar servidor
npm run dev
```

---

## 🆘 Se Der Erro

### Erro: "Docker não encontrado"
→ Instale o Docker Desktop primeiro (Passo 1)

### Erro: "Port 5432 already in use"
→ Você já tem PostgreSQL rodando. Pare o serviço ou mude a porta.

### Erro: "Cannot connect to Docker daemon"
→ Abra o Docker Desktop e aguarde ficar verde

### Erro: "prisma migrate dev" falha
→ Verifique se o Docker está rodando: `docker ps`

---

## 📋 Status Atual

Marque o que já fez:

- [ ] Docker Desktop instalado e rodando
- [ ] Dependências do backend instaladas (`npm install`)
- [ ] PostgreSQL iniciado (`docker-compose up -d`)
- [ ] Tabelas criadas (`npm run prisma:migrate`)
- [ ] Servidor rodando (`npm run dev`)
- [ ] Teste no navegador funcionando

---

## 🎉 Quando Tudo Estiver Funcionando

Você terá:
- ✅ Backend rodando em `http://localhost:5000`
- ✅ Banco de dados PostgreSQL funcionando
- ✅ Todas as tabelas criadas
- ✅ API pronta para receber requisições

**Próximo passo:** Integrar o frontend com o backend (veja `backend/INTEGRATION.md`)

---

## 💡 Dica

Use o script automático que criei:

```powershell
cd backend
.\start-docker.ps1
```

Ele faz tudo automaticamente! 🚀
