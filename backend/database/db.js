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

        // 1. Create Companies Table
        await client.query(`
            CREATE TABLE IF NOT EXISTS companies (
                id SERIAL PRIMARY KEY,
                name TEXT NOT NULL,
                company_code TEXT UNIQUE NOT NULL,
                subscription_plan TEXT DEFAULT 'basic',
                expiry_date TIMESTAMP WITH TIME ZONE DEFAULT (CURRENT_TIMESTAMP + INTERVAL '30 days'),
                status TEXT CHECK(status IN ('active', 'suspended', 'expired')) DEFAULT 'active',
                max_users INTEGER DEFAULT 10,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Seed default company if none exists
        const companyCheck = await client.query("SELECT id FROM companies LIMIT 1");
        let defaultCompanyId = 1;
        if (companyCheck.rows.length === 0) {
            const result = await client.query(`
                INSERT INTO companies (name, company_code, subscription_plan, status)
                VALUES ($1, $2, $3, $4) RETURNING id
            `, ['FAJ Security System', 'FAJ001', 'enterprise', 'active']);
            defaultCompanyId = result.rows[0].id;
        } else {
            defaultCompanyId = companyCheck.rows[0].id;
        }

        // 2. Create Users Table
        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                company_id INTEGER REFERENCES companies(id) DEFAULT ${defaultCompanyId},
                username TEXT NOT NULL,
                password_hash TEXT NOT NULL,
                full_name TEXT NOT NULL,
                email TEXT,
                role TEXT CHECK(role IN ('super_admin', 'admin', 'supervisor', 'guard', 'operations_manager', 'hr_manager', 'safety_officer')) DEFAULT 'guard',
                unit_number TEXT,
                is_active INTEGER DEFAULT 1,
                allow_mobile_login INTEGER DEFAULT 1,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(company_id, username)
            )
        `);

        // ... rest of tables unchanged ...

        // 3. Create Visitors Table
        await client.query(`
            CREATE TABLE IF NOT EXISTS visitors (
                id SERIAL PRIMARY KEY,
                company_id INTEGER REFERENCES companies(id) DEFAULT ${defaultCompanyId},
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

        // 4. Create Patrol Rounds Table
        await client.query(`
            CREATE TABLE IF NOT EXISTS patrol_rounds (
                id SERIAL PRIMARY KEY,
                company_id INTEGER REFERENCES companies(id) DEFAULT ${defaultCompanyId},
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

        // 5. Create Locations Table
        await client.query(`
            CREATE TABLE IF NOT EXISTS locations (
                id SERIAL PRIMARY KEY,
                company_id INTEGER REFERENCES companies(id) DEFAULT ${defaultCompanyId},
                name_ar TEXT NOT NULL,
                name_en TEXT,
                location_code TEXT,
                UNIQUE(company_id, location_code)
            )
        `);

        // 6. Create Activity Log Table
        await client.query(`
            CREATE TABLE IF NOT EXISTS activity_log (
                id SERIAL PRIMARY KEY,
                company_id INTEGER REFERENCES companies(id) DEFAULT ${defaultCompanyId},
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

        // 7. Create Role Permissions Table
        await client.query(`
            CREATE TABLE IF NOT EXISTS role_permissions (
                id SERIAL PRIMARY KEY,
                company_id INTEGER REFERENCES companies(id) DEFAULT ${defaultCompanyId},
                role TEXT NOT NULL,
                permission TEXT NOT NULL,
                UNIQUE(company_id, role, permission)
            )
        `);

        // Seed default permissions
        const permCheck = await client.query("SELECT COUNT(*) FROM role_permissions");
        if (parseInt(permCheck.rows[0].count) === 0) {
            const defaultPermissions = [
                ['super_admin', 'manage_users'],
                ['super_admin', 'manage_permissions'],
                ['super_admin', 'view_reports'],
                ['super_admin', 'manage_visitors'],
                ['super_admin', 'manage_patrols'],
                ['super_admin', 'mobile_login'],
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
                await client.query('INSERT INTO role_permissions (company_id, role, permission) VALUES ($1, $2, $3)', [defaultCompanyId, role, perm]);
            }
        }

        // Seed super_admin GM
        const adminCheck = await client.query("SELECT id FROM users WHERE username = 'admin' AND company_id = $1", [defaultCompanyId]);
        if (adminCheck.rows.length === 0) {
            const adminPassword = bcrypt.hashSync('admin@123', 10);
            await client.query(`
                INSERT INTO users (company_id, username, password_hash, full_name, email, role, unit_number)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
            `, [defaultCompanyId, 'admin', adminPassword, 'فهد الجعيدي', 'admin@company.local', 'super_admin', 'FAJ-GM-001']);
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
    console.log('🔄 Checking for missing columns and tables...');
    const client = await pool.connect();
    try {
        // 1. Create companies table if missing
        await client.query(`
            CREATE TABLE IF NOT EXISTS companies (
                id SERIAL PRIMARY KEY,
                name TEXT NOT NULL,
                company_code TEXT UNIQUE NOT NULL,
                subscription_plan TEXT DEFAULT 'basic',
                expiry_date TIMESTAMP WITH TIME ZONE DEFAULT (CURRENT_TIMESTAMP + INTERVAL '30 days'),
                status TEXT CHECK(status IN ('active', 'suspended', 'expired')) DEFAULT 'active',
                max_users INTEGER DEFAULT 10,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Seed default company if none
        const companyCheck = await client.query("SELECT id FROM companies LIMIT 1");
        let defaultId = 1;
        if (companyCheck.rows.length === 0) {
            const res = await client.query("INSERT INTO companies (name, company_code, subscription_plan, status) VALUES ('FAJ Security System', 'FAJ001', 'enterprise', 'active') RETURNING id");
            defaultId = res.rows[0].id;
        } else {
            defaultId = companyCheck.rows[0].id;
        }

        // 2. Add company_id to all tables if missing
        const tables = ['users', 'visitors', 'patrol_rounds', 'locations', 'activity_log', 'role_permissions'];
        for (const table of tables) {
            await client.query(`
                DO $$ 
                BEGIN 
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='${table}' AND column_name='company_id') THEN
                        ALTER TABLE ${table} ADD COLUMN company_id INTEGER REFERENCES companies(id) DEFAULT ${defaultId};
                        UPDATE ${table} SET company_id = ${defaultId} WHERE company_id IS NULL;
                    END IF;
                END $$;
            `);
        }

        // 3. Update users role check and super_admin seeding
        await client.query(`
            DO $$ 
            BEGIN 
                ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
                ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('super_admin', 'admin', 'supervisor', 'guard', 'operations_manager', 'hr_manager', 'safety_officer'));
            EXCEPTION WHEN OTHERS THEN
                -- Constraint might already be correct
            END $$;
        `);

        // Ensure admin user is super_admin for the first company
        await client.query(`
            UPDATE users SET role = 'super_admin' WHERE username = 'admin' AND company_id = $1
        `, [defaultId]);

        // Existing migrations...
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
