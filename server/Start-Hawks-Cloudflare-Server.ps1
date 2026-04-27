param(
  [switch]$NoWait
)

$ErrorActionPreference = 'Stop'
$serverDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$port = 8787
if ($env:PORT) {
  $parsedPort = 0
  if ([int]::TryParse($env:PORT, [ref]$parsedPort)) {
    $port = $parsedPort
  }
}

$logDir = Join-Path $serverDir 'logs'
New-Item -ItemType Directory -Path $logDir -Force | Out-Null

function Write-Step($message) {
  Write-Host "[Hawks] $message" -ForegroundColor Cyan
}

function Require-Command($name, $installUrl) {
  $cmd = Get-Command $name -ErrorAction SilentlyContinue
  if (-not $cmd) {
    Write-Host ""
    Write-Host "$name is not installed or is not on PATH." -ForegroundColor Red
    Write-Host "Install it here: $installUrl"
    Start-Process $installUrl
    throw "$name is required."
  }
  return $cmd.Source
}

function Find-Cloudflared {
  $candidates = @(
    (Join-Path $serverDir 'cloudflared.exe'),
    (Join-Path $serverDir 'tools\cloudflared.exe'),
    (Join-Path $serverDir '..\..\tools\cloudflared.exe')
  )

  $cmd = Get-Command cloudflared -ErrorAction SilentlyContinue
  if ($cmd) {
    $candidates += $cmd.Source
  }

  foreach ($candidate in $candidates) {
    $resolved = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($candidate)
    if (Test-Path $resolved) {
      return $resolved
    }
  }

  return $null
}

function Wait-For-Port($targetPort) {
  for ($i = 0; $i -lt 20; $i++) {
    $listener = Get-NetTCPConnection -LocalPort $targetPort -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($listener) {
      return $true
    }
    Start-Sleep -Milliseconds 500
  }
  return $false
}

Clear-Host
Write-Host "Hawks FNF Multiplayer Server Launcher" -ForegroundColor Yellow
Write-Host "Keep this window open while players are connecting."
Write-Host ""

$nodePath = Require-Command 'node' 'https://nodejs.org/'
Require-Command 'npm' 'https://nodejs.org/' | Out-Null

if (-not (Test-Path (Join-Path $serverDir 'node_modules\ws'))) {
  Write-Step "Installing server packages..."
  Push-Location $serverDir
  try {
    & npm install
  }
  finally {
    Pop-Location
  }
}

$serverStarted = $false
$serverProcess = $null
$existingServer = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
if ($existingServer) {
  Write-Step "Relay is already listening on port $port."
}
else {
  Write-Step "Starting local relay on port $port..."
  $serverOut = Join-Path $logDir 'server.out.log'
  $serverErr = Join-Path $logDir 'server.err.log'
  Remove-Item $serverOut, $serverErr -ErrorAction SilentlyContinue
  $serverProcess = Start-Process -FilePath $nodePath -ArgumentList 'server.js' -WorkingDirectory $serverDir -RedirectStandardOutput $serverOut -RedirectStandardError $serverErr -WindowStyle Hidden -PassThru
  $serverStarted = $true
  if (-not (Wait-For-Port $port)) {
    Get-Content $serverOut, $serverErr -ErrorAction SilentlyContinue | Select-Object -Last 40
    throw "Relay did not start on port $port."
  }
}

$cloudflared = Find-Cloudflared
if (-not $cloudflared) {
  Write-Step "Downloading Cloudflare Tunnel..."
  $cloudflared = Join-Path $serverDir 'cloudflared.exe'
  Invoke-WebRequest -Uri 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe' -OutFile $cloudflared
}

