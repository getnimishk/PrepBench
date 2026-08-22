#!/usr/bin/env bash
# Starts PrepBench: FastAPI on :8000 and Vite on :5173, both in this terminal.
#
# Deliberately does NOT run under sudo. These are dev servers on unprivileged
# ports; the Windows launcher elevates because it was asked to, but on Unix
# running npm as root leaves root-owned files in node_modules and buys nothing.
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/backend"
FRONTEND_DIR="$SCRIPT_DIR/frontend"
LOG_DIR="$SCRIPT_DIR/logs"
VENV_DIR="$BACKEND_DIR/.venv"
BACKEND_URL="http://127.0.0.1:8000"
FRONTEND_URL="http://localhost:5173"

mkdir -p "$LOG_DIR"

echo "============================================================"
echo "  PrepBench - 100% Offline Interview & Exam Prep Platform"
echo "============================================================"
echo

# Deliberately no log cleanup here. This used to run
#   rm -rf logs/* backend/logs/*
# on every start, which threw away the only record of what the previous run
# did. The first time that mattered, the backend had died hours earlier and its
# log was the evidence of when and why. Logs are gitignored and small; keep them.

# ---- Backend environment -------------------------------------------------
if [ ! -x "$VENV_DIR/bin/uvicorn" ]; then
    echo "[Setup] Backend virtual environment is missing. Building it..."
    if command -v uv >/dev/null 2>&1; then
        uv venv --python 3.13 "$VENV_DIR"
        uv pip install --python "$VENV_DIR/bin/python" -r "$BACKEND_DIR/requirements-dev.txt"
    elif command -v python3 >/dev/null 2>&1; then
        python3 -m venv "$VENV_DIR"
        "$VENV_DIR/bin/python" -m pip install -r "$BACKEND_DIR/requirements-dev.txt"
    else
        echo "[Setup] FAILED: neither uv nor python3 is available." >&2
        exit 1
    fi
fi

# Dependencies are NOT reinstalled on every start any more. It ran a full
# pip install each time, which cost seconds on a good day and failed outright
# on a uv-built venv, because those have no pip inside them.

# lsof is not guaranteed to be installed; without it we simply skip the check
# rather than failing the whole start over a diagnostic nicety.
port_holder() {
    command -v lsof >/dev/null 2>&1 || return 0
    lsof -ti tcp:"$1" -sTCP:LISTEN 2>/dev/null | head -n 1
}

for port_and_name in "8000:Backend" "5173:Frontend"; do
    port="${port_and_name%%:*}"
    name="${port_and_name##*:}"
    holder="$(port_holder "$port")"
    if [ -n "$holder" ]; then
        echo "[Port] $name port $port is already held by PID $holder ($(ps -p "$holder" -o comm= 2>/dev/null))."
        printf '       Stop it and continue? [y/N] '
        # Pre-set because `set -u` is on and a non-interactive stdin makes read
        # return without necessarily assigning.
        reply=""
        read -r reply || true
        case "$reply" in
            [Yy]*) kill -9 "$holder" 2>/dev/null; sleep 1; echo "       Stopped $holder." ;;
            *)     echo "       Left alone -- $name will not be able to start." ;;
        esac
    fi
done

# ---- Start both ----------------------------------------------------------
# `exec` matters here: without it the subshell stays alive as the parent of the
# real server, $! is the subshell's pid, and the cleanup trap kills the wrapper
# while leaving uvicorn and vite running and still holding their ports.
echo "[Backend] Starting FastAPI on $BACKEND_URL ..."
( cd "$BACKEND_DIR" && exec "$VENV_DIR/bin/uvicorn" app.main:app \
    --host 127.0.0.1 --port 8000 --reload --reload-dir app \
    > "$LOG_DIR/backend.out.log" 2>&1 ) &
BACKEND_PID=$!

echo "[Frontend] Starting Vite on $FRONTEND_URL ..."
( cd "$FRONTEND_DIR" && exec npm run dev > "$LOG_DIR/frontend.out.log" 2>&1 ) &
FRONTEND_PID=$!

cleanup() {
    echo
    echo "  Stopping PrepBench..."
    kill "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null
    wait "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null
}
trap cleanup EXIT INT TERM

# Poll for readiness rather than sleeping a fixed 2 and 3 seconds, which was
# either too long on a warm start or far too short on a cold one -- and either
# way told you nothing about whether the server had actually come up.
wait_for() {
    local url="$1" attempts="$2" i
    for (( i = 0; i < attempts; i++ )); do
        if curl -sf -o /dev/null "$url"; then return 0; fi
        sleep 1
    done
    return 1
}

echo
echo "[Wait] Waiting for the backend to answer..."
BACKEND_READY=0; wait_for "$BACKEND_URL/" 30 && BACKEND_READY=1

echo "[Wait] Waiting for the frontend to answer..."
FRONTEND_READY=0; wait_for "$FRONTEND_URL/" 40 && FRONTEND_READY=1

echo
echo "============================================================"
if [ "$BACKEND_READY" = "1" ]; then
    echo "  Backend  : READY            $BACKEND_URL"
else
    echo "  Backend  : FAILED TO START"
fi
if [ "$FRONTEND_READY" = "1" ]; then
    echo "  Frontend : READY            $FRONTEND_URL"
else
    echo "  Frontend : FAILED TO START"
fi
echo "  API docs : $BACKEND_URL/docs"
echo "  Logs     : $LOG_DIR"
echo "============================================================"
echo

if [ "$BACKEND_READY" != "1" ]; then
    echo "---- last lines of backend log ----"
    tail -n 15 "$LOG_DIR/backend.out.log" 2>/dev/null || echo "No log was written."
    echo "-----------------------------------"
fi
if [ "$FRONTEND_READY" != "1" ]; then
    echo "---- last lines of frontend log ----"
    tail -n 15 "$LOG_DIR/frontend.out.log" 2>/dev/null || echo "No log was written."
    echo "------------------------------------"
    echo "[Stop] Not opening a browser -- the page would only fail to load."
    exit 1
fi

if command -v xdg-open >/dev/null 2>&1; then xdg-open "$FRONTEND_URL" >/dev/null 2>&1 &
elif command -v open     >/dev/null 2>&1; then open "$FRONTEND_URL" >/dev/null 2>&1 &
fi

echo "  PrepBench is running. Press Ctrl+C to stop both servers."
wait
