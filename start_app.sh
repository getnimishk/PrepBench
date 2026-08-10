#!/usr/bin/env bash
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/backend"
FRONTEND_DIR="$SCRIPT_DIR/frontend"
VENV_DIR="$BACKEND_DIR/.venv"

echo "============================================================"
echo "  PrepBench — 100% Offline Interview & Exam Prep Platform"
echo "============================================================"

# Log Cleanup
echo "[Logs] Cleaning old log files..."
rm -rf "$SCRIPT_DIR/logs"/* "$BACKEND_DIR/logs"/* 2>/dev/null || true

# Backend
if [ ! -d "$VENV_DIR" ]; then
    echo "[Backend] Creating Python virtual environment..."
    python3 -m venv "$VENV_DIR"
fi

echo "[Backend] Installing Python dependencies..."
"$VENV_DIR/bin/pip" install -r "$BACKEND_DIR/requirements.txt" -q

echo "[Backend] Starting FastAPI on http://localhost:8000 (DEBUG mode)..."
cd "$BACKEND_DIR"
"$VENV_DIR/bin/uvicorn" app.main:app --host 127.0.0.1 --port 8000 --reload --log-level debug &
BACKEND_PID=$!

sleep 2

# Frontend
echo "[Frontend] Installing npm packages if needed..."
cd "$FRONTEND_DIR"
npm install --silent

echo "[Frontend] Starting Vite on http://localhost:5173..."
npm run dev &
FRONTEND_PID=$!

sleep 3
echo ""
echo "============================================================"
echo "  Open: http://localhost:5173"
echo "  API Docs: http://localhost:8000/docs"
echo "  Press Ctrl+C to stop all servers."
echo "============================================================"

wait $BACKEND_PID $FRONTEND_PID
