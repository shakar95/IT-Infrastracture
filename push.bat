@echo off
set "PATH=%~dp0tools\git\cmd;%PATH%"
echo =================================================================
echo   Push to GitHub: https://github.com/shakaralii/IT-Infrastracture
echo =================================================================
echo.
set /p GITHUB_TOKEN="Enter your GitHub Personal Access Token (PAT): "
if "%GITHUB_TOKEN%"=="" (
    echo.
    echo Token cannot be empty.
    echo You can generate a token with 'repo' scope at: https://github.com/settings/tokens
    pause
    exit /b
)
echo.
echo Pushing main branch to GitHub...
git push https://shakaralii:%GITHUB_TOKEN%@github.com/shakaralii/IT-Infrastracture.git main
echo.
echo =================================================================
echo Push process completed!
echo =================================================================
pause
