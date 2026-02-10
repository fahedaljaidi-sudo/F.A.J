const express = require('express');
const bcrypt = require('bcryptjs');
const { getDatabase, prepare } = require('../database/db');

const router = express.Router();

// GET /api/emergency/reset-admin?secret=FAJ2026RESET
router.get('/reset-admin', async (req, res) => {
    try {
        const { secret } = req.query;

        if (secret !== 'FAJ2026RESET') {
            return res.status(403).json({ error: 'غير مصرح' });
        }

        await getDatabase();
        const admin = await prepare('SELECT id FROM users WHERE username = $1').get('admin');

        if (!admin) {
            return res.status(404).json({ error: 'المدير غير موجود' });
        }

        const newPassword = bcrypt.hashSync('admin@123', 10);
        await prepare('UPDATE users SET password_hash = $1, full_name = $2, updated_at = CURRENT_TIMESTAMP WHERE username = $3')
            .run(newPassword, 'فهد الجعيدي', 'admin');

        res.json({
            success: true,
            message: 'تم تحديث معلومات المدير بنجاح في PostgreSQL',
            credentials: { username: 'admin', password: 'admin@123' }
        });

    } catch (error) {
        console.error('Error resetting admin:', error);
        res.status(500).json({ error: 'حدث خطأ في التحديث', details: error.message });
    }
});

router.get('/check-admin', async (req, res) => {
    try {
        await getDatabase();
        const admin = await prepare('SELECT id, username, full_name, role, company_id FROM users WHERE username = $1').get('admin');

        if (!admin) return res.status(404).json({ error: 'المدير غير موجود' });

        res.json({ success: true, admin });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/db-status', async (req, res) => {
    try {
        const db = await getDatabase();
        const companies = await db.query("SELECT COUNT(*) FROM companies");
        const users = await db.query("SELECT COUNT(*) FROM users");
        res.json({
            status: 'connected',
            companies: companies.rows[0].count,
            users: users.rows[0].count,
            engine: 'PostgreSQL'
        });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
});

router.get('/db-schema', async (req, res) => {
    try {
        const db = await getDatabase();
        const tables = ['companies', 'users', 'visitors', 'patrol_rounds', 'role_permissions'];
        const schema = {};

        for (const table of tables) {
            const columns = await db.query(`
                SELECT column_name, data_type 
                FROM information_schema.columns 
                WHERE table_name = $1
            `, [table]);
            schema[table] = columns.rows;
        }

        res.json({ success: true, schema });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;