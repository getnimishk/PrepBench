@echo off
setlocal enabledelayedexpansion

REM ==================================================================
REM  Self-elevate. If this is not already an administrator console,
REM  relaunch the same file through UAC and let this copy exit.
REM  fltmc is the cheapest admin probe that does not touch the network
REM  the way "net session" does.
REM ==================================================================
fltmc >nul 2>&1
if %errorlevel% NEQ 0 (
    echo Requesting administrator privileges...
    REM -ErrorAction Stop matters: a declined UAC prompt is a non-terminating
    REM error by default, which catch would never see, and this would report
    REM success while nothing had started.
    powershell -NoProfile -ExecutionPolicy Bypass -Command "try { Start-Process -FilePath '%~f0' -Verb RunAs -ErrorAction Stop } catch { exit 1 }"
    if errorlevel 1 (
        echo.
        echo Elevation was declined, so PrepBench did not start.
        echo.
        pause
    )
    exit /b
)

REM Elevation restarts the script in System32, so get back to the repo.
cd /d "%~dp0"

title PrepBench - Local Interview ^& Exam Prep Platform

set ROOT_DIR=%~dp0
set BACKEND_DIR=%ROOT_DIR%backend
set FRONTEND_DIR=%ROOT_DIR%frontend
set LOG_DIR=%ROOT_DIR%logs
set VENV_PYTHON=%BACKEND_DIR%\.venv\Scripts\python.exe
REM How many times to try starting the backend before giving up. See the note
REM above the retry loop for why more than one attempt is needed at all.
set BACKEND_MAX_TRIES=3
REM uvicorn.exe is no longer launched, but its presence is still the cheapest
REM proof that the dependencies were installed and not just the venv created.
set VENV_UVICORN=%BACKEND_DIR%\.venv\Scripts\uvicorn.exe
set BACKEND_URL=http://127.0.0.1:8000
set FRONTEND_URL=http://localhost:5173
set BACKEND_LOG=%LOG_DIR%\backend.out.log
set FRONTEND_LOG=%LOG_DIR%\frontend.out.log

if not exist "%LOG_DIR%" mkdir "%LOG_DIR%"

echo ============================================================
echo   PrepBench - 100%% Offline Interview ^& Exam Prep Platform
echo   Running as administrator. Everything stays in this window.
echo ============================================================
echo.

if not exist "%VENV_UVICORN%" call :build_venv
if not exist "%VENV_UVICORN%" exit /b 1

REM A port left held by a previous run is the usual reason a start "does
REM nothing" -- Vite now refuses to move to another port, so say who has it
REM instead of failing quietly.
call :free_port 8000 Backend
call :free_port 5173 Frontend

REM Both servers run as background children of THIS console -- no /K, no
REM second window. Their output goes to the log files so this window stays
REM readable; the tail is printed here if either one fails to come up.
REM Invoked as `python -m uvicorn`, not via uvicorn.exe. That .exe is a shim
REM with the interpreter's absolute path compiled into it, and resolving that
REM path is a second thing that can fail -- it did once here, reporting "did
REM not find executable at ...python.exe" while the interpreter was present and
REM working, most likely scanned by antivirus at the moment of launch. Calling
REM python directly removes the indirection entirely.
echo [Frontend] Starting Vite on %FRONTEND_URL% ...
start "" /B /D "%FRONTEND_DIR%" cmd /c "npm run dev > "%FRONTEND_LOG%" 2>&1"

REM The backend is started with retries, and this is why:
REM
REM On Windows a venv's python.exe is always a launcher -- it reads `home` from
REM pyvenv.cfg and executes the interpreter living there. There is no venv
REM layout that avoids it; --copies does not, and neither does calling python
REM instead of uvicorn.exe. So starting the backend always means executing a
REM binary outside this project.
REM
REM With real-time antivirus running, that execution can be blocked for a moment
REM while the file is scanned, and Windows reports it as "did not find
REM executable at ...python.exe: The system cannot find the path specified" --
REM which reads like a missing interpreter but is a locked one. It is transient:
REM the same binary runs fine seconds later, and 25 sequential plus 12
REM concurrent launches showed no failures at all when the scanner was idle.
REM
REM A retry turns that into a slower start instead of a dead backend. It is
REM mitigation, not a cure: the cure is excluding the interpreter's directory in
REM the antivirus, which no script can do for you.
set BACKEND_READY=0
set BACKEND_ATTEMPT=0

