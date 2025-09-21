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

REM Explicitly add venv Scripts to PATH to avoid warnings
SET PATH=%PATH%;%CD%\venv\Scripts

REM Upgrade pip first for reliability
python -m pip install --upgrade pip

pip install -r requirements.txt
IF %ERRORLEVEL% NEQ 0 (
    ECHO [ERROR] Failed to install dependencies. Please check your internet connection or requirements.txt.
    cd ..
    pause
    exit /b
)

REM Check if flask is installed and accessible
where flask >nul 2>nul
IF %ERRORLEVEL% NEQ 0 (
    ECHO [WARNING] Flask not found in PATH after installation. Reinstalling Flask explicitly...
    pip install flask
)

REM Additional check: Verify if flask.exe exists in venv/Scripts
IF NOT EXIST "venv\Scripts\flask.exe" (
    ECHO [ERROR] flask.exe not found in venv/Scripts. Attempting to reinstall Flask...
    pip uninstall -y flask
    pip install flask
    IF NOT EXIST "venv\Scripts\flask.exe" (
        ECHO [ERROR] Failed to install flask.exe. Please delete the venv folder and rerun this script.
        cd ..
        pause
        exit /b
    )
)

ECHO [4/4] Starting backend server...
REM Add a short delay to ensure PATH is updated
timeout /t 2 /nobreak >nul
START "DaZHangAI Backend" cmd /k "CALL venv\Scripts\activate.bat && SET PATH=%PATH%;%CD%\venv\Scripts && python -m flask --app app --debug run"

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

REM Additional check: Verify if react-scripts is installed
IF NOT EXIST "node_modules\.bin\react-scripts.cmd" (
    ECHO [WARNING] react-scripts not found. Reinstalling dependencies...
    rmdir /s /q node_modules
    npm install
    IF %ERRORLEVEL% NEQ 0 (
        ECHO [ERROR] Failed to reinstall dependencies.
        cd ..
        pause
        exit /b
    )
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

