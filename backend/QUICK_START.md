# ⚡ Início Rápido - Backend

## 🚀 Opção Mais Rápida: Docker

### 1. Iniciar PostgreSQL com Docker

```bash
cd backend
docker-compose up -d
```

Isso vai:
- ✅ Criar um container PostgreSQL
- ✅ Criar o banco `autoforce_db`
- ✅ Usuário: `autoforce` / Senha: `autoforce123`
- ✅ Porta: `5432`

### 2. Verificar se está rodando

```bash
docker ps
```

Você deve ver o container `autoforce-postgres` rodando.

### 3. O arquivo .env já está configurado!

O `.env` já tem a configuração para o Docker. Se não tiver, crie:

```env
DATABASE_URL="postgresql://autoforce:autoforce123@localhost:5432/autoforce_db?schema=public"
```

### 4. Criar as tabelas no banco

```bash
npm run prisma:migrate
```

Quando perguntar o nome da migração, digite: `init`

### 5. Iniciar o servidor

```bash
npm run dev
```

✅ Pronto! O backend está rodando em `http://localhost:5000`

## 🧪 Testar

```bash
# Health check
curl http://localhost:5000/health

# Ou no navegador
# http://localhost:5000/health
```

## 🛑 Parar o Docker

```bash
docker-compose down
```

## 📝 Outras Opções

Se não quiser usar Docker, veja [`SETUP_DATABASE.md`](./SETUP_DATABASE.md) para outras opções:
- PostgreSQL local
- Supabase (cloud grátis)
- Railway
- Neon
