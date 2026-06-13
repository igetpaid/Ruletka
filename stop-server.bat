@echo off
taskkill /F /IM python.exe 2>nul
if %errorlevel%==0 (
    echo Server stopped.
) else (
    echo Server was not running.
)
pause
