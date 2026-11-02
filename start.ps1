Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "   Iraq Sitak Villa Project - IT & ELV Infrastructure Manager    " -ForegroundColor Green
Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "Starting Unified Server on http://localhost:5000..." -ForegroundColor Yellow

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$nodePath = Join-Path $scriptDir "tools\node-v20.18.0-win-x64\node.exe"

if (-not (Test-Path $nodePath)) {
    Write-Host "Node.js executable not found at $nodePath. Falling back to system node..." -ForegroundColor DarkYellow
    $nodePath = "node"
}

Start-Process "http://localhost:5000"
Set-Location "$scriptDir\server"
& $nodePath "index.js"

