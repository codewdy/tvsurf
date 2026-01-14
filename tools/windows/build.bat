@echo off
chcp 65001 >nul 2>&1
setlocal enabledelayedexpansion

cd /d "%~dp0"
cd ..
cd ..

call tools/windows/prepare_env.bat

cd web || exit /b 1
npm run build || exit /b 1
cd ..

call pyenv/Scripts/activate || exit /b 1
pyinstaller tools/windows/pyinstaller.spec -y || exit /b 1

copy "config.yaml" "dist\tvsurf\config.yaml" || exit /b 1

echo done