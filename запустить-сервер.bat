@echo off
title Семейное Древо - Локальный Сервер
color 0A
echo.
echo  ==========================================
echo  🌳  Семейное Древо / Family Tree Server
echo  ==========================================
echo.
echo  Запуск сервера на порту 8080...
echo  Сервер доступен по адресам:
echo.

REM Find local IP automatically
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do (
    set LOCAL_IP=%%a
    goto :found
)

:found
REM Trim the leading space from IP
set LOCAL_IP=%LOCAL_IP: =%

echo  - На этом компьютере:  http://localhost:8080
echo  - В локальной сети:    http://%LOCAL_IP%:8080
echo.
echo  Первый раз откройте сайт через браузер.
echo  После этого он будет работать ОФФЛАЙН
echo  даже при выключенном сервере!
echo.
echo  Для остановки сервера нажмите Ctrl+C
echo  ==========================================
echo.

cd /d "%~dp0"
npx -y http-server -p 8080 --cors -c-1

pause
