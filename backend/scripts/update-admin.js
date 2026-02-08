// Auto-update admin credentials on startup
// This script runs when the server starts and ensures admin credentials are correct

const bcrypt = require('bcryptjs');
const { getDatabase, prepare } = require('../database/db');

async function updateAdminCredentials() {
    console.log('🔐 Checking admin credentials...');

    try {
        // Ensure database is initialized
        const db = await getDatabase();

        // Check if admin exists using the shared prepare helper
        const admin = prepare("SELECT id, username, full_name FROM users WHERE username = 'admin'").get();

        if (!admin) {
            console.log('⚠️  Admin user not found in database');
            return;
        }

        // Update admin credentials using the shared run helper (which also saves to disk)
        const newPassword = bcrypt.hashSync('admin@123', 10);
        const newFullName = 'فهد الجعيدي';

        prepare(`
            UPDATE users 
            SET password_hash = ?, full_name = ?, updated_at = datetime('now')
            WHERE username = 'admin'
        `).run(newPassword, newFullName);

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
