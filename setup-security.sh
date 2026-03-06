#!/bin/bash
# 🔒 Security Setup Script for Office Map
# This script helps generate required security tokens

echo "================================"
echo "🔒 Office Map Security Setup"
echo "================================"
echo ""

# Generate SESSION_SECRET
echo "Generating SESSION_SECRET..."
SESSION_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
echo "✓ SESSION_SECRET generated: $SESSION_SECRET"
echo ""

# Generate ADMIN_RESET_TOKEN
echo "Generating ADMIN_RESET_TOKEN (optional, for emergency resets)..."
ADMIN_RESET_TOKEN=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
echo "✓ ADMIN_RESET_TOKEN generated: $ADMIN_RESET_TOKEN"
echo ""

# Create .env if it doesn't exist
if [ ! -f .env ]; then
    echo "Creating .env file from .env.example..."
    cp .env.example .env
    echo "✓ .env file created"
else
    echo "⚠️  .env file already exists"
fi

echo ""
echo "================================"
echo "📝 Add these values to your .env file:"
echo "================================"
echo ""
echo "SESSION_SECRET=$SESSION_SECRET"
echo "ADMIN_RESET_TOKEN=$ADMIN_RESET_TOKEN"
echo ""
echo "Then configure these required variables:"
echo "DATABASE_URL=postgresql://user:password@localhost:5432/office_map"
echo "CORS_ORIGIN=http://localhost:5000"
echo "NODE_ENV=development"
echo ""
echo "================================"
echo "✓ Setup complete!"
echo "Run 'npm install' then 'npm run dev' to start the application"
echo "================================"
