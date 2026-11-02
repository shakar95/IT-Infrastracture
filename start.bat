@echo off
set "PATH=%~dp0tools\node-v20.18.0-win-x64;%PATH%"
echo =================================================================
echo   Iraq Sitak Villa Project - IT & ELV Infrastructure Manager
echo =================================================================
echo Server starting at http://localhost:5000 ...
start http://localhost:5000
cd server
node index.js
pause
