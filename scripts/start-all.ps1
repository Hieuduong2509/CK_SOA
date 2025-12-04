# PowerShell script to start all (Docker + Ngrok)
# Usage: .\scripts\start-all.ps1

Write-Host "Starting CodeDesign Marketplace Server..." -ForegroundColor Green
Write-Host ""

# Check if Docker is running
Write-Host "Checking Docker..." -ForegroundColor Cyan
docker ps 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "Docker is not running!" -ForegroundColor Red
    Write-Host "Please start Docker Desktop first:" -ForegroundColor Yellow
    Write-Host "  1. Open Docker Desktop" -ForegroundColor White
    Write-Host "  2. Wait for it to fully start" -ForegroundColor White
    Write-Host "  3. Run this script again" -ForegroundColor White
    exit 1
}
Write-Host "Docker is running" -ForegroundColor Green
Write-Host ""

# Check if ngrok exists
$ngrokPath = Join-Path $PSScriptRoot "..\ngrok.exe"
if (-not (Test-Path $ngrokPath)) {
    # Try to find in PATH
    $ngrokInPath = Get-Command ngrok -ErrorAction SilentlyContinue
    if ($ngrokInPath) {
        $ngrokPath = $ngrokInPath.Source
    } else {
        Write-Host "ngrok.exe not found!" -ForegroundColor Red
        Write-Host "Please download ngrok.exe:" -ForegroundColor Yellow
        Write-Host "  1. Go to: https://ngrok.com/download" -ForegroundColor White
        Write-Host "  2. Download ngrok.exe for Windows" -ForegroundColor White
        Write-Host "  3. Place ngrok.exe in the project root folder" -ForegroundColor White
        exit 1
    }
}

# Check if Ngrok is already running
$ngrokProcess = Get-Process ngrok -ErrorAction SilentlyContinue
if ($ngrokProcess) {
    Write-Host "Ngrok is already running (PID: $($ngrokProcess.Id))" -ForegroundColor Yellow
    Write-Host "Check web interface: http://127.0.0.1:4040" -ForegroundColor Gray
    Write-Host ""
    $continue = Read-Host "Continue anyway? (y/n)"
    if ($continue -ne "y" -and $continue -ne "Y") {
        exit 0
    }
}

# Start Docker containers
Write-Host "Starting Docker containers..." -ForegroundColor Cyan
docker-compose -f docker-compose.local.yml up -d

if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to start Docker containers" -ForegroundColor Red
    exit 1
}

Write-Host "Docker containers started!" -ForegroundColor Green
Write-Host "Waiting for services to be ready..." -ForegroundColor Yellow
Start-Sleep -Seconds 8

# Check if containers are running
Write-Host ""
Write-Host "Container status:" -ForegroundColor Cyan
docker-compose -f docker-compose.local.yml ps
Write-Host ""

# Start Ngrok
Write-Host "Starting Ngrok tunnel..." -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Gray
Write-Host "Your public URL will be shown below:" -ForegroundColor Yellow
Write-Host "Look for the 'Forwarding' line (e.g., https://abc123.ngrok.io)" -ForegroundColor Gray
Write-Host "Press Ctrl+C to stop Ngrok (Docker will keep running)" -ForegroundColor Gray
Write-Host "============================================================" -ForegroundColor Gray
Write-Host ""

# Start Ngrok
& $ngrokPath http 80
