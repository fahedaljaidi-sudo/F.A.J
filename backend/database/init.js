const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const dbPath = path.join(__dirname, 'security.db');

async function initDatabase() {
    console.log('🔧 Initializing Security Management System Database...\n');

    const SQL = await initSqlJs();
    const db = new SQL.Database();

    console.log('📋 Creating tables...');

    // Users table
    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            full_name TEXT NOT NULL,
            email TEXT,
            role TEXT CHECK(role IN ('admin', 'supervisor', 'guard', 'operations_manager', 'hr_manager', 'safety_officer')) DEFAULT 'guard',
            unit_number TEXT,
            is_active INTEGER DEFAULT 1,
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now'))
        )
    `);
    console.log('  ✓ Users table created');

    // Visitors table
    db.run(`
        CREATE TABLE IF NOT EXISTS visitors (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            full_name TEXT NOT NULL,
            id_number TEXT NOT NULL,
            phone TEXT,
            company TEXT,
            host_name TEXT,
            visit_reason TEXT,
            entry_time TEXT NOT NULL,
            exit_time TEXT,
            status TEXT CHECK(status IN ('inside', 'left')) DEFAULT 'inside',
            registered_by INTEGER,
            gate_number TEXT DEFAULT '1',
            notes TEXT,
            created_at TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (registered_by) REFERENCES users(id)
        )
    `);
    console.log('  ✓ Visitors table created');

    // Patrol Rounds table
    db.run(`
        CREATE TABLE IF NOT EXISTS patrol_rounds (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            guard_id INTEGER NOT NULL,
            location TEXT NOT NULL,
            security_status TEXT CHECK(security_status IN ('normal', 'observation', 'danger')) DEFAULT 'normal',
            resolution_status TEXT CHECK(resolution_status IN ('pending', 'in_progress', 'closed')) DEFAULT 'pending',
            notes TEXT,
            attachments TEXT,
            patrol_time TEXT DEFAULT (datetime('now')),
            created_at TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (guard_id) REFERENCES users(id)
        )
    `);
    console.log('  ✓ Patrol Rounds table created');

    // Locations table
    db.run(`
        CREATE TABLE IF NOT EXISTS locations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name_ar TEXT NOT NULL,
            name_en TEXT,
            location_code TEXT UNIQUE
        )
    `);
    console.log('  ✓ Locations table created');

    // Activity Log table
    db.run(`
        CREATE TABLE IF NOT EXISTS activity_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            event_type TEXT NOT NULL,
            event_time TEXT DEFAULT (datetime('now')),
            description TEXT,
            user_id INTEGER,
            visitor_id INTEGER,
            patrol_id INTEGER,
            location TEXT,
            status TEXT,
            FOREIGN KEY (user_id) REFERENCES users(id),
            FOREIGN KEY (visitor_id) REFERENCES visitors(id),
            FOREIGN KEY (patrol_id) REFERENCES patrol_rounds(id)
        )
    `);
    console.log('  ✓ Activity Log table created');

    // Seed default data
    console.log('\n📦 Seeding default data...');

    // Create default admin user
    const adminPassword = bcrypt.hashSync('admin@123', 10);
    db.run(`
        INSERT INTO users (username, password_hash, full_name, email, role, unit_number)
        VALUES (?, ?, ?, ?, ?, ?)
    `, ['admin', adminPassword, 'فهد الجعيدي', 'admin@company.local', 'admin', 'ADM-001']);
    console.log('  ✓ Default admin user created (username: admin, password: admin@123)');

    // Create sample guard user
    const guardPassword = bcrypt.hashSync('guard123', 10);
    db.run(`
        INSERT INTO users (username, password_hash, full_name, email, role, unit_number)
        VALUES (?, ?, ?, ?, ?, ?)
    `, ['ahmed', guardPassword, 'أحمد السيد', 'ahmed@company.local', 'guard', '402-B']);
    console.log('  ✓ Sample guard user created (username: ahmed, password: guard123)');

    // Seed default locations
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
        db.run('INSERT INTO locations (name_ar, name_en, location_code) VALUES (?, ?, ?)', loc);
    }
    console.log('  ✓ Default locations seeded (10 locations)');

    // Save database to file
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);

    db.close();

    console.log('\n✅ Database initialization complete!');
    console.log(`📍 Database file: ${dbPath}\n`);
}

initDatabase().catch(err => {
    console.error('Error initializing database:', err);
    process.exit(1);
});
