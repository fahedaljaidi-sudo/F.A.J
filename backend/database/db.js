const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

// Helper to sanitize connection string for logging
const getSafeUrl = (url) => {
    if (!url) return 'NOT FOUND';
    try {
        const parts = url.split('@');
        if (parts.length > 1) {
            return 'postgres://****:****@' + parts[1];
        }
        return 'EXISTS (HIDDEN)';
    } catch (e) { return 'EXISTS'; }
};

console.log('--- 🛠️ Database Environment Check ---');
console.log('DATABASE_URL:', getSafeUrl(process.env.DATABASE_URL));
console.log('NODE_ENV:', process.env.NODE_ENV || 'production');

// Define connection config
let poolConfig = {};

if (process.env.DATABASE_URL) {
    console.log('✅ Using DATABASE_URL connection (Railway Mode)');
    poolConfig = {
        connectionString: process.env.DATABASE_URL,
        ssl: {
            rejectUnauthorized: false
        }
    };
} else {
    console.log('⚠️ No DATABASE_URL found. Falling back to local defaults.');
    poolConfig = {
        user: process.env.DB_USER || 'postgres',
        host: process.env.DB_HOST || 'localhost',
        database: process.env.DB_NAME || 'faj_security',
        password: process.env.DB_PASSWORD || 'password',
        port: process.env.DB_PORT || 5432,
        ssl: false
    };
}

const pool = new Pool(poolConfig);

let dbInitialized = false;
let initializationPromise = null;

async function getDatabase() {
    if (dbInitialized) return pool;
    if (initializationPromise) return initializationPromise;

    initializationPromise = (async () => {
        try {
            console.log('🐘 Attempting to connect to PostgreSQL...');
            const res = await pool.query('SELECT 1 as connected');
            console.log('✅ PostgreSQL Connection Verified:', res.rows[0].connected);
            
            await initializeSchema();
            
            dbInitialized = true;
            return pool;
        } catch (error) {
            console.error('❌ PostgreSQL Connection Error Details:');
            console.error('Code:', error.code);
            console.error('Message:', error.message);
            initializationPromise = null;
            throw error;
        }
    })();

    return initializationPromise;
}

async function initializeSchema() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        console.log('📋 Validating PostgreSQL Tables...');

        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                full_name TEXT NOT NULL,
                email TEXT,
                role TEXT CHECK(role IN ('admin', 'supervisor', 'guard', 'operations_manager', 'hr_manager', 'safety_officer')) DEFAULT 'guard',
                unit_number TEXT,
                is_active INTEGER DEFAULT 1,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS visitors (
                id SERIAL PRIMARY KEY,
                full_name TEXT NOT NULL,
                id_number TEXT NOT NULL,
                phone TEXT,
                company TEXT,
                host_name TEXT,
                visit_reason TEXT,
                entry_time TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
                exit_time TIMESTAMP WITH TIME ZONE,
                status TEXT CHECK(status IN ('inside', 'left')) DEFAULT 'inside',
                registered_by INTEGER REFERENCES users(id),
                gate_number TEXT DEFAULT '1',
                notes TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS patrol_rounds (
                id SERIAL PRIMARY KEY,
                guard_id INTEGER NOT NULL REFERENCES users(id),
                location TEXT NOT NULL,
                security_status TEXT CHECK(security_status IN ('normal', 'observation', 'danger')) DEFAULT 'normal',
                resolution_status TEXT CHECK(resolution_status IN ('pending', 'in_progress', 'closed')) DEFAULT 'pending',
                notes TEXT,
                attachments TEXT,
                patrol_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS locations (
                id SERIAL PRIMARY KEY,
                name_ar TEXT NOT NULL,
                name_en TEXT,
                location_code TEXT UNIQUE
            )
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS activity_log (
                id SERIAL PRIMARY KEY,
                event_type TEXT NOT NULL,
                event_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                description TEXT,
                user_id INTEGER REFERENCES users(id),
                visitor_id INTEGER REFERENCES visitors(id),
                patrol_id INTEGER REFERENCES patrol_rounds(id),
                location TEXT,
                status TEXT
            )
        `);

        const adminCheck = await client.query("SELECT id FROM users WHERE username = 'admin'");
        if (adminCheck.rows.length === 0) {
            const adminPassword = bcrypt.hashSync('admin@123', 10);
            await client.query(`
                INSERT INTO users (username, password_hash, full_name, email, role, unit_number)
                VALUES ($1, $2, $3, $4, $5, $6)
            `, ['admin', adminPassword, 'فهد الجعيدي', 'admin@company.local', 'admin', 'ADM-001']);
        }

        const locCheck = await client.query("SELECT id FROM locations LIMIT 1");
        if (locCheck.rows.length === 0) {
            const locations = [
                ['حرم المصنع الشمالي', 'North Factory Perimeter', 'factory-north'],
                ['حرم المصنع الشرقي', 'East Factory Perimeter', 'factory-east'],
                ['البوابة الرئيسية', 'Main Gate', 'main-gate'],
                ['مستودع أ', 'Warehouse A', 'warehouse-a'],
                ['المبنى الإداري', 'Admin Building', 'admin-building']
            ];
            for (const loc of locations) {
                await client.query('INSERT INTO locations (name_ar, name_en, location_code) VALUES ($1, $2, $3)', loc);
            }
        }

        await client.query('COMMIT');
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

async function run(sql, params = []) {
    try {
        let adaptedSql = sql.replace(/datetime\('now'\)/g, 'CURRENT_TIMESTAMP');
        if (adaptedSql.toLowerCase().trim().startsWith('insert into') && !adaptedSql.toLowerCase().includes('returning')) {
            adaptedSql += ' RETURNING id';
        }
        const result = await pool.query(adaptedSql, params);
        return { 
            lastInsertRowid: result.rows[0]?.id || null,
            rowCount: result.rowCount 
        };
    } catch (error) {
        console.error('❌ Database run error:', error.message);
        throw error;
    }
}

async function get(sql, ...params) {
    try {
        const result = await pool.query(sql, params);
        return result.rows[0] || null;
    } catch (error) {
        console.error('❌ Database get error:', error.message);
        throw error;
    }
}

async function all(sql, ...params) {
    try {
        const result = await pool.query(sql, params);
        return result.rows;
    } catch (error) {
        console.error('❌ Database all error:', error.message);
        throw error;
    }
}

function prepare(sql) {
    return {
        run: (...params) => run(sql, params),
        get: (...params) => get(sql, ...params),
        all: (...params) => all(sql, ...params)
    };
}

module.exports = { getDatabase, prepare, run, get, all, pool };