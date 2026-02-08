const bcrypt = require('bcryptjs');
const { getDatabase, pool } = require('./db');

async function initDatabase() {
    console.log('🔧 Initializing Security Management System Database for PostgreSQL...\n');

    try {
        const db = await getDatabase();
        
        console.log('📋 Tables are managed by getDatabase() and migrations in db.js');
        
        // Seed extra default data if needed
        const client = await pool.connect();
        try {
            console.log('\n📦 Seeding default locations...');
            
            const locations = [
                ['حرم المصنع الشمالي', 'North Factory Perimeter', 'factory-north'],
                ['حرم المصنع الشرقي', 'East Factory Perimeter', 'factory-east'],
                ['حرم المصنع الغربي', 'West Factory Perimeter', 'factory-west'],
                ['حرم المصنع الجنوبي', 'South Factory Perimeter', 'factory-south'],
                ['البوابة الرئيسية', 'Main Gate', 'main-gate'],
                ['مستودع أ', 'Warehouse A', 'warehouse-a'],
                ['مستودع ب', 'Warehouse B', 'warehouse-b'],
                ['منطقة التحميل', 'Loading Dock', 'loading-dock'],
                ['المبنى الإداري', 'Admin Building', 'admin-building'],
                ['مستودع الكيماويات', 'Chemical Storage', 'chemical-storage']
            ];

            for (const loc of locations) {
                await client.query('INSERT INTO locations (name_ar, name_en, location_code) VALUES ($1, $2, $3) ON CONFLICT (location_code) DO NOTHING', loc);
            }
            console.log('  ✓ Default locations seeded');

            // Sample guard user
            const guardPassword = bcrypt.hashSync('guard123', 10);
            const guardCheck = await client.query("SELECT id FROM users WHERE username = 'ahmed'");
            if (guardCheck.rows.length === 0) {
                await client.query(`
                    INSERT INTO users (username, password_hash, full_name, email, role, unit_number)
                    VALUES ($1, $2, $3, $4, $5, $6)
                `, ['ahmed', guardPassword, 'أحمد السيد', 'ahmed@company.local', 'guard', '402-B']);
                console.log('  ✓ Sample guard user created (ahmed / guard123)');
            }

        } finally {
            client.release();
        }

        console.log('\n✅ Database initialization complete!');
        process.exit(0);
    } catch (err) {
        console.error('Error initializing database:', err);
        process.exit(1);
    }
}

initDatabase();