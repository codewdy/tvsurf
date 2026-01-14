@echo off
setlocal enabledelayedexpansion

cd /d "%~dp0"
cd ..
cd ..

if exist dist rmdir /s /q dist || exit /b 1
if exist build rmdir /s /q build || exit /b 1
if exist pyenv rmdir /s /q pyenv || exit /b 1
if exist deps rmdir /s /q deps || exit /b 1
if exist web\node_modules rmdir /s /q web\node_modules || exit /b 1
if exist web\build rmdir /s /q web\build || exit /b 1

echo Clean completed.
