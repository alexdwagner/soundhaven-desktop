#!/bin/bash

echo "🔍 Cleaning up ports 3000 and 3001..."

# Kill processes on specific ports
lsof -ti:3000 | xargs kill -9 2>/dev/null && echo "🔥 Killed processes on port 3000" || echo "✅ Port 3000 was free"
lsof -ti:3001 | xargs kill -9 2>/dev/null && echo "🔥 Killed processes on port 3001" || echo "✅ Port 3001 was free"

# Only kill old development processes, not new ones
pkill -f "yarn.*dev" 2>/dev/null && echo "🔥 Killed old yarn dev processes" || true
pkill -f "next.*dev" 2>/dev/null && echo "🔥 Killed old Next.js dev processes" || true

# Be more selective with Electron - only kill if ports were occupied
if lsof -ti:3000 >/dev/null 2>&1 || lsof -ti:3001 >/dev/null 2>&1; then
    pkill -f "electron" 2>/dev/null && echo "🔥 Killed hanging Electron processes" || true
fi

echo "✅ Port cleanup complete"
sleep 1 