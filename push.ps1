Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "   Push to GitHub: https://github.com/shakaralii/IT-Infrastracture" -ForegroundColor Green
Write-Host "=================================================================" -ForegroundColor Cyan

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$gitExe = Join-Path $scriptDir "tools\git\cmd\git.exe"

$token = Read-Host "Enter your GitHub Personal Access Token (PAT)"
if ([string]::IsNullOrWhiteSpace($token)) {
    Write-Host "Token cannot be empty. Generate one at https://github.com/settings/tokens" -ForegroundColor Red
    pause
    exit
}

Write-Host "`nPushing main branch to GitHub..." -ForegroundColor Yellow
& $gitExe push "https://shakaralii:${token}@github.com/shakaralii/IT-Infrastracture.git" main

Write-Host "`n=================================================================" -ForegroundColor Cyan
Write-Host "🎉 Push process completed successfully!" -ForegroundColor Green
Write-Host "=================================================================" -ForegroundColor Cyan
pause
