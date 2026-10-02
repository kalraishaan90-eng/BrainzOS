# =============================================================================
# BrainzOS — Automated Database Backup (Windows PowerShell)
# =============================================================================
# Retention: 14 Days
# Usage: powershell -File scripts/backup-db.ps1
# Schedule via Windows Task Scheduler
# =============================================================================

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir
$BackupDir = Join-Path $ProjectRoot "backups"

if (!(Test-Path $BackupDir)) {
    New-Item -ItemType Directory -Path $BackupDir | Out-Null
}

$Timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$BackupFile = Join-Path $BackupDir "brainzos_backup_$Timestamp.dump"

Write-Host "Starting database dump from 'brainzos-db' to $BackupFile..."

# Stream custom format dump from container
& docker exec brainzos-db pg_dump -U postgres -d postgres -F c > $BackupFile

if ((Get-Item $BackupFile).Length -lt 1024) {
    Write-Error "Backup file is suspiciously small or empty. Check docker status."
    exit 1
}

# Generate SHA256 checksum
$Hash = (Get-FileHash -Path $BackupFile -Algorithm SHA256).Hash
Set-Content -Path "$BackupFile.sha256" -Value "$Hash  brainzos_backup_$Timestamp.dump"

Write-Host "Backup created: $BackupFile ($((Get-Item $BackupFile).Length) bytes)"
Write-Host "SHA256: $Hash"

# Retention policy: Remove backups older than 14 days
$Cutoff = (Get-Date).AddDays(-14)
Get-ChildItem -Path $BackupDir -Filter "brainzos_backup_*.dump*" | Where-Object { $_.LastWriteTime -lt $Cutoff } | ForEach-Object {
    Write-Host "Pruning expired backup: $($_.Name)"
    Remove-Item $_.FullName -Force
}

Write-Host "Backup job completed."
