@echo off
setlocal
cd /d "%~dp0"
echo Starting RiskLab from "%CD%"
if not exist "data\prices.csv" (
  echo Missing data\prices.csv. See README.md for download instructions.
  goto failed
)
if not exist ".venv\Scripts\python.exe" (
  python -m venv .venv
  if errorlevel 1 goto failed
)
".venv\Scripts\python.exe" -c "from importlib.util import find_spec; assert all(find_spec(name) for name in ('fastapi', 'uvicorn', 'numpy', 'pandas', 'arch', 'reportlab'))" >nul 2>&1
if errorlevel 1 (
  ".venv\Scripts\python.exe" -m pip install -r requirements.txt
  if errorlevel 1 goto failed
)
if not exist "frontend\dist\index.html" (
  pushd frontend
  if not exist "node_modules\.bin\vite.cmd" (
    call npm.cmd ci
    if errorlevel 1 goto failed
  )
  call npm.cmd run build
  if errorlevel 1 goto failed
  popd
)
".venv\Scripts\python.exe" -m scripts.launch_dashboard
if errorlevel 1 goto failed
exit /b 0
:failed
echo RiskLab startup failed. Check the message above.
pause
exit /b 1
