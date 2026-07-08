@echo off
title Gaffer - Setup and Run
color 0A

echo ================================================================
echo                    GAFFER - SETUP AND RUN
echo ================================================================
echo.
echo This script will:
echo   1. Check if Node.js is installed
echo   2. Check if Rust is installed
echo   3. Download the game code
echo   4. Install dependencies
echo   5. Launch the game
echo.
echo If anything fails, take a screenshot of this window and send it.
echo.
echo Press any key to start...
pause >nul

echo.
echo ================================================================
echo STEP 1: Checking Node.js...
echo ================================================================
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo.
    echo [FAILED] Node.js is NOT installed.
    echo.
    echo Please install it from: https://nodejs.org
    echo Click the "LTS" button, run the installer, click Next through everything.
    echo Then run this script again.
    echo.
    pause
    exit /b 1
)
echo [OK] Node.js is installed.
node --version

echo.
echo ================================================================
echo STEP 2: Checking Rust...
echo ================================================================
where cargo >nul 2>nul
if %errorlevel% neq 0 (
    echo.
    echo [FAILED] Rust is NOT installed.
    echo.
    echo Please install it from: https://rustup.rs
    echo Download rustup-init.exe, run it, press Enter for default.
    echo Then close this window and run this script again.
    echo.
    pause
    exit /b 1
)
echo [OK] Rust is installed.
cargo --version

echo.
echo ================================================================
echo STEP 3: Downloading the game code...
echo ================================================================
if exist "gaffer" (
    echo [OK] Code already downloaded. Updating...
    cd gaffer
    git pull
) else (
    echo Downloading from GitHub...
    git clone https://github.com/anthonycarre00-collab/gaffer.git
    cd gaffer
)

echo.
echo ================================================================
echo STEP 4: Installing dependencies (this takes 2-3 minutes)...
echo ================================================================
call npm install
if %errorlevel% neq 0 (
    echo.
    echo [FAILED] npm install failed.
    echo Take a screenshot of the error above and send it.
    echo.
    pause
    exit /b 1
)
echo [OK] Dependencies installed.

echo.
echo ================================================================
echo STEP 5: Launching the game (first build takes 3-5 minutes)...
echo ================================================================
echo.
echo A window will open when the game is ready.
echo DO NOT close this window while the game is running.
echo.
echo Press any key to launch...
pause >nul

call npm run tauri dev

echo.
echo ================================================================
echo Game closed. Press any key to exit.
echo ================================================================
pause
