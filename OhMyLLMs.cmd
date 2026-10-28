@echo off
setlocal
cd /d "%~dp0"
if not exist "artifacts\desktop\OhMyLLMs\OhMyLLMs.exe" (
  call npm.cmd run build
  if errorlevel 1 (
    echo Desktop build failed. See the error above.
    pause
    exit /b 1
  )
)
start "" "%~dp0artifacts\desktop\OhMyLLMs\OhMyLLMs.exe"
