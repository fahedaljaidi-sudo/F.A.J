// Simple standalone script to reset admin password
// Run this with: node reset-admin-now.js

const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

async function resetAdminNow() {
    try {
        console.log('🔄 Starting admin password reset...');

        const initSqlJs = require('sql.js');
        const dbPath = path.join(__dirname, '../database/security.db');

        // Check if database exists
        if (!fs.existsSync(dbPath)) {
            console.error('❌ Database file not found at:', dbPath);
            console.log('Creating new database with init.js instead...');
            require('./init');
            return;
        }

        // Load database
        const SQL = await initSqlJs();
        const fileBuffer = fs.readFileSync(dbPath);
        const db = new SQL.Database(fileBuffer);

        // Hash new password
        const newPassword = bcrypt.hashSync('admin@123', 10);
        const newName = 'فهد الجعيدي';

        // Update admin
        db.run(`
            UPDATE users 
            SET password_hash = ?, full_name = ?, updated_at = datetime('now')
            WHERE username = 'admin'
        `, [newPassword, newName]);

        // Save database
        const data = db.export();
        const buffer = Buffer.from(data);
        fs.writeFileSync(dbPath, buffer);

        db.close();

        console.log('✅ Admin password reset successful!');
        console.log('────────────────────────────────');
        console.log('Username: admin');
        console.log('Password: admin@123');
        console.log('Name: فهد الجعيدي');
        console.log('────────────────────────────────');
        console.log('You can now login with these credentials!');

    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error(error);
    }
}

resetAdminNow();
