#!/bin/bash

echo "Killing all Electron processes..."

# Kill all Electron processes
pkill -f "Electron" || true
pkill -f "electron" || true

# Kill Node.js processes that might be running the main process
pkill -f "main/src/main.ts" || true
pkill -f "yarn dev" || true
pkill -f "npm run dev" || true

# Kill processes on specific ports
lsof -ti:3000 | xargs kill -9 2>/dev/null || true
lsof -ti:3001 | xargs kill -9 2>/dev/null || true

echo "Cleaning up..."
# Remove any lock files or temporary files
rm -rf frontend/.next
rm -rf frontend/out
rm -rf main/dist

echo "All Electron processes killed and cleaned up!" 