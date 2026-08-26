#!/bin/bash
# AegisOps startup script for Linux/Mac
# Usage: bash scripts/start.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$SCRIPT_DIR/.."

echo -e "\033[36mStarting AegisOps...\033[0m"

# Check .env exists
if [ ! -f "$ROOT/.env" ] && [ -f "$ROOT/.env.example" ]; then
    cp "$ROOT/.env.example" "$ROOT/.env"
    echo -e "\033[33m.env created from .env.example — add your GEMINI_API_KEY!\033[0m"
fi

# 1. Kartify
echo -e "\033[32m[1/3] Starting Kartify on port 4000...\033[0m"
(cd "$ROOT/kartify" && node server/server.js) &

sleep 1

# 2. FastAPI Backend
echo -e "\033[32m[2/3] Starting FastAPI backend on port 8000...\033[0m"
(cd "$ROOT/backend" && python -m uvicorn app.main:app --port 8000 --reload) &

sleep 2

# 3. React Frontend
echo -e "\033[32m[3/3] Starting React dashboard on port 5173...\033[0m"
(cd "$ROOT/frontend" && npm run dev) &

echo ""
echo -e "\033[36mAegisOps is running!\033[0m"
echo "  Kartify:   http://localhost:4000"
echo "  Backend:   http://localhost:8000/docs"
echo "  Dashboard: http://localhost:5173"
echo ""
echo -e "\033[33mPress Ctrl+C to stop all processes.\033[0m"

wait
