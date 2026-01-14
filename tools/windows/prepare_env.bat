@echo off
chcp 65001 >nul 2>&1
setlocal enabledelayedexpansion

cd /d "%~dp0"
cd ..
cd ..

python -m venv pyenv || exit /b 1
call pyenv/Scripts/activate || exit /b 1

python -m pip install -r tools/requirements.txt || exit /b 1
python -m pip install -r service/requirements.txt || exit /b 1
python -m pip install -r winapp/requirements.txt || exit /b 1
python tools/prepare_env/prepare_env.py -d deps || exit /b 1

echo "install web dependencies"

cd web || exit /b 1
npm install -y || exit /b 1