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
        // On SaaS, we rely on migrations or the fix script for full setup
        // But we ensure basic structures exist
        await pool.query(`CREATE TABLE IF NOT EXISTS companies (id SERIAL PRIMARY KEY, name TEXT NOT NULL, company_code TEXT UNIQUE NOT NULL, status TEXT DEFAULT 'active', expiry_date TIMESTAMP WITH TIME ZONE DEFAULT (CURRENT_TIMESTAMP + INTERVAL '30 days'))`);
        await pool.query(`CREATE TABLE IF NOT EXISTS users (id SERIAL PRIMARY KEY, company_id INTEGER REFERENCES companies(id), username TEXT NOT NULL, password_hash TEXT NOT NULL, full_name TEXT NOT NULL, role TEXT DEFAULT 'guard')`);
        
        // Ensure FAJ001 exists for default operations
        await pool.query(`INSERT INTO companies (name, company_code) VALUES ('FAJ Security System', 'FAJ001') ON CONFLICT DO NOTHING`);
        
        dbInitialized = true;
        return pool;
    } catch (error) {
        console.error('❌ DB Connection Error:', error.message);
        throw error;
    }
}

function prepare(sql) {
    return {
        run: (...params) => pool.query(sql, params),
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
