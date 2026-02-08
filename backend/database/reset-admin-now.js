// Auto-update admin credentials for PostgreSQL
const bcrypt = require('bcryptjs');
const { getDatabase, prepare } = require('./db');

async function resetAdminNow() {
    console.log('🔐 Resetting admin credentials in PostgreSQL...');

    try {
        await getDatabase();
        const admin = await prepare("SELECT id FROM users WHERE username = 'admin'").get();

        if (!admin) {
            console.log('⚠️  Admin user not found in database. Please run init-db first.');
            return;
        }

        const newPassword = bcrypt.hashSync('admin@123', 10);
        await prepare(`
            UPDATE users 
            SET password_hash = $1, full_name = $2, updated_at = CURRENT_TIMESTAMP
            WHERE username = 'admin'
        `).run(newPassword, 'فهد الجعيدي');

        console.log('✅ Admin credentials reset successfully!');
        console.log('Username: admin');
        console.log('Password: admin@123');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error resetting admin credentials:', error.message);
        process.exit(1);
    }
}

resetAdminNow();