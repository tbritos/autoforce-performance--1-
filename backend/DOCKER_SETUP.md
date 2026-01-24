# 🐳 Guia Completo - Docker Setup

## 📋 Passo 1: Instalar Docker Desktop (Windows)

### Opção A: Download Direto (Recomendado)

1. **Baixe o Docker Desktop:**
   - Acesse: https://www.docker.com/products/docker-desktop/
   - Clique em "Download for Windows"
   - Baixe o arquivo `Docker Desktop Installer.exe`

2. **Instale:**
   - Execute o instalador
   - Marque "Use WSL 2 instead of Hyper-V" (recomendado)
   - Siga o assistente de instalação
   - **Reinicie o computador** quando solicitado

3. **Inicie o Docker Desktop:**
   - Procure "Docker Desktop" no menu Iniciar
   - Aguarde até ver o ícone da baleia na bandeja do sistema
   - Quando ficar verde, está pronto!

### Opção B: Via Winget (Mais Rápido)

```powershell
winget install Docker.DockerDesktop
```

Depois reinicie o computador.

### Opção C: Via Chocolatey

```powershell
choco install docker-desktop
```

---

## ✅ Passo 2: Verificar Instalação

Abra o PowerShell e execute:

```powershell
docker --version
docker-compose --version
```

Você deve ver algo como:
```
Docker version 24.0.0
Docker Compose version v2.20.0
```

---

## 🚀 Passo 3: Configurar o Projeto

### 1. Verificar arquivo `.env`

O arquivo `backend/.env` deve ter:

```env
DATABASE_URL="postgresql://autoforce:autoforce123@localhost:5432/autoforce_db?schema=public"
PORT=5000
NODE_ENV=development
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRES_IN=7d
CORS_ORIGIN=http://localhost:3000
```

### 2. Verificar `docker-compose.yml`

Já está criado! Está em `backend/docker-compose.yml`

---

## 🎯 Passo 4: Iniciar o Banco de Dados

### 1. Navegue até a pasta backend:

```powershell
cd backend
```

### 2. Inicie o PostgreSQL com Docker:

```powershell
docker-compose up -d
```

**O que isso faz:**
- ✅ Baixa a imagem do PostgreSQL (primeira vez pode demorar)
- ✅ Cria um container chamado `autoforce-postgres`
- ✅ Cria o banco `autoforce_db`
- ✅ Usuário: `autoforce` / Senha: `autoforce123`
- ✅ Expõe na porta `5432`

### 3. Verificar se está rodando:

```powershell
docker ps
```

Você deve ver algo como:
```
CONTAINER ID   IMAGE                 STATUS         PORTS                    NAMES
abc123def456   postgres:15-alpine    Up 2 minutes   0.0.0.0:5432->5432/tcp   autoforce-postgres
```

---

## 🗄️ Passo 5: Criar as Tabelas no Banco

### 1. Gerar o Prisma Client:

```powershell
npm run prisma:generate
```

### 2. Criar as migrações (tabelas):

```powershell
npm run prisma:migrate
```

Quando perguntar o nome da migração, digite:
```
init
```

Isso vai criar todas as tabelas:
- ✅ User
- ✅ DailyLead
- ✅ RevenueEntry
- ✅ OKR
- ✅ TeamMember
- ✅ LandingPage

---

## 🎉 Passo 6: Iniciar o Servidor Backend

```powershell
npm run dev
```

Você deve ver:
```
🚀 Server running on http://localhost:5000
📊 AutoForce Performance API
🌍 Environment: development
```

---

## 🧪 Passo 7: Testar

### Teste 1: Health Check

No navegador, acesse:
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

### Teste 2: Endpoint de Métricas

```
http://localhost:5000/api/dashboard/metrics
```

Deve retornar um array com as métricas.

---

## 🛠️ Comandos Úteis do Docker

### Ver logs do container:
```powershell
docker-compose logs -f postgres
```

