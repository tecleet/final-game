#!/bin/bash
cd "$(dirname "$0")"

# --- Backend Setup ---
echo "--- Checking Backend Requirements ---"

if ! command -v node &> /dev/null; then
    echo "ERROR: Node.js is not installed. Please install Node.js (https://nodejs.org/) to run the backend."
    echo "Frontend will start, but 'CONNECT' button won't work."
    echo "Press Enter to continue..."
    read
else
    echo "Node.js found."

    cd backend

    # Check dependencies
    if [ ! -d "node_modules" ]; then
        echo "Installing backend dependencies..."
        npm install
    fi

    # Check .env for API Key
    if [ -f ".env" ]; then
        if grep -q "YOUR_API_KEY_HERE" ".env"; then
            echo "WARNING: YouTube API Key not configured in backend/.env"
            echo "You can still use DEMO MODE."
        fi
    else
        echo "WARNING: backend/.env file missing. Creating a default one."
        echo "YOUTUBE_API_KEY=YOUR_API_KEY_HERE" > .env
    fi

    echo "Starting Backend Server..."
    node server.js &
    BACKEND_PID=$!
    cd ..

    # Wait for backend to be ready
    sleep 2
fi

# --- Frontend Setup ---
echo "--- Starting Frontend ---"
echo "Opening http://localhost:8000 in your browser..."

# Cleanup function to kill backend when this script exits
cleanup() {
    if [ -n "$BACKEND_PID" ]; then
        echo "Stopping Backend Server (PID: $BACKEND_PID)..."
        kill "$BACKEND_PID" 2>/dev/null
    fi
    exit
}

# Trap EXIT and SIGINT (Ctrl+C)
trap cleanup EXIT SIGINT

# Open Browser (Mac specific)
open "http://localhost:8000" 2>/dev/null || echo "Please open http://localhost:8000 manually."

# Start Frontend Server
python3 -m http.server 8000
