# PowerShell script để start Ngrok tunnel
# Usage: .\scripts\start-ngrok.ps1

Write-Host "🚀 Starting Ngrok tunnel..." -ForegroundColor Green

# Check if Docker is running
$dockerRunning = docker ps 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Docker is not running. Please start Docker Desktop first." -ForegroundColor Red
    exit 1
}

# Check if nginx container is running
$nginxRunning = docker ps --filter "name=nginx" --format "{{.Names}}"
if (-not $nginxRunning) {
    Write-Host "⚠️  Nginx container is not running. Starting Docker containers..." -ForegroundColor Yellow
    docker-compose -f docker-compose.local.yml up -d
    Start-Sleep -Seconds 5
}

# Check if ngrok exists
$ngrokPath = Join-Path $PSScriptRoot "..\ngrok.exe"
if (-not (Test-Path $ngrokPath)) {
    # Try to find in PATH
    $ngrokInPath = Get-Command ngrok -ErrorAction SilentlyContinue
    if ($ngrokInPath) {
        $ngrokPath = $ngrokInPath.Source
    } else {
        Write-Host "❌ ngrok.exe not found!" -ForegroundColor Red
        Write-Host "📥 Please download and place ngrok.exe in the project root folder" -ForegroundColor Yellow
        exit 1
    }
}

# Check if Ngrok is already running
$ngrokProcess = Get-Process ngrok -ErrorAction SilentlyContinue
if ($ngrokProcess) {
    Write-Host "⚠️  Ngrok is already running (PID: $($ngrokProcess.Id))" -ForegroundColor Yellow
    Write-Host "💡 Check web interface: http://127.0.0.1:4040" -ForegroundColor Gray
    Write-Host "💡 To stop: Stop-Process -Name ngrok -Force" -ForegroundColor Gray
    exit 0
}

# Start Ngrok
Write-Host "🌐 Starting Ngrok tunnel on port 80..." -ForegroundColor Cyan
Write-Host "📋 Your public URL will be shown below:" -ForegroundColor Yellow
Write-Host "💡 Press Ctrl+C to stop Ngrok" -ForegroundColor Gray
Write-Host ""

& $ngrokPath http 80

