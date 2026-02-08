// Auto-update admin credentials on startup for PostgreSQL
const bcrypt = require('bcryptjs');
const { getDatabase, prepare } = require('../database/db');

async function updateAdminCredentials() {
    console.log('🔐 Checking admin credentials in PostgreSQL...');

    try {
        await getDatabase();
        const admin = await prepare("SELECT id FROM users WHERE username = 'admin'").get();

        if (!admin) {
            console.log('⚠️  Admin user not found in database');
            return;
        }

        const newPassword = bcrypt.hashSync('admin@123', 10);
        await prepare(`
            UPDATE users 
            SET password_hash = $1, full_name = $2, updated_at = CURRENT_TIMESTAMP
            WHERE username = 'admin'
        `).run(newPassword, 'فهد الجعيدي');

        console.log('✅ Admin credentials updated successfully!');
    } catch (error) {
        console.error('❌ Error updating admin credentials:', error.message);
    }
}

if (require.main === module) {
    updateAdminCredentials().then(() => process.exit(0)).catch(() => process.exit(1));
}

module.exports = { updateAdminCredentials };