# PowerShell script để start tất cả (Docker + Ngrok)
# Usage: .\scripts\start-all.ps1
# Alias: .\scripts\start-server.ps1 (same script)

Write-Host "🚀 Starting CodeDesign Marketplace Server..." -ForegroundColor Green
Write-Host ""

# Check if Docker is running
$dockerRunning = docker ps 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Docker is not running. Please start Docker Desktop first." -ForegroundColor Red
    Write-Host "💡 Start Docker Desktop and try again." -ForegroundColor Yellow
    exit 1
}

# Check if ngrok exists
$ngrokPath = Join-Path $PSScriptRoot "..\ngrok.exe"
if (-not (Test-Path $ngrokPath)) {
    Write-Host "❌ ngrok.exe not found!" -ForegroundColor Red
    Write-Host "📥 Please download ngrok.exe and place it in the project root folder." -ForegroundColor Yellow
    Write-Host "   Download from: https://ngrok.com/download" -ForegroundColor Yellow
    exit 1
}

# Start Docker containers
Write-Host "🐳 Starting Docker containers..." -ForegroundColor Cyan
docker-compose -f docker-compose.local.yml up -d

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to start Docker containers" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Docker containers started!" -ForegroundColor Green
Write-Host "⏳ Waiting for services to be ready..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

# Check if containers are running
$containers = docker ps --format "{{.Names}}"
if ($containers -notmatch "nginx") {
    Write-Host "⚠️  Warning: Nginx container might not be running" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "🌐 Starting Ngrok tunnel..." -ForegroundColor Cyan
Write-Host "📋 Your public URL will be shown below:" -ForegroundColor Yellow
Write-Host "💡 Press Ctrl+C to stop Ngrok (Docker will keep running)" -ForegroundColor Gray
Write-Host ""

# Start Ngrok
& $ngrokPath http 80

