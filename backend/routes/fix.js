const express = require('express');
const bcrypt = require('bcryptjs');
const { pool } = require('../database/db');

const router = express.Router();

router.get('/recreate-database', async (req, res) => {
    if (req.query.confirm !== 'yes') return res.send('Please confirm=yes');

    try {
        console.log('🚮 Dropping all tables...');
        await pool.query('DROP TABLE IF EXISTS role_permissions, activity_log, patrol_rounds, visitors, locations, users, companies CASCADE');

        console.log('🏗️ Rebuilding SaaS Schema...');
        await pool.query(`CREATE TABLE companies (id SERIAL PRIMARY KEY, name TEXT NOT NULL, company_code TEXT UNIQUE NOT NULL, subscription_plan TEXT DEFAULT 'enterprise', expiry_date TIMESTAMP WITH TIME ZONE DEFAULT (CURRENT_TIMESTAMP + INTERVAL '365 days'), status TEXT DEFAULT 'active')`);
        
        const compResult = await pool.query(`INSERT INTO companies (name, company_code) VALUES ('FAJ Security System', 'FAJ001') RETURNING id`);
        const defId = compResult.rows[0].id;

        await pool.query(`CREATE TABLE users (id SERIAL PRIMARY KEY, company_id INTEGER REFERENCES companies(id) DEFAULT ${defId}, username TEXT NOT NULL, password_hash TEXT NOT NULL, full_name TEXT NOT NULL, role TEXT DEFAULT 'guard', is_active INTEGER DEFAULT 1, allow_mobile_login INTEGER DEFAULT 1, UNIQUE(company_id, username))`);
        await pool.query(`CREATE TABLE visitors (id SERIAL PRIMARY KEY, company_id INTEGER REFERENCES companies(id) DEFAULT ${defId}, full_name TEXT NOT NULL, id_number TEXT NOT NULL, status TEXT DEFAULT 'inside', entry_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, registered_by INTEGER REFERENCES users(id))`);
        await pool.query(`CREATE TABLE patrol_rounds (id SERIAL PRIMARY KEY, company_id INTEGER REFERENCES companies(id) DEFAULT ${defId}, guard_id INTEGER REFERENCES users(id), location TEXT NOT NULL, security_status TEXT DEFAULT 'normal', patrol_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, attachments TEXT)`);
        await pool.query(`CREATE TABLE locations (id SERIAL PRIMARY KEY, company_id INTEGER REFERENCES companies(id) DEFAULT ${defId}, name_ar TEXT NOT NULL, location_code TEXT)`);
        await pool.query(`CREATE TABLE activity_log (id SERIAL PRIMARY KEY, company_id INTEGER REFERENCES companies(id) DEFAULT ${defId}, event_type TEXT NOT NULL, description TEXT, user_id INTEGER REFERENCES users(id), event_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP)`);
        await pool.query(`CREATE TABLE role_permissions (id SERIAL PRIMARY KEY, company_id INTEGER REFERENCES companies(id) DEFAULT ${defId}, role TEXT NOT NULL, permission TEXT NOT NULL)`);

        // Seed GM
        const hash = bcrypt.hashSync('admin@123', 10);
        await pool.query(`INSERT INTO users (company_id, username, password_hash, full_name, role) VALUES ($1, $2, $3, $4, $5)`, [defId, 'admin', hash, 'فهد الجعيدي', 'super_admin']);

        // Seed Basic Permissions
        const perms = ['manage_users', 'manage_permissions', 'view_reports', 'manage_visitors', 'manage_patrols', 'mobile_login'];
        for(const p of perms) {
            await pool.query(`INSERT INTO role_permissions (company_id, role, permission) VALUES ($1, $2, $3)`, [defId, 'super_admin', p]);
            await pool.query(`INSERT INTO role_permissions (company_id, role, permission) VALUES ($1, $2, $3)`, [defId, 'admin', p]);
        }

        res.send('<h1>✅ Success! Database Recreated.</h1><p>Log in with FAJ001 / admin / admin@123</p><a href="/">Go to Login</a>');
    } catch (e) {
        console.error(e);
        res.status(500).send('Error: ' + e.message);
    }
});

module.exports = router;
