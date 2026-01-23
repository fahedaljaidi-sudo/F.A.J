#!/bin/bash

# FAJ Security System - Database Reset Script
# This script will reset the database and create a fresh one with new admin credentials

echo "🔄 Starting database reset..."

# Navigate to backend directory
cd /app/backend || cd backend

# Backup existing database if it exists
if [ -f "database/security.db" ]; then
    echo "📦 Backing up existing database..."
    cp database/security.db database/backup_$(date +%Y%m%d_%H%M%S).db
    echo "✓ Backup created"
fi

# Remove old database
echo "🗑️  Removing old database..."
rm -f database/security.db

# Initialize new database with updated admin credentials
echo "🔧 Creating new database..."
node database/init.js

# Restart the application
echo "🔄 Restarting application..."
pm2 restart all || npm run start

echo "✅ Database reset complete!"
echo "📝 New admin credentials:"
echo "   Username: admin"
echo "   Password: admin@123"
echo "   Name: فهد الجعيدي"
