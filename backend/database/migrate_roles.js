const { getDatabase, saveDatabase } = require('./db');

async function migrateRoles() {
    console.log('🔄 Starting Roles Migration (Shared Instance)...');

    try {
        const db = await getDatabase();

        // Check if migration is needed
        // We use db.exec because we need raw access
        try {
            const result = db.exec("SELECT sql FROM sqlite_master WHERE type='table' AND name='users'");
            const currentSchema = result[0]?.values[0][0] || '';

            if (currentSchema.includes('operations_manager')) {
                console.log('✅ Users table already has new roles. Skipping migration.');
                return;
            }
        } catch (e) {
            console.log('Checking schema failed, assuming migration might be needed or fresh DB');
        }

        console.log('⚠️ Schema update needed. Starting migration...');

        try {
            db.run('BEGIN TRANSACTION');

            // 0. Cleanup previous failed attempts
            db.run('DROP TABLE IF EXISTS users_old');

            // 1. Rename existing table
            console.log('📦 Renaming old users table...');
            db.run('ALTER TABLE users RENAME TO users_old');

            // 2. Create new table with updated constraints
            console.log('✨ Creating new users table...');
            db.run(`
                CREATE TABLE users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    username TEXT UNIQUE NOT NULL,
                    password_hash TEXT NOT NULL,
                    full_name TEXT NOT NULL,
                    email TEXT,
                    role TEXT CHECK(role IN ('admin', 'supervisor', 'guard', 'operations_manager', 'hr_manager', 'safety_officer')) DEFAULT 'guard',
                    unit_number TEXT,
                    is_active INTEGER DEFAULT 1,
                    created_at TEXT DEFAULT (datetime('now')),
                    updated_at TEXT DEFAULT (datetime('now'))
                )
            `);

            // 3. Copy data with dynamic column detection
            console.log('🚚 Copying data with schema check...');

            // Get columns from users_old
            const oldTableInfo = db.exec("PRAGMA table_info(users_old)");
            const oldColumns = oldTableInfo[0].values.map(col => col[1]);

            // Define expected new columns
            const newColumns = ['id', 'username', 'password_hash', 'full_name', 'email', 'role', 'unit_number', 'is_active', 'created_at', 'updated_at'];

            // intersection of columns that exist in both
            const commonColumns = newColumns.filter(col => oldColumns.includes(col));

            const columnsStr = commonColumns.join(', ');

            // If is_active is missing in old data, we let the default value (1) handle it in the new table
            // We only insert what we have

            const copyQuery = `
                INSERT INTO users (${columnsStr})
                SELECT ${columnsStr}
                FROM users_old
            `;

            console.log(`📝 Executing copy: ${copyQuery}`);
            db.run(copyQuery);

            // 4. Drop old table
            console.log('🗑️ Dropping old table...');
            db.run('DROP TABLE users_old');

            db.run('COMMIT');

            // Save database explicit call
            saveDatabase();

            console.log('✅ Migration completed successfully!');

        } catch (error) {
            console.error('⚠️ Migration failed:', error);
            try { db.run('ROLLBACK'); } catch (e) { }
            throw error;
        }

    } catch (error) {
        console.error('❌ Critical migration error:', error);
    }
}

// Run if called directly
if (require.main === module) {
    migrateRoles();
}

module.exports = migrateRoles;
