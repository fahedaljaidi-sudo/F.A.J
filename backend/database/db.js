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
        
        // 1. Companies
        await pool.query(`CREATE TABLE IF NOT EXISTS companies (
            id SERIAL PRIMARY KEY, 
            name TEXT NOT NULL, 
            company_code TEXT UNIQUE NOT NULL, 
            status TEXT DEFAULT 'active'
        )`);

        // Add missing columns to Companies
        const companyColumns = [
            { name: 'subscription_plan', type: "TEXT DEFAULT 'basic'" },
            { name: 'max_users', type: 'INTEGER DEFAULT 10' },
            { name: 'expiry_date', type: "TIMESTAMP WITH TIME ZONE DEFAULT (CURRENT_TIMESTAMP + INTERVAL '30 days')" },
            { name: 'created_at', type: 'TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP' },
            { name: 'updated_at', type: 'TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP' }
        ];

        for (const col of companyColumns) {
            try {
                await pool.query(`ALTER TABLE companies ADD COLUMN IF NOT EXISTS ${col.name} ${col.type}`);
            } catch (err) {}
        }

        // 2. Users (Basic)
        await pool.query(`CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY, 
            company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE, 
            username TEXT NOT NULL, 
            password_hash TEXT NOT NULL, 
            full_name TEXT NOT NULL, 
            role TEXT DEFAULT 'guard'
        )`);

        // 3. Add missing columns to Users if they don't exist
        const userColumns = [
            { name: 'email', type: 'TEXT' },
            { name: 'unit_number', type: 'TEXT' },
            { name: 'is_active', type: 'INTEGER DEFAULT 1' },
            { name: 'allow_mobile_login', type: 'INTEGER DEFAULT 1' },
            { name: 'created_at', type: 'TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP' },
            { name: 'updated_at', type: 'TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP' }
        ];

        for (const col of userColumns) {
            try {
                await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS ${col.name} ${col.type}`);
            } catch (err) {
                // Ignore if column already exists (older PG versions might not support IF NOT EXISTS in ALTER TABLE)
            }
        }

        // 4. Visitors
        await pool.query(`CREATE TABLE IF NOT EXISTS visitors (
            id SERIAL PRIMARY KEY, 
            company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE, 
            full_name TEXT NOT NULL, 
            id_number TEXT NOT NULL, 
            phone TEXT,
            company TEXT,
            host_name TEXT,
            visit_reason TEXT,
            gate_number TEXT DEFAULT '1',
            notes TEXT,
            status TEXT DEFAULT 'inside', 
            entry_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, 
            exit_time TIMESTAMP WITH TIME ZONE,
            registered_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )`);

        // 5. Patrol Rounds
        await pool.query(`CREATE TABLE IF NOT EXISTS patrol_rounds (
            id SERIAL PRIMARY KEY, 
            company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE, 
            guard_id INTEGER REFERENCES users(id) ON DELETE CASCADE, 
            location TEXT NOT NULL, 
            security_status TEXT DEFAULT 'normal', 
            resolution_status TEXT DEFAULT 'pending',
            notes TEXT,
            attachments TEXT,
            patrol_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )`);

        // 6. Locations
        await pool.query(`CREATE TABLE IF NOT EXISTS locations (
            id SERIAL PRIMARY KEY, 
            company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE, 
            name_ar TEXT NOT NULL, 
            name_en TEXT,
            location_code TEXT,
            UNIQUE(company_id, location_code)
        )`);

        // 7. Activity Log
        await pool.query(`CREATE TABLE IF NOT EXISTS activity_log (
            id SERIAL PRIMARY KEY, 
            company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE, 
            event_type TEXT NOT NULL, 
            description TEXT, 
            user_id INTEGER REFERENCES users(id) ON DELETE SET NULL, 
            visitor_id INTEGER REFERENCES visitors(id) ON DELETE SET NULL,
            patrol_id INTEGER REFERENCES patrol_rounds(id) ON DELETE SET NULL,
            location TEXT,
            status TEXT,
            attachments TEXT,
            event_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )`);

        // 8. Role Permissions
        await pool.query(`CREATE TABLE IF NOT EXISTS role_permissions (
            id SERIAL PRIMARY KEY, 
            company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE, 
            role TEXT NOT NULL, 
            permission TEXT NOT NULL,
            UNIQUE(company_id, role, permission)
        )`);
        
        // Ensure FAJ001 exists for default operations
        await pool.query(`INSERT INTO companies (name, company_code) VALUES ('FAJ Security System', 'FAJ001') ON CONFLICT (company_code) DO NOTHING`);
        
        dbInitialized = true;
        return pool;
    } catch (error) {
        console.error('❌ DB Connection Error:', error.message);
        throw error;
    }
}

async function run(sql, params = []) {
    return pool.query(sql, params);
}

async function get(sql, ...params) {
    const res = await pool.query(sql, params);
    return res.rows[0] || null;
}

async function all(sql, ...params) {
    const res = await pool.query(sql, params);
    return res.rows;
}

function prepare(sql) {
    return {
        run: (...params) => run(sql, params),
        get: (...params) => get(sql, ...params),
        all: (...params) => all(sql, ...params)
    };
}

module.exports = { getDatabase, prepare, run, get, all, pool };
