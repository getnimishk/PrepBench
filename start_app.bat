@echo off
setlocal enabledelayedexpansion
title PrepBench — Local Interview & Exam Prep Platform

echo ============================================================
echo   PrepBench — 100%% Offline Interview & Exam Prep Platform
echo   Starting Backend (FastAPI) and Frontend (Vite)...
echo ============================================================
echo.

set ROOT_DIR=%~dp0
set BACKEND_DIR=%ROOT_DIR%backend
set FRONTEND_DIR=%ROOT_DIR%frontend
set VENV_UVICORN=%BACKEND_DIR%\.venv\Scripts\uvicorn.exe

if not exist "%VENV_UVICORN%" (
    echo [Backend] Creating Python virtual environment...
    "C:\Users\Nimish Kanungo\AppData\Local\Programs\Python\Python313\python.exe" -m venv "%BACKEND_DIR%\.venv"
    "%BACKEND_DIR%\.venv\Scripts\pip.exe" install -r "%BACKEND_DIR%\requirements.txt" --trusted-host pypi.org --trusted-host pypi.python.org --trusted-host files.pythonhosted.org
)

echo [Backend] Launching FastAPI server on http://127.0.0.1:8000 (DEBUG mode)...
start "PrepBench Backend" /D "%BACKEND_DIR%" "%VENV_UVICORN%" app.main:app --host 127.0.0.1 --port 8000 --reload --reload-dir app --log-level debug

echo [Frontend] Launching Vite dev server on http://localhost:5173 ...
start "PrepBench Frontend" /D "%FRONTEND_DIR%" cmd /k "npm run dev"

echo.
echo ============================================================
echo   PrepBench is starting up!
echo   Web App:           http://localhost:5173
echo   API Documentation: http://localhost:8000/docs
echo ============================================================
echo.

echo [Wait] Waiting for backend to become ready...
set BACKEND_READY=0
for /L %%i in (1,1,30) do (
    curl -s -o nul -w "%%{http_code}" http://127.0.0.1:8000/ > "%TEMP%\prepbench_health.txt" 2>nul
    set /p HEALTH_CODE=<"%TEMP%\prepbench_health.txt"
    if "!HEALTH_CODE!"=="200" (
        set BACKEND_READY=1
        goto :backend_ready
    )
    ping -n 2 127.0.0.1 >nul
)
:backend_ready
if "%BACKEND_READY%"=="1" (
    echo [Wait] Backend is ready.
) else (
    echo [Wait] Backend did not respond in time; opening browser anyway. Use the Retry button if the dashboard fails to load.
)

start "" "http://localhost:5173"
