@echo off
REM ============================================================
REM  Sobe o frontend do GameTracker Pro em http://127.0.0.1:5500
REM  Deixe o backend (iniciar.bat) rodando em outra janela antes
REM  de abrir isto.
REM ============================================================

cd /d "%~dp0"

echo.
echo ============================================================
echo  Frontend disponivel em http://127.0.0.1:5500/index.html
echo  Pressione CTRL+C para parar.
echo ============================================================
echo.

python -m http.server 5500

pause
