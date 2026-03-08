#!/bin/bash

# Navigate to the project directory
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "🚀 Starting Scaffolding Diffusion Platform..."
echo "------------------------------------------------"

# Function to handle cleanup on exit
cleanup() {
    echo ""
    echo "🛑 Shutting down frontend and backend..."
    if [ -n "$BACKEND_PID" ]; then
        kill $BACKEND_PID 2>/dev/null
    fi
    if [ -n "$FRONTEND_PID" ]; then
        kill $FRONTEND_PID 2>/dev/null
    fi
    exit
}

# Trap SIGINT (Ctrl+C) and SIGTERM to run cleanup
trap cleanup SIGINT SIGTERM

echo "📦 1/2: Starting FastAPI Backend on port 8000..."
cd "$PROJECT_DIR/backend"
# Use the virtual environment if it exists, otherwise use plain python/uvicorn
if [ -d "$PROJECT_DIR/venv" ]; then
    source "$PROJECT_DIR/venv/bin/activate"
    python -m uvicorn api.main:app --host 0.0.0.0 --port 8000 --reload &
else
    uvicorn api.main:app --host 0.0.0.0 --port 8000 --reload &
fi
BACKEND_PID=$!

echo "🎨 2/2: Starting Next.js Frontend on port 3000..."
cd "$PROJECT_DIR/frontend"
npm run dev &
FRONTEND_PID=$!

echo "------------------------------------------------"
echo "✅ Both services are running!"
echo "➡️  Frontend: http://localhost:3000"
echo "➡️  Backend API Docs: http://localhost:8000/docs"
echo "------------------------------------------------"
echo "Press Ctrl+C to stop both services."

# Wait for both processes
wait
