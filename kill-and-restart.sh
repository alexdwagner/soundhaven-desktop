#!/bin/bash

echo "🔍 Checking for processes on ports 3000 and 3001..."

# Function to kill process on a specific port
kill_port() {
    local port=$1
    local pids=$(lsof -ti:$port)
    
    if [ ! -z "$pids" ]; then
        echo "🔥 Killing processes on port $port: $pids"
        echo "$pids" | xargs kill -9
        sleep 1
        
        # Verify the processes are killed
        local remaining=$(lsof -ti:$port)
        if [ ! -z "$remaining" ]; then
            echo "⚠️  Some processes on port $port are still running: $remaining"
            echo "$remaining" | xargs kill -9
            sleep 2
        else
            echo "✅ Port $port is now free"
        fi
    else
        echo "✅ Port $port is already free"
    fi
}

# Kill processes on both ports
kill_port 3000
kill_port 3001

# Also kill any electron or yarn dev processes that might be hanging
echo "🔍 Checking for hanging Electron/Node processes..."
pkill -f "electron" 2>/dev/null && echo "🔥 Killed Electron processes" || echo "✅ No Electron processes found"
pkill -f "yarn.*dev" 2>/dev/null && echo "🔥 Killed yarn dev processes" || echo "✅ No yarn dev processes found"
pkill -f "next.*dev" 2>/dev/null && echo "🔥 Killed Next.js dev processes" || echo "✅ No Next.js dev processes found"

# Wait a moment for cleanup
echo "⏳ Waiting for cleanup..."
sleep 3

# Start the development server
echo "🚀 Starting development server..."
yarn dev 