### Parar o banco:
```powershell
docker-compose down
```

### Parar e remover volumes (apaga dados):
```powershell
docker-compose down -v
```

### Reiniciar o banco:
```powershell
docker-compose restart
```

### Ver status:
```powershell
docker-compose ps
```

### Entrar no banco (PostgreSQL CLI):
```powershell
docker exec -it autoforce-postgres psql -U autoforce -d autoforce_db
```

---

## 🔍 Troubleshooting

### Erro: "Cannot connect to Docker daemon"

**Solução:**
1. Abra o Docker Desktop
2. Aguarde até ficar verde
3. Tente novamente

### Erro: "Port 5432 is already in use"

**Solução:**
Você já tem PostgreSQL rodando. Opções:

1. **Parar o PostgreSQL local:**
   ```powershell
   # Windows Services
   services.msc
   # Procure "PostgreSQL" e pare o serviço
   ```

2. **Ou mudar a porta no docker-compose.yml:**
   ```yaml
   ports:
     - "5433:5432"  # Mude para 5433
   ```
   
   E atualize o `.env`:
   ```env
   DATABASE_URL="postgresql://autoforce:autoforce123@localhost:5433/autoforce_db?schema=public"
   ```

### Erro: "prisma migrate dev" falha

**Solução:**
1. Verifique se o Docker está rodando: `docker ps`
2. Verifique a `DATABASE_URL` no `.env`
3. Tente novamente: `npm run prisma:migrate`

### Container não inicia

**Solução:**
```powershell
# Ver logs
docker-compose logs postgres

# Recriar container
docker-compose down
docker-compose up -d
```

---

## 📊 Visualizar Dados no Banco

### Opção 1: Prisma Studio (Recomendado)

```powershell
npm run prisma:studio
```

Isso abre uma interface web em `http://localhost:5555` onde você pode ver e editar os dados.

### Opção 2: Docker Exec

```powershell
docker exec -it autoforce-postgres psql -U autoforce -d autoforce_db
```

Depois execute:
```sql
\dt                    -- Listar tabelas
SELECT * FROM "User";   -- Ver dados
\q                      -- Sair
```

### Opção 3: DBeaver ou pgAdmin

Conecte usando:
- Host: `localhost`
- Port: `5432`
- Database: `autoforce_db`
- User: `autoforce`
- Password: `autoforce123`

---

## 🎯 Checklist Completo

- [ ] Docker Desktop instalado
- [ ] Docker Desktop rodando (ícone verde)
- [ ] Arquivo `.env` configurado
- [ ] `docker-compose up -d` executado
- [ ] `docker ps` mostra o container
- [ ] `npm run prisma:generate` executado
- [ ] `npm run prisma:migrate` executado
- [ ] `npm run dev` iniciado
- [ ] `http://localhost:5000/health` funciona

---

## 🚀 Próximos Passos

Depois que tudo estiver funcionando:

1. **Integrar com Frontend:**
   - Veja `INTEGRATION.md`
   - Atualize `services/dataService.ts`

2. **Adicionar Autenticação:**
   - Implementar JWT
   - Proteger rotas

3. **Popular com Dados:**
   - Usar Prisma Studio
   - Ou criar seeds

---

## 💡 Dicas

- **Mantenha o Docker Desktop aberto** enquanto desenvolve
- **Use `docker-compose logs`** para debugar problemas
- **Backup:** Os dados ficam no volume `postgres_data`
- **Performance:** Docker usa menos recursos que PostgreSQL local

---

## ✅ Resumo dos Comandos

```powershell
# 1. Iniciar banco
cd backend
docker-compose up -d

# 2. Criar tabelas
npm run prisma:generate
npm run prisma:migrate

# 3. Iniciar servidor
npm run dev

# 4. Parar banco (quando terminar)
docker-compose down
```

🎉 **Pronto!** Seu backend está rodando com Docker!
