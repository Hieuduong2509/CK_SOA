# PowerShell script để stop tất cả
# Usage: .\scripts\stop-all.ps1

Write-Host "🛑 Stopping services..." -ForegroundColor Yellow

# Stop Ngrok (if running)
$ngrokProcess = Get-Process ngrok -ErrorAction SilentlyContinue
if ($ngrokProcess) {
    Write-Host "🛑 Stopping Ngrok..." -ForegroundColor Cyan
    Stop-Process -Name ngrok -Force -ErrorAction SilentlyContinue
    Write-Host "✅ Ngrok stopped" -ForegroundColor Green
}

# Stop Docker containers
Write-Host "🐳 Stopping Docker containers..." -ForegroundColor Cyan
docker-compose -f docker-compose.local.yml down

Write-Host ""
Write-Host "✅ All services stopped!" -ForegroundColor Green
Write-Host "💡 To start again, run: .\scripts\start-all.ps1" -ForegroundColor Gray

