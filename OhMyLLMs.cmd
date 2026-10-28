@echo off
setlocal
cd /d "%~dp0"
if not exist "artifacts\desktop\OhMyLLMs\OhMyLLMs.exe" (
  if not exist "node_modules\sharp\package.json" (
    call npm.cmd ci
    if errorlevel 1 (
      echo Build dependency installation failed. See the error above.
      pause
      exit /b 1
    )
  )
  call npm.cmd run build
  if errorlevel 1 (
    echo Desktop build failed. See the error above.
    pause
    exit /b 1
  )
)
start "" "%~dp0artifacts\desktop\OhMyLLMs\OhMyLLMs.exe"
