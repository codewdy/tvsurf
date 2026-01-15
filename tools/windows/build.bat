echo on

chcp 65001 >nul 2>&1
setlocal enabledelayedexpansion

cd /d "%~dp0"
cd ..
cd ..

call tools/windows/prepare_env.bat || exit /b 1

cd web || exit /b 1
echo "Building web application..."
call npm run build
if errorlevel 1 (
    echo "npm run build failed!"
    exit /b 1
)
if not exist "build" (
    echo "Build output directory 'build' not found!"
    exit /b 1
)
echo "Web build completed successfully."
cd ..


echo "Activating Python environment..."
call pyenv/Scripts/activate || exit /b 1
echo "Building Windows executable..."
pyinstaller tools/windows/pyinstaller.spec -y || exit /b 1
echo "Copying config.yaml..."

copy "config.yaml" "dist\tvsurf\config.yaml" || exit /b 1

echo done