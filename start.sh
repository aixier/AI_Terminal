#!/bin/bash

echo "Starting AI Terminal Services..."
echo ""

echo "[1/2] Starting Backend Server..."
cd terminal-backend
npm start &
BACKEND_PID=$!
cd ..

echo "Waiting for backend to start..."
sleep 3

echo "[2/2] Starting Frontend..."
cd terminal-ui
npm run dev &
FRONTEND_PID=$!
cd ..

echo ""
echo "========================================"
echo "AI Terminal is running!"
echo "========================================"
echo "Backend: http://localhost:3000"
echo "Frontend: http://localhost:5173"
echo ""
echo "Press Ctrl+C to stop all services"

# Wait for user interrupt
trap "echo 'Stopping services...'; kill $BACKEND_PID $FRONTEND_PID; exit" INT
wait