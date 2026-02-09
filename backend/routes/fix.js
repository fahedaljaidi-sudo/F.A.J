const express = require('express');
const bcrypt = require('bcryptjs');
const { getDatabase, prepare } = require('../database/db');

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
                <p>هذا سيحذف جميع الجداول الحالية في PostgreSQL ويُنشئ جداول جديدة</p>
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
        const db = await getDatabase();

        // Drop existing tables
        await db.query('DROP TABLE IF EXISTS role_permissions CASCADE');
        await db.query('DROP TABLE IF EXISTS activity_log CASCADE');
        await db.query('DROP TABLE IF EXISTS patrol_rounds CASCADE');
        await db.query('DROP TABLE IF EXISTS visitors CASCADE');
        await db.query('DROP TABLE IF EXISTS locations CASCADE');
        await db.query('DROP TABLE IF EXISTS users CASCADE');

        // Create tables (Postgres syntax)
        await db.query(`
            CREATE TABLE users (
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

        await db.query(`
            CREATE TABLE visitors (
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

        await db.query(`
            CREATE TABLE patrol_rounds (
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

        await db.query(`
            CREATE TABLE locations (
                id SERIAL PRIMARY KEY,
                name_ar TEXT NOT NULL,
                name_en TEXT,
                location_code TEXT UNIQUE
            )
        `);

        await db.query(`
            CREATE TABLE activity_log (
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

        await db.query(`
            CREATE TABLE role_permissions (
                id SERIAL PRIMARY KEY,
                role TEXT NOT NULL,
                permission TEXT NOT NULL,
                UNIQUE(role, permission)
            )
        `);

        // Seed default permissions
        const defaultPermissions = [
            ['admin', 'manage_users'],
            ['admin', 'manage_permissions'],
            ['admin', 'view_reports'],
            ['admin', 'manage_visitors'],
            ['admin', 'manage_patrols'],
            ['supervisor', 'view_reports'],
            ['supervisor', 'manage_visitors'],
            ['supervisor', 'manage_patrols'],
            ['guard', 'manage_visitors'],
            ['guard', 'manage_patrols'],
            ['operations_manager', 'view_reports'],
            ['hr_manager', 'view_reports'],
            ['safety_officer', 'view_reports']
        ];
        
        for (const [role, perm] of defaultPermissions) {
            await db.query('INSERT INTO role_permissions (role, permission) VALUES ($1, $2)', [role, perm]);
        }

        // Insert admin user
        const adminPassword = bcrypt.hashSync('admin@123', 10);
        await db.query(`
            INSERT INTO users (username, password_hash, full_name, email, role, unit_number)
            VALUES ($1, $2, $3, $4, $5, $6)
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
            await db.query('INSERT INTO locations (name_ar, name_en, location_code) VALUES ($1, $2, $3)', loc);
        }

        res.send(`
            <html dir="rtl">
            <head><meta charset="utf-8"><title>نجح!</title></head>
            <body style="font-family: Arial; padding: 40px; max-width: 600px; margin: 0 auto;">
                <h1 style="color: #10b981;">✅ تم بنجاح!</h1>
                <p>تم إعادة إنشاء قاعدة البيانات في PostgreSQL بنجاح</p>
                <h2>معلومات تسجيل الدخول:</h2>
                <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; direction: ltr; text-align: left;">
                    <p><strong>Username:</strong> admin</p>
                    <p><strong>Password:</strong> admin@123</p>
                    <p><strong>Full Name:</strong> فهد الجعيدي</p>
                </div>
                <p style="margin-top: 30px;">
                    <a href="/" style="display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
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

// Clear activity data
router.get('/clear-activity', async (req, res) => {
    const { confirm } = req.query;

    if (confirm !== 'yes') {
        return res.send(`
            <html dir="rtl">
            <head><meta charset="utf-8"><title>مسح بيانات النشاط</title></head>
            <body style="font-family: Arial; padding: 40px; max-width: 600px; margin: 0 auto;">
                <h1>⚠️ تأكيد المسح</h1>
                <p>سقوم هذا الإجراء بمسح سجل الزوار، جولات الحراسة، وسجل النشاطات من PostgreSQL.</p>
                <p style="color: green; font-weight: bold;">لن يتم حذف المستخدمين أو الإعدادات الأساسية.</p>
                <a href="/api/fix/clear-activity?confirm=yes" style="display: inline-block; background: #ef4444; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 20px;">
                    نعم، امسح بيانات النشاط
                </a>
            </body>
            </html>
        `);
    }

    try {
        const db = await getDatabase();
        await db.query('TRUNCATE TABLE visitors, patrol_rounds, activity_log RESTART IDENTITY CASCADE');

        res.send(`
            <html dir="rtl">
            <head><meta charset="utf-8"><title>تم المسح</title></head>
            <body style="font-family: Arial; padding: 40px; max-width: 600px; margin: 0 auto;">
                <h1 style="color: #10b981;">✅ تم مسح البيانات بنجاح</h1>
                <p>تم تنظيف سجلات الزوار والدوريات والنشاطات في PostgreSQL.</p>
                <p style="margin-top: 30px;"><a href="/" style="display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">العودة للرئيسية</a></p>
            </body>
            </html>
        `);
    } catch (error) {
        console.error('Error clearing data:', error);
        res.status(500).send(`<h1>❌ حدث خطأ</h1><pre>${error.message}</pre>`);
    }
});

module.exports = router;