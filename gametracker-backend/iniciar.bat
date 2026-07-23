@echo off
REM ============================================================
REM  Inicia o backend do GameTracker Pro.
REM  Basta dar duplo clique neste arquivo (ou rodar pelo terminal)
REM  — ele sempre acha o caminho certo sozinho, nao importa de
REM  onde voce o executou.
REM ============================================================

cd /d "%~dp0"

if not exist venv (
    echo Criando ambiente virtual pela primeira vez...
    python -m venv venv
)

call venv\Scripts\activate.bat

echo.
echo Instalando/atualizando dependencias (isso e rapido se ja estiver tudo instalado)...
pip install -r requirements.txt

echo.
echo ============================================================
echo  Iniciando servidor em http://127.0.0.1:8000
echo  Pressione CTRL+C para parar.
echo ============================================================
echo.

uvicorn app.main:app --reload

pause
