const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

let dbInitialized = false;

async function getDatabase() {
    if (dbInitialized) return pool;
    try {
        await pool.query('SELECT 1');
        await initializeSchema();
        await runMigrations();
        dbInitialized = true;
        return pool;
    } catch (error) {
        console.error('❌ DB Init Error:', error.message);
        throw error;
    }
}

async function initializeSchema() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        // Basic Tables Only
        await client.query(`CREATE TABLE IF NOT EXISTS companies (id SERIAL PRIMARY KEY, name TEXT NOT NULL, company_code TEXT UNIQUE NOT NULL, status TEXT DEFAULT 'active', expiry_date TIMESTAMP WITH TIME ZONE DEFAULT (CURRENT_TIMESTAMP + INTERVAL '30 days'))`);
        await client.query(`CREATE TABLE IF NOT EXISTS users (id SERIAL PRIMARY KEY, username TEXT NOT NULL, password_hash TEXT NOT NULL, full_name TEXT NOT NULL, role TEXT DEFAULT 'guard')`);
        await client.query(`CREATE TABLE IF NOT EXISTS visitors (id SERIAL PRIMARY KEY, full_name TEXT NOT NULL, id_number TEXT NOT NULL, status TEXT DEFAULT 'inside')`);
        await client.query(`CREATE TABLE IF NOT EXISTS patrol_rounds (id SERIAL PRIMARY KEY, location TEXT NOT NULL, security_status TEXT DEFAULT 'normal')`);
        await client.query(`CREATE TABLE IF NOT EXISTS locations (id SERIAL PRIMARY KEY, name_ar TEXT NOT NULL, location_code TEXT)`);
        await client.query(`CREATE TABLE IF NOT EXISTS activity_log (id SERIAL PRIMARY KEY, event_type TEXT NOT NULL, description TEXT)`);
        await client.query(`CREATE TABLE IF NOT EXISTS role_permissions (id SERIAL PRIMARY KEY, role TEXT NOT NULL, permission TEXT NOT NULL)`);
        await client.query('COMMIT');
    } catch (e) {
        await client.query('ROLLBACK');
        throw e;
    } finally {
        client.release();
    }
}

async function runMigrations() {
    console.log('🔄 Running Multi-tenant Migrations...');
    // We run migrations WITHOUT a transaction to avoid the "aborted transaction" block
    const tables = ['users', 'visitors', 'patrol_rounds', 'locations', 'activity_log', 'role_permissions'];
    
    // Ensure default company exists first
    await pool.query(`INSERT INTO companies (name, company_code, status) VALUES ('FAJ Security System', 'FAJ001', 'active') ON CONFLICT (company_code) DO NOTHING`);
    const defaultCompany = await pool.query("SELECT id FROM companies WHERE company_code = 'FAJ001'");
    const defId = defaultCompany.rows[0].id;

    for (const table of tables) {
        try {
            await pool.query(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES companies(id) DEFAULT ${defId}`);
            await pool.query(`UPDATE ${table} SET company_id = ${defId} WHERE company_id IS NULL`);
        } catch (e) { /* Column might exist */ }
    }

    // Update Role Check
    try {
        await pool.query(`ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check`);
        await pool.query(`ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('super_admin', 'admin', 'supervisor', 'guard', 'operations_manager', 'hr_manager', 'safety_officer'))`);
    } catch (e) {}

    console.log('✅ Migrations Done');
}

function prepare(sql) {
    return {
        run: (...params) => pool.query(sql.replace(/\$\d+/g, (m, i) => m), params),
        get: async (...params) => {
            const res = await pool.query(sql, params);
            return res.rows[0] || null;
        },
        all: async (...params) => {
            const res = await pool.query(sql, params);
            return res.rows;
        }
    };
}

module.exports = { getDatabase, prepare, pool };