# Script PowerShell para iniciar tudo automaticamente
# Execute: .\start-docker.ps1

Write-Host "🐳 Iniciando Docker Setup..." -ForegroundColor Cyan

# Verificar se Docker está instalado
Write-Host "`n📋 Verificando Docker..." -ForegroundColor Yellow
try {
    $dockerVersion = docker --version
    Write-Host "✅ Docker encontrado: $dockerVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Docker não encontrado!" -ForegroundColor Red
    Write-Host "📥 Por favor, instale o Docker Desktop:" -ForegroundColor Yellow
    Write-Host "   https://www.docker.com/products/docker-desktop/" -ForegroundColor Cyan
    exit 1
}

# Verificar se Docker está rodando
Write-Host "`n🔍 Verificando se Docker está rodando..." -ForegroundColor Yellow
try {
    docker ps | Out-Null
    Write-Host "✅ Docker está rodando!" -ForegroundColor Green
} catch {
    Write-Host "❌ Docker não está rodando!" -ForegroundColor Red
    Write-Host "🚀 Por favor, abra o Docker Desktop e aguarde até ficar verde." -ForegroundColor Yellow
    exit 1
}

# Verificar se .env existe
Write-Host "`n📄 Verificando arquivo .env..." -ForegroundColor Yellow
if (-not (Test-Path .env)) {
    Write-Host "⚠️  Arquivo .env não encontrado. Criando..." -ForegroundColor Yellow
    @"
DATABASE_URL="postgresql://autoforce:autoforce123@localhost:5432/autoforce_db?schema=public"
PORT=5000
NODE_ENV=development
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRES_IN=7d
CORS_ORIGIN=http://localhost:3000
"@ | Out-File -FilePath .env -Encoding utf8
    Write-Host "✅ Arquivo .env criado!" -ForegroundColor Green
} else {
    Write-Host "✅ Arquivo .env encontrado!" -ForegroundColor Green
}

# Iniciar containers
Write-Host "`n🚀 Iniciando PostgreSQL com Docker..." -ForegroundColor Yellow
docker-compose up -d

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ PostgreSQL iniciado com sucesso!" -ForegroundColor Green
    
    # Aguardar banco ficar pronto
    Write-Host "`n⏳ Aguardando banco de dados ficar pronto..." -ForegroundColor Yellow
    Start-Sleep -Seconds 5
    
    # Verificar se está rodando
    $containerStatus = docker ps --filter "name=autoforce-postgres" --format "{{.Status}}"
    if ($containerStatus) {
        Write-Host "✅ Container rodando: $containerStatus" -ForegroundColor Green
    }
    
    Write-Host "`n📦 Próximos passos:" -ForegroundColor Cyan
    Write-Host "   1. npm run prisma:generate" -ForegroundColor White
    Write-Host "   2. npm run prisma:migrate" -ForegroundColor White
    Write-Host "   3. npm run dev" -ForegroundColor White
    
} else {
    Write-Host "❌ Erro ao iniciar PostgreSQL!" -ForegroundColor Red
    Write-Host "💡 Verifique os logs: docker-compose logs postgres" -ForegroundColor Yellow
    exit 1
}

Write-Host "`n🎉 Setup concluído!" -ForegroundColor Green
