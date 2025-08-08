@echo off
echo Starting AI Terminal Services...
echo.

echo [1/2] Starting Backend Server...
start "Terminal Backend" /D terminal-backend cmd /k "npm start"

echo Waiting for backend to start...
timeout /t 3 /nobreak > nul

echo [2/2] Starting Frontend...
start "Terminal Frontend" /D terminal-ui cmd /k "npm run dev"

echo.
echo ========================================
echo AI Terminal is starting up!
echo ========================================
echo Backend: http://localhost:3000
echo Frontend: http://localhost:5173
echo.
echo Press any key to exit...
pause > nul