const express = require('express');
const bcrypt = require('bcryptjs');
const { pool } = require('../database/db');

const router = express.Router();

router.get('/recreate-database', async (req, res) => {
    if (req.query.confirm !== 'yes') return res.send('Please confirm=yes');

    try {
        console.log('🚮 Dropping all tables...');
        await pool.query('DROP TABLE IF EXISTS role_permissions, activity_log, patrol_rounds, visitors, locations, users, companies CASCADE');

        console.log('🏗️ Rebuilding Full SaaS Schema...');
        
        // 1. Companies
        await pool.query(`CREATE TABLE companies (
            id SERIAL PRIMARY KEY, 
            name TEXT NOT NULL, 
            company_code TEXT UNIQUE NOT NULL, 
            subscription_plan TEXT DEFAULT 'enterprise', 
            expiry_date TIMESTAMP WITH TIME ZONE DEFAULT (CURRENT_TIMESTAMP + INTERVAL '365 days'), 
            status TEXT DEFAULT 'active',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )`);
        
        const compResult = await pool.query(`INSERT INTO companies (name, company_code) VALUES ('FAJ Security System', 'FAJ001') RETURNING id`);
        const defId = compResult.rows[0].id;

        // 2. Users
        await pool.query(`CREATE TABLE users (
            id SERIAL PRIMARY KEY, 
            company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE, 
            username TEXT NOT NULL, 
            password_hash TEXT NOT NULL, 
            full_name TEXT NOT NULL, 
            email TEXT,
            role TEXT DEFAULT 'guard', 
            unit_number TEXT,
            is_active INTEGER DEFAULT 1, 
            allow_mobile_login INTEGER DEFAULT 1, 
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(company_id, username)
        )`);

        // 3. Visitors
        await pool.query(`CREATE TABLE visitors (
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

        // 4. Patrol Rounds
        await pool.query(`CREATE TABLE patrol_rounds (
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

        // 5. Locations
        await pool.query(`CREATE TABLE locations (
            id SERIAL PRIMARY KEY, 
            company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE, 
            name_ar TEXT NOT NULL, 
            name_en TEXT,
            location_code TEXT,
            UNIQUE(company_id, location_code)
        )`);

        // 6. Activity Log
        await pool.query(`CREATE TABLE activity_log (
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

        // 7. Role Permissions
        await pool.query(`CREATE TABLE role_permissions (
            id SERIAL PRIMARY KEY, 
            company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE, 
            role TEXT NOT NULL, 
            permission TEXT NOT NULL,
            UNIQUE(company_id, role, permission)
        )`);

        // Seed GM
        const hash = bcrypt.hashSync('admin@123', 10);
        await pool.query(`INSERT INTO users (company_id, username, password_hash, full_name, role, unit_number) VALUES ($1, $2, $3, $4, $5, $6)`, 
            [defId, 'admin', hash, 'فهد الجعيدي', 'super_admin', 'FAJ-GM-001']);

        // Seed Basic Permissions
        const perms = ['manage_users', 'manage_permissions', 'view_reports', 'manage_visitors', 'manage_patrols', 'mobile_login'];
        for(const p of perms) {
            await pool.query(`INSERT INTO role_permissions (company_id, role, permission) VALUES ($1, $2, $3)`, [defId, 'super_admin', p]);
            await pool.query(`INSERT INTO role_permissions (company_id, role, permission) VALUES ($1, $2, $3)`, [defId, 'admin', p]);
        }

        // Seed default locations
        const locations = [
            ['حرم المصنع الشمالي', 'factory-north'],
            ['حرم المصنع الشرقي', 'factory-east'],
            ['البوابة الرئيسية', 'main-gate'],
            ['مستودع أ', 'warehouse-a'],
            ['المبنى الإداري', 'admin-building']
        ];
        for (const loc of locations) {
            await pool.query('INSERT INTO locations (company_id, name_ar, location_code) VALUES ($1, $2, $3)', [defId, loc[0], loc[1]]);
        }

        res.send('<h1>✅ Success! Full SaaS Database Recreated.</h1><p>Log in with FAJ001 / admin / admin@123</p><a href="/">Go to Login</a>');
    } catch (e) {
        console.error(e);
        res.status(500).send('Error: ' + e.message);
    }
});

module.exports = router;