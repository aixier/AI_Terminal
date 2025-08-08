#!/bin/bash

echo "========================================="
echo "🚀 Starting Terminal Backend Server"
echo "========================================="
echo ""

cd terminal-backend

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
    echo ""
fi

echo "🔧 Starting server on port 3000..."
echo ""
echo "Server will be available at:"
echo "  - HTTP: http://localhost:3000"
echo "  - WebSocket: ws://localhost:3000"
echo ""
echo "Test endpoints:"
echo "  - Health check: http://localhost:3000/health"
echo ""
echo "========================================="
echo ""

# Start the server
npm start