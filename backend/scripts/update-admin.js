// Auto-update admin credentials on startup
// This script runs when the server starts and ensures admin credentials are correct

const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');
const initSqlJs = require('sql.js');

const dbPath = path.join(__dirname, '../database/security.db');

async function updateAdminCredentials() {
    console.log('🔐 Checking admin credentials...');

    try {
        // Check if database exists
        if (!fs.existsSync(dbPath)) {
            console.log('⚠️  Database not found, will be created on first request');
            return;
        }

        const SQL = await initSqlJs();
        const fileBuffer = fs.readFileSync(dbPath);
        const db = new SQL.Database(fileBuffer);

        // Check if admin exists
        const adminCheck = db.exec("SELECT id, username, full_name FROM users WHERE username = 'admin'");

        if (adminCheck.length === 0 || !adminCheck[0].values || adminCheck[0].values.length === 0) {
            console.log('⚠️  Admin user not found in database');
            db.close();
            return;
        }

        // Update admin credentials
        const newPassword = bcrypt.hashSync('admin@123', 10);
        const newFullName = 'فهد الجعيدي';

        db.run(`
            UPDATE users 
            SET password_hash = ?, full_name = ?, updated_at = datetime('now')
            WHERE username = 'admin'
        `, [newPassword, newFullName]);

        // Save database
        const data = db.export();
        const buffer = Buffer.from(data);
        fs.writeFileSync(dbPath, buffer);

        db.close();

        console.log('✅ Admin credentials updated successfully!');
        console.log('   Username: admin');
        console.log('   Password: admin@123');
        console.log('   Name: فهد الجعيدي');
    } catch (error) {
        console.error('❌ Error updating admin credentials:', error.message);
    }
}

// Auto-run if called directly
if (require.main === module) {
    updateAdminCredentials().then(() => {
        console.log('✅ Update complete');
        process.exit(0);
    }).catch(err => {
        console.error('❌ Update failed:', err);
        process.exit(1);
    });
}

module.exports = { updateAdminCredentials };
