@echo off
title PNP Cameo Bridge
cd /d "%~dp0"
where py >nul 2>nul
if %errorlevel%==0 (
  py -3 bridge.py
) else (
  where python >nul 2>nul
  if %errorlevel%==0 (
    python bridge.py
  ) else (
    echo.
    echo O Python ainda nao esta instalado neste computador.
    echo A pagina oficial sera aberta. Instale o Python e execute este arquivo novamente.
    start "" "https://www.python.org/downloads/windows/"
    echo.
    pause
    exit /b 1
  )
)
echo.
echo O PNP Cameo Bridge foi encerrado.
pause
