const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

// PostgreSQL Connection Pool
// In production, these should be set via environment variables
const pool = new Pool({
    connectionString: process.env.DATABASE_URL, // Railway/Heroku/Vercel standard
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'faj_security',
    password: process.env.DB_PASSWORD || 'password',
    port: process.env.DB_PORT || 5432,
    ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false // Enable SSL for production
});

let dbInitialized = false;

/**
 * Initialize the PostgreSQL database schema
 */
async function getDatabase() {
    if (dbInitialized) return pool;

    try {
        console.log('🐘 Connecting to PostgreSQL...');
        
        // Test connection
        await pool.query('SELECT NOW()');
        
        // Initialize Schema
        await initializeSchema();
        
        dbInitialized = true;
        return pool;
    } catch (error) {
        console.error('❌ PostgreSQL Connection Error:', error.message);
        throw error;
    }
}

async function initializeSchema() {
    console.log('📋 Initializing PostgreSQL Schema...');

    // Users table
    await pool.query(`
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

    // Visitors table
    await pool.query(`
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

    // Patrol Rounds table
    await pool.query(`
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

    // Locations table
    await pool.query(`
        CREATE TABLE IF NOT EXISTS locations (
            id SERIAL PRIMARY KEY,
            name_ar TEXT NOT NULL,
            name_en TEXT,
            location_code TEXT UNIQUE
        )
    `);

    // Activity Log table
    await pool.query(`
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

    // Seed admin if not exists
    const adminCheck = await pool.query("SELECT id FROM users WHERE username = 'admin'");
    if (adminCheck.rows.length === 0) {
        console.log('📦 Seeding default admin...');
        const adminPassword = bcrypt.hashSync('admin@123', 10);
        await pool.query(`
            INSERT INTO users (username, password_hash, full_name, email, role, unit_number)
            VALUES ($1, $2, $3, $4, $5, $6)
        `, ['admin', adminPassword, 'فهد الجعيدي', 'admin@company.local', 'admin', 'ADM-001']);
    }
}

// PostgreSQL Helper Functions (Asynchronous)

async function run(sql, params = []) {
    try {
        // Adapt SQLite queries to Postgres if needed
        let adaptedSql = sql.replace(/datetime\('now'\)/g, 'CURRENT_TIMESTAMP');
        
        // Handle lastInsertRowid equivalent in Postgres via RETURNING
        if (adaptedSql.toLowerCase().includes('insert into') && !adaptedSql.toLowerCase().includes('returning')) {
            adaptedSql += ' RETURNING id';
        }

        const result = await pool.query(adaptedSql, params);
        return { 
            lastInsertRowid: result.rows[0]?.id || null,
            rowCount: result.rowCount 
        };
    } catch (error) {
        console.error('❌ Database run error:', error);
        throw error;
    }
}

async function get(sql, ...params) {
    try {
        const result = await pool.query(sql, params);
        return result.rows[0] || null;
    } catch (error) {
        console.error('❌ Database get error:', error);
        throw error;
    }
}

async function all(sql, ...params) {
    try {
        const result = await pool.query(sql, params);
        return result.rows;
    } catch (error) {
        console.error('❌ Database all error:', error);
        throw error;
    }
}

// Prepare statement wrapper (Compatibility layer)
function prepare(sql) {
    return {
        run: (...params) => run(sql, params),
        get: (...params) => get(sql, ...params),
        all: (...params) => all(sql, ...params)
    };
}

module.exports = {
    getDatabase,
    prepare,
    run,
    get,
    all,
    pool // Export pool for complex queries
};