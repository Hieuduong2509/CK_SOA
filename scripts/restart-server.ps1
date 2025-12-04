# Script to restart server (stop and start)
# Usage: .\scripts\restart-server.ps1

Write-Host "Stopping all containers..." -ForegroundColor Yellow
docker-compose -f docker-compose.local.yml down

Write-Host ""
Write-Host "Waiting 3 seconds..." -ForegroundColor Gray
Start-Sleep -Seconds 3

Write-Host ""
Write-Host "Starting containers..." -ForegroundColor Cyan
docker-compose -f docker-compose.local.yml up -d

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "Containers started successfully!" -ForegroundColor Green
    Write-Host "Waiting for services to be ready..." -ForegroundColor Yellow
    Start-Sleep -Seconds 5
    
    Write-Host ""
    Write-Host "Container status:" -ForegroundColor Cyan
    docker-compose -f docker-compose.local.yml ps
} else {
    Write-Host ""
    Write-Host "Failed to start containers!" -ForegroundColor Red
    exit 1
}

