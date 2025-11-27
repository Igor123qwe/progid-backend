@echo off
chcp 65001 > nul

echo ===========================================
echo     🚀 ProGid Backend — Обновление
echo ===========================================
echo.

REM --- Переходим в папку скрипта (проект backend)
cd /d "%~dp0"

REM --- Проверяем, есть ли git
git --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Git не установлен! Установите Git с https://git-scm.com
    pause
    exit /b
)

REM --- Проверяем инициализацию репозитория
if not exist ".git" (
    echo ❌ Это не git-репозиторий! Выполните: git init
    pause
    exit /b
)

echo 🔍 Проверка изменений...
git status
echo.

echo ➕ Добавляем файлы...
git add .
echo.

set /p msg="Введите комментарий коммита (Enter = update backend): "

if "%msg%"=="" (
    set msg=update backend
)

echo 💾 Создаем commit: "%msg%" ...
git commit -m "%msg%"
echo.

echo 🚀 Отправляем на GitHub (ветка main)...
git push origin main

if errorlevel 1 (
    echo.
    echo ❌ Ошибка при push! Проверь подключение к GitHub.
    pause
    exit /b
)

echo.
echo ===========================================
echo 🎉 Готово! Деплой на Vercel стартовал.
echo ===========================================
pause
