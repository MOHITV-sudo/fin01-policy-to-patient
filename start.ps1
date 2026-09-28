Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "  FIN01 - Policy-to-Patient (HackMatrix 5.0 FIN-01)" -ForegroundColor Green
Write-Host "  Starting Backend (FastAPI) and Frontend (Vite + React)" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan

$baseDir = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "`n[1/3] Launching FastAPI Backend on http://127.0.0.1:8000..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$baseDir\backend'; python -m uvicorn main:app --host 127.0.0.1 --port 8000 --ws none"

Write-Host "[2/3] Launching Vite Frontend on http://127.0.0.1:5173..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$baseDir\frontend'; npm run dev -- --host 127.0.0.1 --port 5173"

Start-Sleep -Seconds 3

Write-Host "[3/3] Opening Browser at http://127.0.0.1:5173..." -ForegroundColor Green
Start-Process "http://127.0.0.1:5173"

Write-Host "`nBoth servers have been launched in separate windows!" -ForegroundColor Green
Write-Host "  Frontend: http://127.0.0.1:5173" -ForegroundColor White
Write-Host "  Backend Swagger Docs: http://127.0.0.1:8000/docs" -ForegroundColor White
