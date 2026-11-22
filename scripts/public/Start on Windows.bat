@echo off
rem Double-click to start the SEO tools on Windows. Leave the window open while you work.
title SEO Pitch Deck Generator
cd /d "%~dp0"
echo Starting the SEO Pitch Deck Generator...
py -3 --version >nul 2>nul
if not errorlevel 1 (
  py -3 dev-server.py
  goto end
)
python --version >nul 2>nul
if not errorlevel 1 (
  python dev-server.py
  goto end
)
echo.
echo This PC does not have Python 3 yet. It is free.
echo.
echo   1. Download it from https://www.python.org/downloads/
echo   2. In the installer, tick "Add python.exe to PATH", then choose Install Now
echo   3. Double-click this file again
echo.
:end
echo.
pause
