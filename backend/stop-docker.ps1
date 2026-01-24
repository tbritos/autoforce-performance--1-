# Script para parar o Docker
# Execute: .\stop-docker.ps1

Write-Host "🛑 Parando containers Docker..." -ForegroundColor Yellow

docker-compose down

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Containers parados com sucesso!" -ForegroundColor Green
} else {
    Write-Host "⚠️  Nenhum container rodando ou erro ao parar." -ForegroundColor Yellow
}
