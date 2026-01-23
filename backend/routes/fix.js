const express = require('express');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

const router = express.Router();

// Force recreate database - accessible via browser
router.get('/recreate-database', async (req, res) => {
    const { confirm } = req.query;

    if (confirm !== 'yes') {
        return res.send(`
            <html dir="rtl">
            <head><meta charset="utf-8"><title>إعادة إنشاء قاعدة البيانات</title></head>
            <body style="font-family: Arial; padding: 40px; max-width: 600px; margin: 0 auto;">
                <h1>⚠️ تحذير</h1>
                <p>هذا سيحذف قاعدة البيانات الحالية ويُنشئ واحدة جديدة</p>
                <p><strong>جميع البيانات (الزوار، الجولات، إلخ) ستُحذف!</strong></p>
                <p>معلومات المدير الجديدة:</p>
                <ul>
                    <li>اسم المستخدم: admin</li>
                    <li>كلمة المرور: admin@123</li>
                    <li>الاسم: فهد الجعيدي</li>
                </ul>
                <a href="/api/fix/recreate-database?confirm=yes" style="display: inline-block; background: #ef4444; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 20px;">
                    نعم، أعد إنشاء قاعدة البيانات
                </a>
            </body>
            </html>
        `);
    }

    try {
        const initSqlJs = require('sql.js');
        const dbPath = path.join(__dirname, '../database/security.db');

        // Delete old database
        if (fs.existsSync(dbPath)) {
            fs.unlinkSync(dbPath);
            console.log('✓ Old database deleted');
        }

        // Create new database
        const SQL = await initSqlJs();
        const db = new SQL.Database();

        // Create tables
        db.run(`
            CREATE TABLE users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                full_name TEXT NOT NULL,
                email TEXT,
                role TEXT CHECK(role IN ('admin', 'supervisor', 'guard')) DEFAULT 'guard',
                unit_number TEXT,
                is_active INTEGER DEFAULT 1,
                created_at TEXT DEFAULT (datetime('now')),
                updated_at TEXT DEFAULT (datetime('now'))
            )
        `);

        db.run(`
            CREATE TABLE visitors (
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

        db.run(`
            CREATE TABLE patrol_rounds (
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

        db.run(`
            CREATE TABLE locations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name_ar TEXT NOT NULL,
                name_en TEXT,
                location_code TEXT UNIQUE
            )
        `);

        // Insert admin user
        const adminPassword = bcrypt.hashSync('admin@123', 10);
        db.run(`
            INSERT INTO users (username, password_hash, full_name, email, role, unit_number)
            VALUES (?, ?, ?, ?, ?, ?)
        `, ['admin', adminPassword, 'فهد الجعيدي', 'admin@company.local', 'admin', 'ADM-001']);

        // Insert locations
        const locations = [
            ['حرم المصنع الشمالي', 'North Factory Perimeter', 'factory-north'],
            ['حرم المصنع الشرقي', 'East Factory Perimeter', 'factory-east'],
            ['البوابة الرئيسية', 'Main Gate', 'main-gate'],
            ['مستودع أ', 'Warehouse A', 'warehouse-a'],
            ['المبنى الإداري', 'Admin Building', 'admin-building']
        ];

        for (const loc of locations) {
            db.run('INSERT INTO locations (name_ar, name_en, location_code) VALUES (?, ?, ?)', loc);
        }

        // Save database
        const data = db.export();
        const buffer = Buffer.from(data);
        fs.writeFileSync(dbPath, buffer);
        db.close();

        res.send(`
            <html dir="rtl">
            <head><meta charset="utf-8"><title>نجح!</title></head>
            <body style="font-family: Arial; padding: 40px; max-width: 600px; margin: 0 auto;">
                <h1 style="color: #10b981;">✅ تم بنجاح!</h1>
                <p>تم إنشاء قاعدة بيانات جديدة</p>
                <h2>معلومات تسجيل الدخول:</h2>
                <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; direction: ltr; text-align: left;">
                    <p><strong>Username:</strong> admin</p>
                    <p><strong>Password:</strong> admin@123</p>
                    <p><strong>Full Name:</strong> فهد الجعيدي</p>
                </div>
                <p style="margin-top: 30px;">
                    <a href="https://f-a-j.vercel.app" style="display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
                        اذهب لتسجيل الدخول
                    </a>
                </p>
            </body>
            </html>
        `);

    } catch (error) {
        console.error('Error:', error);
        res.status(500).send(`
            <html dir="rtl">
            <head><meta charset="utf-8"><title>خطأ</title></head>
            <body style="font-family: Arial; padding: 40px;">
                <h1 style="color: #ef4444;">❌ حدث خطأ</h1>
                <pre>${error.message}</pre>
            </body>
            </html>
        `);
    }
});

module.exports = router;
