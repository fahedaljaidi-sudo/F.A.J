const { Pool } = require('pg');
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'faj_security',
    password: process.env.DB_PASSWORD || 'password',
    port: process.env.DB_PORT || 5432,
});

async function check() {
    try {
        console.log('--- 🔍 Database Diagnostic ---');
        
        // Check companies table
        const tables = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
        console.log('Tables found:', tables.rows.map(r => r.table_name).join(', '));

        if (tables.rows.some(r => r.table_name === 'companies')) {
            const companies = await pool.query("SELECT id, name, company_code, status FROM companies");
            console.log('Companies in DB:', companies.rows);
        } else {
            console.log('❌ companies table MISSING');
        }

        // Check users table columns
        const cols = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'users'");
        console.log('User columns:', cols.rows.map(r => r.column_name).join(', '));

        const hasCompanyId = cols.rows.some(r => r.column_name === 'company_id');
        console.log('Users has company_id:', hasCompanyId);

        // Check super admin
        if (hasCompanyId) {
            const superAdmins = await pool.query("SELECT username, role, company_id FROM users WHERE role = 'super_admin'");
            console.log('Super Admins found:', superAdmins.rows);
        }

        process.exit(0);
    } catch (err) {
        console.error('❌ Diagnostic Error:', err);
        process.exit(1);
    }
}

check();
