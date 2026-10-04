# deploy.ps1 - Synchronize entire physical-dice module directory to the Foundry server
# Usage:
#   .\deploy.ps1
#   .\deploy.ps1 -Server "user@host" -Password "your-password"
#   $env:FOUNDRY_DEPLOY_SERVER = "user@host"; .\deploy.ps1

param(
    [string]$Server = $(if ($env:FOUNDRY_DEPLOY_SERVER) { $env:FOUNDRY_DEPLOY_SERVER } else { "foundry@10.0.0.50" }),
    [string]$Password = $env:FOUNDRY_DEPLOY_PASSWORD,
    [string]$RemoteBase = $(if ($env:FOUNDRY_REMOTE_BASE) { $env:FOUNDRY_REMOTE_BASE } else { "/mnt/exdisk/foundryvtt/foundrydata-v14/Data/modules/physical-dice" })
)

$ErrorActionPreference = "Stop"

if (-not $Server) {
    $Server = Read-Host -Prompt "Enter Foundry SSH host (e.g. user@host)"
}

if (-not $Server) {
    Write-Error "Server SSH host is required for deployment."
    exit 1
}

if (-not $Password) {
    $SecurePass = Read-Host -Prompt "Enter SSH password for $Server (or press Enter if using SSH key)" -AsSecureString
    $Password = [System.Net.NetworkCredential]::new('', $SecurePass).Password
}

$PwArgs = if ($Password) { @("-pw", $Password) } else { @() }

Write-Host "Syncing entire physical-dice folder to $Server..." -ForegroundColor Cyan

$ScriptDir = if ($PSScriptRoot) { $PSScriptRoot } else { (Get-Location).Path }
$Excludes = @('.git', '.agents', 'deploy.ps1', 'scratch')
$Items = Get-ChildItem -Path $ScriptDir | Where-Object { $_.Name -notin $Excludes } | ForEach-Object { $_.FullName }

# Ensure remote target directory exists
plink.exe -batch @PwArgs $Server "mkdir -p $RemoteBase"

pscp.exe -batch @PwArgs -r $Items "${Server}:${RemoteBase}/"

# Restart Foundry via PM2
Write-Host "Restarting Foundry service..." -ForegroundColor Cyan
plink.exe -batch @PwArgs $Server "pm2 restart foundry"

Write-Host "Deployment complete." -ForegroundColor Green
