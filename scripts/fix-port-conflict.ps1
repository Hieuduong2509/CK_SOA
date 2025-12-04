# Script to fix port 443 conflict
# Usage: .\scripts\fix-port-conflict.ps1

Write-Host "Checking for port conflicts..." -ForegroundColor Cyan
Write-Host ""

# Check port 443
Write-Host "Checking port 443..." -ForegroundColor Yellow
$port443 = netstat -ano | findstr ":443" | findstr "LISTENING"
if ($port443) {
    Write-Host "Port 443 is in use:" -ForegroundColor Red
    Write-Host $port443 -ForegroundColor Gray
    Write-Host ""
    Write-Host "Solutions:" -ForegroundColor Yellow
    Write-Host "1. Stop the service using port 443" -ForegroundColor White
    Write-Host "2. Use HTTP only (port 80) for local development" -ForegroundColor White
    Write-Host "3. Change port 443 to another port (e.g., 8443)" -ForegroundColor White
    Write-Host ""
} else {
    Write-Host "Port 443 is available" -ForegroundColor Green
}

# Check port 80
Write-Host "Checking port 80..." -ForegroundColor Yellow
$port80 = netstat -ano | findstr ":80" | findstr "LISTENING"
if ($port80) {
    Write-Host "Port 80 is in use:" -ForegroundColor Red
    Write-Host $port80 -ForegroundColor Gray
    Write-Host ""
    Write-Host "Warning: Port 80 is required for the application!" -ForegroundColor Red
    Write-Host "Please stop the service using port 80 or change it." -ForegroundColor Yellow
} else {
    Write-Host "Port 80 is available" -ForegroundColor Green
}

Write-Host ""
Write-Host "Checking Docker containers..." -ForegroundColor Cyan
docker ps -a

Write-Host ""
Write-Host "To stop all containers:" -ForegroundColor Yellow
Write-Host "  docker-compose -f docker-compose.local.yml down" -ForegroundColor White
Write-Host ""
Write-Host "To remove all containers and start fresh:" -ForegroundColor Yellow
Write-Host "  docker-compose -f docker-compose.local.yml down -v" -ForegroundColor White

