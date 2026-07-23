@echo off
REM ============================================================
REM  Cria a conta demo (demo@gametracker.com / Demo123!) com
REM  jogos de exemplo. Seguro de rodar mais de uma vez.
REM ============================================================

cd /d "%~dp0"

if not exist venv (
    echo Ambiente virtual nao encontrado. Rode "iniciar.bat" primeiro.
    pause
    exit /b 1
)

call venv\Scripts\activate.bat
python seed_demo.py

pause
