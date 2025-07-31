#!/bin/bash

# Kill any existing processes
echo "Cleaning up existing processes..."
pkill -9 -f "electron.*main.js" || true
pkill -9 -f "node.*next" || true
lsof -ti:3001 | xargs kill -9 2>/dev/null || true
lsof -ti:3000 | xargs kill -9 2>/dev/null || true

echo "Starting Next.js server..."
cd frontend && yarn dev -H 0.0.0.0 &
NEXT_PID=$!

echo "Waiting for Next.js to be ready..."
sleep 5

echo "Starting Electron app..."
cd ../main && yarn start &
ELECTRON_PID=$!

echo "Development server started!"
echo "Next.js PID: $NEXT_PID"
echo "Electron PID: $ELECTRON_PID"
echo "Press Ctrl+C to stop both servers"

# Wait for both processes
wait $NEXT_PID $ELECTRON_PID