:backend_try
set /a BACKEND_ATTEMPT+=1
if %BACKEND_ATTEMPT% EQU 1 (
    echo [Backend] Starting FastAPI on %BACKEND_URL% ...
) else (
    echo [Backend] Did not answer. Retry %BACKEND_ATTEMPT% of %BACKEND_MAX_TRIES%...
)
start "" /B /D "%BACKEND_DIR%" cmd /c ""%VENV_PYTHON%" -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload --reload-dir app --log-level debug > "%BACKEND_LOG%" 2>&1"

call :wait_for "%BACKEND_URL%/" 20
set BACKEND_READY=%READY%
if "%BACKEND_READY%"=="1" goto :backend_ready
if %BACKEND_ATTEMPT% LSS %BACKEND_MAX_TRIES% goto :backend_try
:backend_ready

echo.
echo [Wait] Waiting for the frontend to answer...
call :wait_for "%FRONTEND_URL%/" 40
set FRONTEND_READY=%READY%

echo.
echo ============================================================
if "%BACKEND_READY%"=="1" (
    echo   Backend  : READY            %BACKEND_URL%
) else (
    echo   Backend  : FAILED TO START
)
if "%FRONTEND_READY%"=="1" (
    echo   Frontend : READY            %FRONTEND_URL%
) else (
    echo   Frontend : FAILED TO START
)
echo   API docs : %BACKEND_URL%/docs
echo   Logs     : %LOG_DIR%
echo ============================================================
echo.

if not "%BACKEND_READY%"=="1" call :show_tail "%BACKEND_LOG%" Backend
if not "%FRONTEND_READY%"=="1" call :show_tail "%FRONTEND_LOG%" Frontend

if not "%FRONTEND_READY%"=="1" (
    echo [Stop] Not opening a browser -- the page would only fail to load.
    echo.
    pause
    call :stop_all
    exit /b 1
)

if not "%BACKEND_READY%"=="1" (
    echo [Warn] Opening the app anyway, but the dashboard will show a load
    echo        error until the backend is up. Use its Retry button.
    echo.
)

REM explorer hands the URL to the normal, non-elevated default browser.
REM Launching it directly from this admin console would open the browser
REM elevated too, which Chrome in particular refuses to do cleanly.
start "" explorer "%FRONTEND_URL%"

echo   PrepBench is running. This window is the whole app.
echo.
echo   Press any key to stop the backend and frontend and exit.
pause >nul

call :stop_all
echo   Stopped.
exit /b 0


REM ==================================================================
REM  Subroutines
REM ==================================================================

:build_venv
REM Rebuilds the backend environment the same way it was actually created.
REM This used to invoke a hardcoded Python 3.13 path that does not exist on
REM this machine, so the one moment it mattered -- a missing .venv -- it would
REM have failed with "is not recognized" and no hint of what to do.
echo [Setup] The backend virtual environment is missing. Building it...
REM
REM The venv is built with the `py` launcher against an installed Python, NOT
REM with `uv venv --python 3.13`. uv would download and use its own managed
REM interpreter under AppData\Roaming\uv, and a venv built on that records a
REM `home` pointing there -- which is only resolvable by whatever process
REM installed it. This project already lost an evening to exactly that: the
REM backend reported "did not find executable at ...python.exe" on every launch
REM while the interpreter was demonstrably present, because it was present for
REM one process and not the other.
py -3 -m venv "%BACKEND_DIR%\.venv"
if not exist "%BACKEND_DIR%\.venv\Scripts\python.exe" (
    echo.
    echo [Setup] FAILED: no usable Python found via the py launcher.
    echo         Install Python 3.14 from https://www.python.org/downloads/
    echo         and tick "Add python.exe to PATH", then run this again.
    echo.
    pause
    goto :eof
)
REM uv is used only to install, for --system-certs: it makes uv trust the
REM Windows certificate store, without which antivirus that intercepts TLS
REM fails every download with a certificate error. pip is the fallback.
where uv >nul 2>&1
if errorlevel 1 (
    "%BACKEND_DIR%\.venv\Scripts\python.exe" -m pip install -r "%BACKEND_DIR%\requirements.lock"
) else (
    uv pip install --system-certs --python "%BACKEND_DIR%\.venv\Scripts\python.exe" -r "%BACKEND_DIR%\requirements.lock"
)
if not exist "%VENV_UVICORN%" (
    echo.
    echo [Setup] FAILED: the environment did not build. Read the errors above.
    echo.
    pause
)
goto :eof

