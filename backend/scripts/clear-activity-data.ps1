# FAJ Security System - Clear Activity Data Script (Windows PowerShell)

Write-Host "🧹 Starting activity data cleanup..." -ForegroundColor Cyan
Write-Host "ℹ️  This will DELETE all Visitors, Patrol Rounds, and Activity Logs." -ForegroundColor Yellow
Write-Host "ℹ️  Users and Locations will be PRESERVED." -ForegroundColor Green

$confirmation = Read-Host "Are you sure you want to continue? (y/n)"
if ($confirmation -ne 'y') {
    Write-Host "❌ Operation cancelled." -ForegroundColor Red
    exit
}

# Set location to backend directory
$BackendPath = Join-Path (Get-Location) "backend"
if (Test-Path $BackendPath) {
    Set-Location $BackendPath
}

# Run the cleanup script
node scripts/clear-activity-data.js

Write-Host "✅ Done!" -ForegroundColor Green
