# FAJ Security System - Database Reset Script (Windows PowerShell)

Write-Host "🔄 Starting database reset..." -ForegroundColor Cyan

# Set location to backend directory
$BackendPath = Join-Path (Get-Location) "backend"
if (Test-Path $BackendPath) {
    Set-Location $BackendPath
}

# Define database paths
$DbPath = "database\security.db"
$BackupPath = "database\backup_$(Get-Date -Format 'yyyyMMdd_HHmmss').db"

# Backup existing database if it exists
if (Test-Path $DbPath) {
    Write-Host "📦 Backing up existing database..." -ForegroundColor Yellow
    Copy-Item $DbPath $BackupPath
    Write-Host "✓ Backup created at $BackupPath" -ForegroundColor Green
}

# Remove old database
Write-Host "🗑️  Removing old database..." -ForegroundColor Yellow
if (Test-Path $DbPath) {
    Remove-Item $DbPath -Force
}

# Initialize new database
Write-Host "🔧 Creating new database..." -ForegroundColor Cyan
node database/init.js

Write-Host "✅ Database reset complete!" -ForegroundColor Green
Write-Host "📝 New admin credentials:" -ForegroundColor White
Write-Host "   Username: admin" -ForegroundColor White
Write-Host "   Password: admin@123" -ForegroundColor White
