# Script para corrigir o problema do banco de dados
Write-Host "🔧 Corrigindo problema do banco de dados..." -ForegroundColor Yellow

# Parar e remover containers e volumes
Write-Host "`n🛑 Parando containers..." -ForegroundColor Cyan
docker-compose down -v

# Aguardar
Start-Sleep -Seconds 2

# Verificar/criar .env correto
Write-Host "`n📄 Verificando arquivo .env..." -ForegroundColor Cyan
$envContent = @"
# Server
PORT=5000
NODE_ENV=development

# Database - CORRIGIDO para autoforce_db
DATABASE_URL="postgresql://autoforce:autoforce123@localhost:5432/autoforce_db?schema=public"

# JWT
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRES_IN=7d

# CORS
CORS_ORIGIN=http://localhost:3000
"@

$envContent | Out-File -FilePath .env -Encoding utf8 -Force
Write-Host "✅ Arquivo .env atualizado!" -ForegroundColor Green

# Iniciar containers novamente
Write-Host "`n🚀 Iniciando PostgreSQL..." -ForegroundColor Cyan
docker-compose up -d

# Aguardar banco ficar pronto
Write-Host "`n⏳ Aguardando banco de dados inicializar..." -ForegroundColor Yellow
Start-Sleep -Seconds 8

# Verificar se está rodando
Write-Host "`n🔍 Verificando status..." -ForegroundColor Cyan
$status = docker ps --filter "name=autoforce-postgres" --format "{{.Status}}"
if ($status) {
    Write-Host "✅ Container rodando: $status" -ForegroundColor Green
    
    # Testar conexão
    Write-Host "`n🧪 Testando conexão com o banco..." -ForegroundColor Cyan
    $testResult = docker exec autoforce-postgres psql -U autoforce -d autoforce_db -c "SELECT version();" 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Banco de dados funcionando corretamente!" -ForegroundColor Green
        Write-Host "`n📦 Próximos passos:" -ForegroundColor Cyan
        Write-Host "   1. npm run prisma:generate" -ForegroundColor White
        Write-Host "   2. npm run prisma:migrate" -ForegroundColor White
        Write-Host "   3. npm run dev" -ForegroundColor White
    } else {
        Write-Host "⚠️  Ainda há problemas. Verifique os logs:" -ForegroundColor Yellow
        Write-Host "   docker-compose logs postgres" -ForegroundColor White
    }
} else {
    Write-Host "❌ Container não está rodando. Verifique os logs:" -ForegroundColor Red
    Write-Host "   docker-compose logs postgres" -ForegroundColor White
}

Write-Host "`n🎉 Processo concluído!" -ForegroundColor Green