:wait_for
REM %1 = url, %2 = attempts. Sets READY to 1 or 0.
set READY=0
for /L %%i in (1,1,%~2) do (
    curl -s -o nul -w "%%{http_code}" %~1 > "%TEMP%\prepbench_health.txt" 2>nul
    set /p HEALTH_CODE=<"%TEMP%\prepbench_health.txt"
    if "!HEALTH_CODE!"=="200" (
        set READY=1
        goto :eof
    )
    ping -n 2 127.0.0.1 >nul
)
goto :eof

:free_port
REM %1 = port, %2 = label. Offers to stop whatever already holds the port.
REM
REM The lookup deliberately contains no pipe. Inside for /f, a ^| that sits
REM within double quotes is handed to the child *still escaped*, so PowerShell
REM receives a syntax error and the holder silently reads as "none" -- the
REM lookup appears to work while never finding anything. Writing to a file and
REM reading it back keeps every special character on a plain line, where cmd
REM quoting behaves.
set PORT_HOLDER=
set HOLDER_PID=
set HOLDER_NAME=
powershell -NoProfile -Command "$c = @(Get-NetTCPConnection -State Listen -LocalPort %~1 -EA SilentlyContinue); if ($c.Count -gt 0) { $id = $c[0].OwningProcess; $nm = (Get-Process -Id $id -EA SilentlyContinue).ProcessName; Write-Output ($id.ToString() + ' ' + $nm) }" > "%TEMP%\pb_port.txt" 2>nul
set /p PORT_HOLDER=<"%TEMP%\pb_port.txt"
if "!PORT_HOLDER!"=="" goto :eof
for /f "tokens=1,2" %%a in ("!PORT_HOLDER!") do set HOLDER_PID=%%a& set HOLDER_NAME=%%b
echo [Port] %~2 port %~1 is already held by !HOLDER_NAME! ^(PID !HOLDER_PID!^).
choice /C YN /N /M "       Stop it and continue? [Y/N] "
if errorlevel 2 (
    echo        Left alone -- %~2 will not be able to start.
    goto :eof
)
REM Kill one level up when the listener's parent is a reloader: uvicorn
REM --reload puts the socket in a child, so killing only the child gets it
REM instantly respawned and the port never actually frees.
REM Direct taskkill, matching :stop_all. This routine runs before any server
REM is started, so it cannot hit the handle-inheritance hang that Start-Process
REM -Wait caused there -- but depending on that ordering staying true is a poor
REM reason to keep two different spellings of the same operation.
powershell -NoProfile -Command "$id = !HOLDER_PID!; $t = $id; $p = Get-CimInstance Win32_Process -Filter ('ProcessId=' + $id) -EA SilentlyContinue; if ($p) { $par = Get-CimInstance Win32_Process -Filter ('ProcessId=' + $p.ParentProcessId) -EA SilentlyContinue; if ($par -and $par.Name -match 'python|uvicorn') { $t = $par.ProcessId } }; taskkill /PID $t /T /F | Out-Null" >nul 2>&1
echo        Stopped PID !HOLDER_PID!.
goto :eof

:show_tail
REM %1 = log file, %2 = label. Shows why a server did not come up.
echo ---- last lines of %~2 log ----
powershell -NoProfile -Command "if (Test-Path '%~1') { Get-Content '%~1' -Tail 15 } else { 'No log was written.' }"
echo -------------------------------
echo.
goto :eof

:stop_all
REM Stops whatever is listening on our two ports. Uses the same one-level
REM parent walk as :free_port: uvicorn --reload holds the socket in a child of
REM another uvicorn process, so killing only the listener leaves a supervisor
REM alive that puts the port straight back.
echo   Stopping PrepBench...
REM taskkill is invoked directly rather than through Start-Process -Wait. The
REM servers run as `start /B` children sharing this console with their output
REM redirected, and Start-Process -Wait inherits those handles -- it then blocks
REM waiting on pipes the dying process still owns, so "press any key to stop"
REM never returned.
powershell -NoProfile -Command "$ids = @(Get-NetTCPConnection -State Listen -LocalPort 8000,5173 -EA SilentlyContinue | Select-Object -Expand OwningProcess -Unique); foreach ($id in $ids) { $t = $id; $p = Get-CimInstance Win32_Process -Filter ('ProcessId=' + $id) -EA SilentlyContinue; if ($p) { $par = Get-CimInstance Win32_Process -Filter ('ProcessId=' + $p.ParentProcessId) -EA SilentlyContinue; if ($par -and $par.Name -match 'python|uvicorn') { $t = $par.ProcessId } }; taskkill /PID $t /T /F | Out-Null }" >nul 2>&1
goto :eof
