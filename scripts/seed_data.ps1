# PowerShell script để seed dữ liệu vào database
# Chạy: .\scripts\seed_data.ps1

Write-Host '========================================' -ForegroundColor Cyan
Write-Host 'SEED DU LIEU FREELANCER' -ForegroundColor Cyan
Write-Host '========================================' -ForegroundColor Cyan
Write-Host ''

# Kiểm tra Docker đang chạy
Write-Host '1. Kiem tra Docker containers...' -ForegroundColor Yellow
$containers = docker-compose -f docker-compose.local.yml ps --services
if ($LASTEXITCODE -ne 0) {
    Write-Host 'Loi: Khong the kiem tra containers. Dam bao Docker dang chay.' -ForegroundColor Red
    exit 1
}

# Seed auth database
Write-Host ''
Write-Host '2. Seeding auth database (users)...' -ForegroundColor Yellow
docker-compose -f docker-compose.local.yml exec -T auth-service python /app/scripts/seed_auth.py
if ($LASTEXITCODE -ne 0) {
    Write-Host 'Loi khi seed auth database' -ForegroundColor Red
    exit 1
}

# Seed main database
Write-Host ''
Write-Host '3. Seeding main database (profiles, packages, articles)...' -ForegroundColor Yellow
docker-compose -f docker-compose.local.yml exec -T user-service python /app/scripts/seed_user.py
if ($LASTEXITCODE -ne 0) {
    Write-Host 'Loi khi seed main database' -ForegroundColor Red
    exit 1
}

# Kiểm tra dữ liệu
Write-Host ''
Write-Host '4. Kiem tra du lieu da seed...' -ForegroundColor Yellow
docker-compose -f docker-compose.local.yml exec -T user-service python /app/scripts/check_data.py

Write-Host ''
Write-Host '========================================' -ForegroundColor Green
Write-Host 'HOAN TAT SEED DU LIEU!' -ForegroundColor Green
Write-Host '========================================' -ForegroundColor Green
Write-Host ''
Write-Host 'Bay gio ban co the:' -ForegroundColor Cyan
Write-Host '  - Mo http://localhost/ de xem trang chu' -ForegroundColor White
Write-Host '  - Mo http://localhost/freelancers.html de xem tat ca freelancer' -ForegroundColor White
Write-Host '  - Mo http://localhost/api/v1/users?limit=100 de xem API' -ForegroundColor White
Write-Host ''

