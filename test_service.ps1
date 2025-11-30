# Script PowerShell để kiểm tra services

Write-Host "=== Kiểm Tra Docker Services ===" -ForegroundColor Cyan
Write-Host ""

# 1. Kiểm tra Docker đang chạy
Write-Host "1. Kiểm tra Docker..." -ForegroundColor Yellow
try {
    docker ps > $null
    Write-Host "   ✓ Docker đang chạy" -ForegroundColor Green
} catch {
    Write-Host "   ✗ Docker không chạy! Mở Docker Desktop" -ForegroundColor Red
    exit
}

Write-Host ""

# 2. Kiểm tra containers
Write-Host "2. Kiểm tra containers..." -ForegroundColor Yellow
docker-compose ps

Write-Host ""

# 3. Kiểm tra port 8001
Write-Host "3. Kiểm tra port 8001..." -ForegroundColor Yellow
$port = netstat -ano | findstr :8001
if ($port) {
    Write-Host "   Port 8001 đang được sử dụng:" -ForegroundColor Yellow
    Write-Host $port
} else {
    Write-Host "   ✓ Port 8001 trống" -ForegroundColor Green
}

Write-Host ""

# 4. Kiểm tra logs auth-service
Write-Host "4. Logs gần nhất của auth-service:" -ForegroundColor Yellow
docker-compose logs --tail=20 auth-service

Write-Host ""

# 5. Test health endpoint
Write-Host "5. Test health endpoint..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:8001/health" -TimeoutSec 5 -UseBasicParsing
    Write-Host "   ✓ Health check OK:" -ForegroundColor Green
    Write-Host "   $($response.Content)" -ForegroundColor White
} catch {
    Write-Host "   ✗ Không thể kết nối đến http://localhost:8001/health" -ForegroundColor Red
    Write-Host "   Lỗi: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "=== Hoàn thành ===" -ForegroundColor Cyan

