@echo off
chcp 65001 >nul 2>&1
title CDN IP Scanner V1.0 - Setup ^& Run
color 0B

set "ENV_MARKER=.scanner_env_ok"

echo.
echo ========================================================
echo    CDN IP Scanner V1.0 - shahin salek tootoonchi
echo   GitHub: github.com/shahinst  ^|  Digicloud: digicloud.tr
echo ========================================================
echo.

if exist "%ENV_MARKER%" (
    echo [*] Environment already set up. Starting...
    goto :run
)

echo [1/5] Checking Python...
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [*] Python not found. Trying to install...
    winget install Python.Python.3.12 --accept-package-agreements --accept-source-agreements 2>nul
    if %errorlevel% neq 0 (
        echo [ERROR] Could not install Python automatically.
        echo Install manually: https://www.python.org/downloads/
        echo Enable "Add Python to PATH"
        start https://www.python.org/downloads/ 2>nul
        pause
        exit /b 1
    )
    echo [OK] Python installed. Close this window and run Scanner_Pro.bat again.
    pause
    exit /b 0
)
python --version
echo [OK] Python found.
echo.

echo [2/5] Upgrading pip...
python -m pip install --quiet --upgrade pip 2>nul
echo.

echo [3/5] Installing packages...
if exist "requirements.txt" (
    python -m pip install --quiet -r requirements.txt
    if %errorlevel% neq 0 (
        python -m pip install --user -r requirements.txt
    )
    if %errorlevel% neq 0 (
        echo [ERROR] Failed to install packages.
        pause
        exit /b 1
    )
    echo [OK] Packages installed.
) else (
    python -m pip install --quiet requests openpyxl
)
echo.

echo [OK] Environment ready. Next runs will skip this check.
echo %date% %time% > "%ENV_MARKER%"
echo.

:run
echo [4/5] Checking files...
if not exist "ip_scanner_pro.py" (
    echo [ERROR] ip_scanner_pro.py not found!
    pause
    exit /b 1
)
echo [OK] All files present.
echo.

echo [5/5] Starting CDN IP Scanner V1.0...
echo ========================================================
echo.
timeout /t 1 /nobreak >nul

python ip_scanner_pro.py

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Program exited with error.
    echo Try: pip install -r requirements.txt
    pause
)
echo.
pause
