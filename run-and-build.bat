@echo off
title Gaffer - Run and Build
color 0A

echo ================================================================
echo                    GAFFER - RUN AND BUILD
echo ================================================================
echo.
echo What do you want to do?
echo.
echo   1. Run the game (dev mode - fast, for testing)
echo   2. Build the installer (release mode - produces .exe)
echo   3. Check if Node.js and Rust are installed
echo   4. Install dependencies (npm install)
echo   5. Clear build cache (if builds are stuck/slow)
echo   6. Exit
echo.
set /p choice="Enter your choice (1-6): "

if "%choice%"=="1" goto run
if "%choice%"=="2" goto build
if "%choice%"=="3" goto check
if "%choice%"=="4" goto install
if "%choice%"=="5" goto clearcache
if "%choice%"=="6" exit
goto invalid

:run
echo.
echo ================================================================
echo RUNNING THE GAME (DEV MODE)
echo ================================================================
echo.
echo This starts the game in development mode.
echo - First run takes 5-15 minutes (compiles all Rust code)
echo - Subsequent runs are much faster (1-3 minutes)
echo - The game window will open automatically when ready
echo - Close the game window or press Ctrl+C in this terminal to stop
echo.
echo TIP: If the build is slow, make sure no other heavy programs
echo are running. The Rust compiler uses all CPU cores.
echo.
echo Press any key to start...
pause >nul

echo.
echo Checking for Node.js...
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [FAILED] Node.js is NOT installed.
    echo Please install it from: https://nodejs.org
    pause
    exit /b 1
)

echo Checking for Rust...
where cargo >nul 2>nul
if %errorlevel% neq 0 (
    echo [FAILED] Rust is NOT installed.
    echo Please install it from: https://rustup.rs
    pause
    exit /b 1
)

echo Checking for project files...
if not exist "package.json" (
    echo [FAILED] package.json not found.
    echo Make sure you're running this from the gaffer folder.
    echo If you downloaded a ZIP, extract it first.
    pause
    exit /b 1
)

echo Installing dependencies if needed...
if not exist "node_modules" (
    echo Running npm install...
    call npm install
    if %errorlevel% neq 0 (
        echo [FAILED] npm install failed.
        pause
        exit /b 1
    )
)

echo.
echo ================================================================
echo STARTING THE GAME...
echo ================================================================
echo.
echo The game window will open when the build is ready.
echo DO NOT close this window while the game is running.
echo.
echo If this is your first build, it will take several minutes.
echo Watch for "Compiling" messages — when they stop, the game
echo window will appear.
echo.
call npm run tauri dev

echo.
echo ================================================================
echo Game closed. Press any key to exit.
echo ================================================================
pause
exit

:build
echo.
echo ================================================================
echo BUILDING THE INSTALLER (RELEASE MODE)
echo ================================================================
echo.
echo This produces a Windows .exe installer in:
echo   src-tauri\target\release\bundle\
echo.
echo WARNING: This takes 15-30 minutes on most machines.
echo The first build is the slowest. Subsequent builds are faster.
echo.
echo TIP: The release build uses thin LTO (faster build, slightly
echo larger binary). This is optimal for development.
echo.
echo Press any key to start the build...
pause >nul

echo.
echo Checking for Node.js...
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [FAILED] Node.js is NOT installed.
    echo Please install it from: https://nodejs.org
    pause
    exit /b 1
)

echo Checking for Rust...
where cargo >nul 2>nul
if %errorlevel% neq 0 (
    echo [FAILED] Rust is NOT installed.
    echo Please install it from: https://rustup.rs
    pause
    exit /b 1
)

echo Checking for project files...
if not exist "package.json" (
    echo [FAILED] package.json not found.
    echo Make sure you're running this from the gaffer folder.
    pause
    exit /b 1
)

echo Installing dependencies if needed...
if not exist "node_modules" (
    echo Running npm install...
    call npm install
    if %errorlevel% neq 0 (
        echo [FAILED] npm install failed.
        pause
        exit /b 1
    )
)

echo.
echo ================================================================
echo BUILDING...
echo ================================================================
echo.
echo This will take a while. Go make a cup of tea.
echo.

call npm run tauri build

if %errorlevel% neq 0 (
    echo.
    echo ================================================================
    echo BUILD FAILED
    echo ================================================================
    echo Check the error messages above.
    echo Common fixes:
    echo   - Make sure you have the latest Rust (rustup update)
    echo   - Make sure you have the latest Node.js (v18+)
    echo   - Try clearing the cache (option 5) and rebuilding
    pause
    exit /b 1
)

echo.
echo ================================================================
echo BUILD COMPLETE!
echo ================================================================
echo.
echo The installer (.exe) should be in:
echo   src-tauri\target\release\bundle\nsis\
echo or
echo   src-tauri\target\release\bundle\msi\
echo.
pause
exit

:check
echo.
echo ================================================================
echo CHECKING INSTALLATIONS
echo ================================================================
echo.

echo Checking Node.js...
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [MISSING] Node.js is NOT installed.
    echo   Install from: https://nodejs.org
    echo   Click "LTS", run the installer, click Next through everything.
) else (
    echo [OK] Node.js is installed.
    node --version
)

echo.
echo Checking Rust...
where cargo >nul 2>nul
if %errorlevel% neq 0 (
    echo [MISSING] Rust is NOT installed.
    echo   Install from: https://rustup.rs
    echo   Download rustup-init.exe, run it, press Enter for default.
) else (
    echo [OK] Rust is installed.
    cargo --version
)

echo.
echo Checking project files...
if exist "package.json" (
    echo [OK] package.json found.
) else (
    echo [MISSING] package.json not found.
    echo   Make sure you're running this from the gaffer folder.
)

if exist "node_modules" (
    echo [OK] node_modules found — dependencies installed.
) else (
    echo [MISSING] node_modules not found — run option 4 to install dependencies.
)

if exist "src-tauri\target" (
    echo [OK] Build cache found — subsequent builds will be faster.
) else (
    echo [INFO] No build cache yet — first build will be slower.
)

echo.
pause
goto menu

:install
echo.
echo ================================================================
echo INSTALLING DEPENDENCIES
echo ================================================================
echo.
echo This runs "npm install" to download all required packages.
echo Takes 2-3 minutes.
echo.

if not exist "package.json" (
    echo [FAILED] package.json not found.
    pause
    goto menu
)

call npm install

if %errorlevel% neq 0 (
    echo.
    echo [FAILED] npm install failed.
    pause
    exit /b 1
)

echo.
echo ================================================================
echo DEPENDENCIES INSTALLED SUCCESSFULLY
echo ================================================================
pause
goto menu

:clearcache
echo.
echo ================================================================
echo CLEARING BUILD CACHE
echo ================================================================
echo.
echo This deletes the Rust build cache (target/ directory).
echo Use this if:
echo   - Builds are stuck or hanging
echo   - You get strange compile errors
echo   - You want a completely fresh build
echo.
echo WARNING: After clearing, the next build will take the full
echo 5-15 minutes again (same as first build).
echo.
set /p confirm="Are you sure? (Y/N): "
if /i not "%confirm%"=="Y" goto menu

if exist "src-tauri\target" (
    echo Deleting src-tauri\target...
    rmdir /S /Q "src-tauri\target"
    echo [OK] Build cache cleared.
) else (
    echo [INFO] No build cache found — nothing to clear.
)

echo.
pause
goto menu

:invalid
echo.
echo Invalid choice. Please enter a number from 1 to 6.
pause
goto menu

:menu
cls
goto start
