const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const dbPath = (() => {
    // Check if we are in production with a volume mounted at /app/data
    const volumePath = '/app/data';
    try {
        if (fs.existsSync(volumePath)) {
            console.log('💾 Migration: Using Persistent Volume at /app/data');
            return path.join(volumePath, 'auth.db');
        }
    } catch (e) { }

    console.log('💾 Migration: Using local security.db');
    return path.join(__dirname, 'security.db');
})();

async function migrateRoles() {
    console.log('🔄 Starting Roles Migration...');

    if (!fs.existsSync(dbPath)) {
        console.log('❌ Database file not found. Skipping migration.');
        return;
    }

    try {
        const SQL = await initSqlJs();
        const filebuffer = fs.readFileSync(dbPath);
        const db = new SQL.Database(filebuffer);

        // Check if migration is needed
        const result = db.exec("SELECT sql FROM sqlite_master WHERE type='table' AND name='users'");
        const currentSchema = result[0]?.values[0][0] || '';

        if (currentSchema.includes('operations_manager')) {
            console.log('✅ Users table already has new roles. Skipping migration.');
            db.close();
            return;
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

            // 3. Copy data
            console.log('🚚 Copying data...');
            db.run(`
                INSERT INTO users (id, username, password_hash, full_name, email, role, unit_number, is_active, created_at, updated_at)
                SELECT id, username, password_hash, full_name, email, role, unit_number, is_active, created_at, updated_at
                FROM users_old
            `);

            // 4. Drop old table
            console.log('🗑️ Dropping old table...');
            db.run('DROP TABLE users_old');

            db.run('COMMIT');

            // Save database
            const data = db.export();
            const buffer = Buffer.from(data);
            fs.writeFileSync(dbPath, buffer);

            console.log('✅ Migration completed successfully!');

        } catch (error) {
            console.error('⚠️ Migration failed:', error);
            db.run('ROLLBACK');
            throw error;
        } finally {
            db.close();
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
