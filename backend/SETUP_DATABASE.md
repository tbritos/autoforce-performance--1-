# 🗄️ Configuração do Banco de Dados

## Opção 1: PostgreSQL Local

### 1. Instalar PostgreSQL

**Windows:**
- Baixar em: https://www.postgresql.org/download/windows/
- Ou usar Chocolatey: `choco install postgresql`

**Mac:**
```bash
brew install postgresql
brew services start postgresql
```

**Linux:**
```bash
sudo apt-get install postgresql postgresql-contrib
sudo systemctl start postgresql
```

### 2. Criar Banco de Dados

```bash
# Conectar ao PostgreSQL
psql -U postgres

# Criar banco de dados
CREATE DATABASE autoforce_db;

# Criar usuário (opcional)
CREATE USER autoforce_user WITH PASSWORD 'sua_senha_aqui';
GRANT ALL PRIVILEGES ON DATABASE autoforce_db TO autoforce_user;
```

### 3. Configurar .env

Crie o arquivo `.env` na pasta `backend/`:

```env
DATABASE_URL="postgresql://postgres:sua_senha@localhost:5432/autoforce_db?schema=public"
```

## Opção 2: Serviços Cloud (Recomendado para começar rápido)

### Supabase (Grátis)

1. Acesse: https://supabase.com
2. Crie uma conta e um novo projeto
3. Vá em Settings > Database
4. Copie a "Connection string" (URI)
5. Use no `.env`:

```env
DATABASE_URL="postgresql://postgres:[SUA-SENHA]@db.[SEU-PROJETO].supabase.co:5432/postgres"
```

### Railway (Grátis com limites)

1. Acesse: https://railway.app
2. Crie um novo projeto
3. Adicione PostgreSQL
4. Copie a DATABASE_URL fornecida

### Neon (Grátis)

1. Acesse: https://neon.tech
2. Crie uma conta
3. Crie um novo projeto
4. Copie a connection string

## Opção 3: Docker (Desenvolvimento Local)

### 1. Criar docker-compose.yml

```yaml
version: '3.8'
services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_USER: autoforce
      POSTGRES_PASSWORD: autoforce123
      POSTGRES_DB: autoforce_db
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

### 2. Iniciar

```bash
docker-compose up -d
```

### 3. Configurar .env

```env
DATABASE_URL="postgresql://autoforce:autoforce123@localhost:5432/autoforce_db?schema=public"
```

## ✅ Após Configurar

1. Crie o arquivo `.env` na pasta `backend/`
2. Adicione a `DATABASE_URL`
3. Execute:

```bash
cd backend
npm run prisma:generate
npm run prisma:migrate
```

## 🧪 Testar Conexão

```bash
cd backend
npx prisma db pull
```

Se funcionar, a conexão está OK!
