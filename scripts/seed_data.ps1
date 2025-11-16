# PowerShell script để seed dữ liệu vào database
# Chạy: .\scripts\seed_data.ps1

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "SEED DỮ LIỆU FREELANCER" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Kiểm tra Docker đang chạy
Write-Host "1. Kiểm tra Docker containers..." -ForegroundColor Yellow
$containers = docker-compose ps --services
if ($LASTEXITCODE -ne 0) {
    Write-Host "✗ Lỗi: Không thể kiểm tra containers. Đảm bảo Docker đang chạy." -ForegroundColor Red
    exit 1
}

# Seed auth database
Write-Host ""
Write-Host "2. Seeding auth database (users)..." -ForegroundColor Yellow
docker-compose exec -T auth-service python /app/scripts/seed_data.py
if ($LASTEXITCODE -ne 0) {
    Write-Host "✗ Lỗi khi seed auth database" -ForegroundColor Red
    exit 1
}

# Seed main database
Write-Host ""
Write-Host "3. Seeding main database (profiles, packages, articles)..." -ForegroundColor Yellow
docker-compose exec -T user-service python /app/scripts/seed_data.py
if ($LASTEXITCODE -ne 0) {
    Write-Host "✗ Lỗi khi seed main database" -ForegroundColor Red
    exit 1
}

# Kiểm tra dữ liệu
Write-Host ""
Write-Host "4. Kiểm tra dữ liệu đã seed..." -ForegroundColor Yellow
docker-compose exec -T user-service python /app/scripts/check_data.py

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "✓ HOÀN TẤT SEED DỮ LIỆU!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Bây giờ bạn có thể:" -ForegroundColor Cyan
Write-Host "  - Mở http://localhost/ để xem trang chủ" -ForegroundColor White
Write-Host "  - Mở http://localhost/freelancers.html để xem tất cả freelancer" -ForegroundColor White
Write-Host "  - Mở http://localhost/api/v1/users?limit=100 để xem API" -ForegroundColor White
Write-Host ""

