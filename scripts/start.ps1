# AegisOps startup script for Windows PowerShell
# Usage: .\scripts\start.ps1

Write-Host "Starting AegisOps..." -ForegroundColor Cyan

# Check .env exists
if (-not (Test-Path "$PSScriptRoot\..\.env")) {
    if (Test-Path "$PSScriptRoot\..\.env.example") {
        Copy-Item "$PSScriptRoot\..\.env.example" "$PSScriptRoot\..\.env"
        Write-Host ".env created from .env.example - please add your GEMINI_API_KEY!" -ForegroundColor Yellow
    }
}

# 1. Start Kartify
Write-Host "[1/4] Starting Kartify on port 4000..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\..\kartify'; node server/server.js" -WindowStyle Normal

Start-Sleep -Seconds 2

# 2. Start AegisOps Backend
Write-Host "[2/4] Starting FastAPI backend on port 8000..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\..\backend'; python -m uvicorn app.main:app --port 8000 --reload" -WindowStyle Normal

Start-Sleep -Seconds 3

# 3. Start React Dashboard
Write-Host "[3/4] Starting React dashboard on port 5173..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\..\frontend'; npm run dev" -WindowStyle Normal

Write-Host ""
Write-Host "AegisOps is starting up!" -ForegroundColor Cyan
Write-Host "  Kartify:   http://localhost:4000" -ForegroundColor White
Write-Host "  Backend:   http://localhost:8000/docs" -ForegroundColor White
Write-Host "  Dashboard: http://localhost:5173" -ForegroundColor White
Write-Host ""
Write-Host "Click [Simulate Incident] in the dashboard to start a demo!" -ForegroundColor Yellow
