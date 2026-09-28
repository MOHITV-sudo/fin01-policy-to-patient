@echo off
echo ========================================================
echo   FIN01 - Policy-to-Patient (HackMatrix 5.0 FIN-01)
echo   Starting Backend (FastAPI) and Frontend (Vite + React)
echo ========================================================

cd /d "%~dp0"

echo [1/3] Launching FastAPI Backend on http://127.0.0.1:8000...
start "FIN01 Backend" cmd /k "cd backend && python -m uvicorn main:app --host 127.0.0.1 --port 8000 --ws none"

echo [2/3] Launching Vite Frontend on http://127.0.0.1:5173...
start "FIN01 Frontend" cmd /k "cd frontend && npm run dev -- --host 127.0.0.1 --port 5173"

timeout /t 3 /nobreak >nul

echo [3/3] Opening Browser...
start http://127.0.0.1:5173

echo.
echo Both servers are running! Keep the terminal windows open.
echo - Frontend: http://127.0.0.1:5173
echo - Backend API Docs: http://127.0.0.1:8000/docs
echo.
pause
