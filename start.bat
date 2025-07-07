@echo off
TITLE DaZHangAI Launcher

ECHO =======================================
ECHO  DaZHangAI Project Startup Script
ECHO =======================================
ECHO This script will check for dependencies, install them if needed,
ECHO and start both the backend and frontend servers.
ECHO.

REM =======================================
REM  BACKEND SETUP
REM =======================================
ECHO [1/4] Setting up Backend...
cd backend

IF NOT EXIST "requirements.txt" (
    ECHO [ERROR] 'backend/requirements.txt' not found. Cannot proceed.
    cd ..
    pause
    exit /b
)

ECHO [2/4] Checking for Python virtual environment...
IF NOT EXIST "venv" (
    ECHO      Virtual environment not found. Creating 'venv'...
    python -m venv venv
    IF %ERRORLEVEL% NEQ 0 (
        ECHO [ERROR] Failed to create virtual environment.
        ECHO      Please ensure Python 3 is installed and in your system's PATH.
        cd ..
        pause
        exit /b
    )
    ECHO      Virtual environment created successfully.
)

ECHO [3/4] Installing backend dependencies...
CALL venv\Scripts\activate.bat
pip install -r requirements.txt

ECHO [4/4] Starting backend server...
START "DaZHangAI Backend" cmd /k "CALL venv\Scripts\activate.bat && flask run"

cd ..
ECHO.
ECHO Backend setup complete. Server starting in a new window.
ECHO.
ECHO.

REM =======================================
REM  FRONTEND SETUP
REM =======================================
ECHO [1/3] Setting up Frontend...
cd frontend

IF NOT EXIST "package.json" (
    ECHO [ERROR] 'frontend/package.json' not found. Cannot proceed.
    cd ..
    pause
    exit /b
)

ECHO [2/3] Checking and installing frontend dependencies...
IF NOT EXIST "node_modules" (
    ECHO      'node_modules' not found. Running 'npm install'...
    npm install
    IF %ERRORLEVEL% NEQ 0 (
        ECHO [ERROR] 'npm install' failed.
        ECHO      Please ensure Node.js and npm are installed correctly.
        cd ..
        pause
        exit /b
    )
) ELSE (
    ECHO      'node_modules' found. Skipping 'npm install'.
)

ECHO [3/3] Starting frontend server...
START "DaZHangAI Frontend" cmd /k "npm start"

cd ..
ECHO.
ECHO Frontend setup complete. Server starting in a new window.
ECHO.
ECHO.

ECHO =======================================
ECHO  All done!
ECHO  Backend will be running at http://127.0.0.1:5000
ECHO  Frontend will open automatically at http://localhost:3000
ECHO =======================================
ECHO.
pause 