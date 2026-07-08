@echo off
title Gaffer - FIFA Data Enrichment
color 0A

echo ================================================================
echo              GAFFER - FIFA DATA ENRICHMENT
echo ================================================================
echo.
echo This downloads FIFA23 player data (height, weight, overall rating)
echo and merges it with FBref stats to produce realistic player data.
echo.
echo This will take 5-10 minutes (downloading 5.6GB from Hugging Face).
echo.
echo Press any key to start...
pause >nul

echo.
echo ================================================================
echo STEP 1: Finding the data_pipeline folder...
echo ================================================================
REM Try common locations
set "PIPELINE_DIR="
if exist "%~dp0src-tauri\data_pipeline" set "PIPELINE_DIR=%~dp0src-tauri\data_pipeline"
if exist "%~dp0gaffer-main\src-tauri\data_pipeline" set "PIPELINE_DIR=%~dp0gaffer-main\src-tauri\data_pipeline"
if exist "%~dp0gaffer\src-tauri\data_pipeline" set "PIPELINE_DIR=%~dp0gaffer\src-tauri\data_pipeline"

if "%PIPELINE_DIR%"=="" (
    echo.
    echo [FAILED] Could not find the data_pipeline folder.
    echo.
    echo Please move this .bat file into the gaffer-main folder
    echo (the one that contains src-tauri, package.json, etc.)
    echo Then run it again.
    echo.
    pause
    exit /b 1
)

echo [OK] Found: %PIPELINE_DIR%
cd /d "%PIPELINE_DIR%"

echo.
echo ================================================================
echo STEP 2: Installing Python dependencies...
echo ================================================================
pip install pandas requests 2>nul
pip install pandas requests
if %errorlevel% neq 0 (
    echo.
    echo [FAILED] Could not install Python packages.
    echo Make sure Python is installed from https://python.org
    echo.
    pause
    exit /b 1
)
echo [OK] Dependencies installed.

echo.
echo ================================================================
echo STEP 3: Running FIFA enrichment (5-10 minutes)...
echo ================================================================
echo.
echo Downloading FIFA23 data from Hugging Face...
echo This is a large file. Please be patient.
echo.
python enrich_with_fifa.py
if %errorlevel% neq 0 (
    echo.
    echo Trying with python3 instead of python...
    python3 enrich_with_fifa.py
)

echo.
echo ================================================================
echo STEP 4: Building world database...
echo ================================================================
python build_world.py
if %errorlevel% neq 0 (
    python3 build_world.py
)

echo.
echo ================================================================
echo DONE!
echo ================================================================
echo.
echo The world database has been updated with FIFA player data.
echo Copy gaffer_world.json from:
echo   %PIPELINE_DIR%\..\databases\gaffer_world.json
echo to your game's databases folder.
echo.
echo Press any key to exit...
pause
