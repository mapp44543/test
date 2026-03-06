# 🔒 Security Setup Script for Office Map (PowerShell)
# This script helps generate required security tokens on Windows

Write-Host "================================" -ForegroundColor Cyan
Write-Host "🔒 Office Map Security Setup" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

# Generate SESSION_SECRET
Write-Host "Generating SESSION_SECRET..." -ForegroundColor Yellow
$SESSION_SECRET = node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
Write-Host "✓ SESSION_SECRET generated: $SESSION_SECRET" -ForegroundColor Green
Write-Host ""

# Generate ADMIN_RESET_TOKEN
Write-Host "Generating ADMIN_RESET_TOKEN (optional, for emergency resets)..." -ForegroundColor Yellow
$ADMIN_RESET_TOKEN = node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
Write-Host "✓ ADMIN_RESET_TOKEN generated: $ADMIN_RESET_TOKEN" -ForegroundColor Green
Write-Host ""

# Create .env if it doesn't exist
if (!(Test-Path ".env")) {
    Write-Host "Creating .env file from .env.example..." -ForegroundColor Yellow
    Copy-Item ".env.example" ".env"
    Write-Host "✓ .env file created" -ForegroundColor Green
} else {
    Write-Host "⚠️  .env file already exists" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "================================" -ForegroundColor Cyan
Write-Host "📝 Add these values to your .env file:" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "SESSION_SECRET=$SESSION_SECRET" -ForegroundColor Magenta
Write-Host "ADMIN_RESET_TOKEN=$ADMIN_RESET_TOKEN" -ForegroundColor Magenta
Write-Host ""
Write-Host "Then configure these required variables:" -ForegroundColor Yellow
Write-Host "DATABASE_URL=postgresql://user:password@localhost:5432/office_map"
Write-Host "CORS_ORIGIN=http://localhost:5000"
Write-Host "NODE_ENV=development"
Write-Host ""
Write-Host "================================" -ForegroundColor Cyan
Write-Host "✓ Setup complete!" -ForegroundColor Green
Write-Host "Run 'npm install' then 'npm run dev' to start the application" -ForegroundColor Green
Write-Host "================================" -ForegroundColor Cyan
