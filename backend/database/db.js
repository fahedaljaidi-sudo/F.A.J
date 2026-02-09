const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

// Log database configuration
console.log('--- 🛠️ Database Environment Check ---');
console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'EXISTS' : 'NOT FOUND');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'faj_security',
    password: process.env.DB_PASSWORD || 'password',
    port: process.env.DB_PORT || 5432,
    ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

let dbInitialized = false;
let initializationPromise = null;

async function getDatabase() {
    if (dbInitialized) return pool;
    if (initializationPromise) return initializationPromise;

    initializationPromise = (async () => {
        try {
            console.log('🐘 Attempting to connect to PostgreSQL...');
            await pool.query('SELECT 1');
            console.log('✅ Connected to PostgreSQL');
            
            await initializeSchema();
            await runMigrations(); // Add missing columns
            
            dbInitialized = true;
            return pool;
        } catch (error) {
            console.error('❌ PostgreSQL Initialization Error:', error);
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
        
        console.log('📋 Initializing PostgreSQL Schema...');

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
                allow_mobile_login INTEGER DEFAULT 1,
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
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
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
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
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
                status TEXT,
                attachments TEXT
            )
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS role_permissions (
                id SERIAL PRIMARY KEY,
                role TEXT NOT NULL,
                permission TEXT NOT NULL,
                UNIQUE(role, permission)
            )
        `);

        // Seed default permissions
        const permCheck = await client.query("SELECT COUNT(*) FROM role_permissions");
        if (parseInt(permCheck.rows[0].count) === 0) {
            const defaultPermissions = [
                ['admin', 'manage_users'],
                ['admin', 'manage_permissions'],
                ['admin', 'view_reports'],
                ['admin', 'manage_visitors'],
                ['admin', 'manage_patrols'],
                ['admin', 'mobile_login'],
                ['supervisor', 'view_reports'],
                ['supervisor', 'manage_visitors'],
                ['supervisor', 'manage_patrols'],
                ['supervisor', 'mobile_login'],
                ['guard', 'manage_visitors'],
                ['guard', 'manage_patrols'],
                ['guard', 'mobile_login'],
                ['operations_manager', 'view_reports'],
                ['operations_manager', 'mobile_login'],
                ['hr_manager', 'view_reports'],
                ['safety_officer', 'view_reports']
            ];
            for (const [role, perm] of defaultPermissions) {
                await client.query('INSERT INTO role_permissions (role, permission) VALUES ($1, $2)', [role, perm]);
            }
        }

        // Seed admin
        const adminCheck = await client.query("SELECT id FROM users WHERE username = 'admin'");
        if (adminCheck.rows.length === 0) {
            const adminPassword = bcrypt.hashSync('admin@123', 10);
            await client.query(`
                INSERT INTO users (username, password_hash, full_name, email, role, unit_number)
                VALUES ($1, $2, $3, $4, $5, $6)
            `, ['admin', adminPassword, 'فهد الجعيدي', 'admin@company.local', 'admin', 'ADM-001']);
        }

        await client.query('COMMIT');
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

async function runMigrations() {
    console.log('🔄 Checking for missing columns...');
    const client = await pool.connect();
    try {
        // Add updated_at to patrol_rounds if missing
        await client.query(`
            DO $$ 
            BEGIN 
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='patrol_rounds' AND column_name='updated_at') THEN
                    ALTER TABLE patrol_rounds ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
                END IF;
            END $$;
        `);

        // Add updated_at to visitors if missing
        await client.query(`
            DO $$ 
            BEGIN 
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='visitors' AND column_name='updated_at') THEN
                    ALTER TABLE visitors ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
                END IF;
            END $$;
        `);
        
        // Add attachments to activity_log if missing
        await client.query(`
            DO $$ 
            BEGIN 
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='activity_log' AND column_name='attachments') THEN
                    ALTER TABLE activity_log ADD COLUMN attachments TEXT;
                END IF;
            END $$;
        `);

        // Add allow_mobile_login to users if missing
        await client.query(`
            DO $$ 
            BEGIN 
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='allow_mobile_login') THEN
                    ALTER TABLE users ADD COLUMN allow_mobile_login INTEGER DEFAULT 1;
                END IF;
            END $$;
        `);
        
        console.log('✅ Migrations complete');
    } catch (e) {
        console.error('⚠️ Migration warning:', e.message);
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
