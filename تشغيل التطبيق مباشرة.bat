@echo off
chcp 65001 > nul
title نظام سنترال حلمي وموبايل (POS)
cd /d "%~dp0"
echo ========================================================
echo     جاري فتح نظام سنترال حلمي وموبايل في المتصفح...
echo ========================================================
start "" "http://localhost:3000"
tasklist /fi "imagename eq node.exe" 2>NUL | find /i /n "node.exe">NUL
if "%ERRORLEVEL%"=="1" (
    start /min "" node server.js
)
exit
