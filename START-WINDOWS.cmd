@echo off
setlocal
cd /d "%~dp0"
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\windows\start-production.ps1"
set "OPENLOG_EXIT=%ERRORLEVEL%"
if not "%OPENLOG_EXIT%"=="0" pause
exit /b %OPENLOG_EXIT%
