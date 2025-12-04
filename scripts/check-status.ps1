# PowerShell script để kiểm tra status
# Usage: .\scripts\check-status.ps1

Write-Host "📊 Checking service status..." -ForegroundColor Cyan
Write-Host ""

# Check Docker
Write-Host "🐳 Docker containers:" -ForegroundColor Yellow
docker-compose -f docker-compose.local.yml ps
Write-Host ""

# Check Ngrok
$ngrokProcess = Get-Process ngrok -ErrorAction SilentlyContinue
if ($ngrokProcess) {
    Write-Host "🌐 Ngrok: ✅ Running (PID: $($ngrokProcess.Id))" -ForegroundColor Green
    Write-Host "💡 Check Ngrok web interface: http://127.0.0.1:4040" -ForegroundColor Gray
} else {
    Write-Host "🌐 Ngrok: ❌ Not running" -ForegroundColor Red
    Write-Host "💡 Start with: .\scripts\start-all.ps1" -ForegroundColor Gray
}

Write-Host ""

# Check ports
Write-Host "🔌 Port status:" -ForegroundColor Yellow
$port80 = Get-NetTCPConnection -LocalPort 80 -ErrorAction SilentlyContinue
$port443 = Get-NetTCPConnection -LocalPort 443 -ErrorAction SilentlyContinue

if ($port80) {
    Write-Host "   Port 80: ✅ In use" -ForegroundColor Green
} else {
    Write-Host "   Port 80: ❌ Not in use" -ForegroundColor Red
}

if ($port443) {
    Write-Host "   Port 443: ✅ In use" -ForegroundColor Green
} else {
    Write-Host "   Port 443: ❌ Not in use" -ForegroundColor Red
}

