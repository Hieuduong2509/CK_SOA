# scripts/setup-ngrok.ps1

$ngrokPath = "ngrok.exe"

# Kiểm tra xem ngrok đã cài chưa
if (-not (Get-Command $ngrokPath -ErrorAction SilentlyContinue)) {
    Write-Host "Ngrok chua duoc cai dat hoac chua co trong PATH." -ForegroundColor Red
    Write-Host "Vui long cai dat Ngrok: choco install ngrok" -ForegroundColor Yellow
    exit 1
} else {
    Write-Host "Da tim thay Ngrok. Dang khoi dong..." -ForegroundColor Green
}

# Hỏi token nếu chưa có (Optional)
# $env:NGROK_AUTHTOKEN = Read-Host "Nhap Ngrok Authtoken (neu chua config)"

# Chạy Ngrok trỏ vào port 80 (Nginx)
Write-Host "Dang public port 80..." -ForegroundColor Cyan
ngrok http 80