Write-Step "Starting Cloudflare Quick Tunnel..."
$tunnelOut = Join-Path $logDir 'cloudflared.out.log'
$tunnelErr = Join-Path $logDir 'cloudflared.err.log'
Remove-Item $tunnelOut, $tunnelErr -ErrorAction SilentlyContinue
$tunnelProcess = Start-Process -FilePath $cloudflared -ArgumentList @('tunnel', '--url', "http://localhost:$port", '--no-autoupdate') -RedirectStandardOutput $tunnelOut -RedirectStandardError $tunnelErr -WindowStyle Hidden -PassThru

$httpsUrl = $null
for ($i = 0; $i -lt 60; $i++) {
  Start-Sleep -Seconds 1
  $text = ''
  if (Test-Path $tunnelOut) {
    $text += Get-Content $tunnelOut -Raw -ErrorAction SilentlyContinue
  }
  if (Test-Path $tunnelErr) {
    $text += "`n" + (Get-Content $tunnelErr -Raw -ErrorAction SilentlyContinue)
  }

  $match = [regex]::Match($text, 'https://[a-zA-Z0-9-]+\.trycloudflare\.com')
  if ($match.Success) {
    $httpsUrl = $match.Value
    break
  }
}

if (-not $httpsUrl) {
  Get-Content $tunnelOut, $tunnelErr -ErrorAction SilentlyContinue | Select-Object -Last 80
  throw "Cloudflare did not return a tunnel URL."
}

$wsUrl = $httpsUrl -replace '^https:', 'wss:'
$urlFile = Join-Path $serverDir 'cloudflare-server-url.txt'
Set-Content -Path $urlFile -Value $wsUrl -Encoding ASCII

$workspaceRoot = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath((Join-Path $serverDir '..\..\..'))
$gameUrlTargets = @(
  (Join-Path $workspaceRoot 'Playable Build\Extracted'),
  (Join-Path $workspaceRoot 'Source\fnf-psych-source-online\export\release\windows\bin'),
  (Join-Path $serverDir '..\..\fnf-psych-source-online\export\release\windows\bin')
)
$updatedGameTargets = @()
foreach ($target in $gameUrlTargets) {
  $resolvedTarget = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($target)
  if (Test-Path $resolvedTarget) {
    Set-Content -Path (Join-Path $resolvedTarget 'online-server-url.txt') -Value $wsUrl -Encoding ASCII
    $updatedGameTargets += $resolvedTarget
  }
}

try {
  Set-Clipboard -Value $wsUrl
}
catch {}

Write-Host ""
Write-Host "SERVER IS ON" -ForegroundColor Green
Write-Host ""
Write-Host "Game Server URL:" -ForegroundColor Yellow
Write-Host $wsUrl -ForegroundColor White
Write-Host ""
Write-Host "I copied it to your clipboard and saved it here:"
Write-Host $urlFile
if ($updatedGameTargets.Count -gt 0) {
  Write-Host "Also wrote it to these game folders as online-server-url.txt:"
  foreach ($target in $updatedGameTargets) {
    Write-Host " - $target"
  }
}
Write-Host ""
Write-Host "Quick Tunnel URLs change every time this launcher starts."
Write-Host "If your friend cannot connect, send them the URL above or paste it into Online Battle > Server URL."
Write-Host ""

if ($NoWait) {
  exit 0
}

Write-Host "Press Q to stop the tunnel and close this launcher."
while ($true) {
  if ([Console]::KeyAvailable) {
    $key = [Console]::ReadKey($true)
    if ($key.Key -eq 'Q') {
      break
    }
  }

  if ($tunnelProcess.HasExited) {
    Write-Host "Cloudflare Tunnel stopped." -ForegroundColor Red
    break
  }

  Start-Sleep -Milliseconds 500
}

if ($tunnelProcess -and -not $tunnelProcess.HasExited) {
  Stop-Process -Id $tunnelProcess.Id -Force
}

if ($serverStarted -and $serverProcess -and -not $serverProcess.HasExited) {
  Stop-Process -Id $serverProcess.Id -Force
}

Write-Host "Server launcher closed."
