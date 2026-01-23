const express = require('express');
const bcrypt = require('bcryptjs');
const { get, run } = require('../database/db');

const router = express.Router();

// Emergency admin password reset endpoint
// Access: GET /api/emergency/reset-admin?secret=FAJ2026RESET
router.get('/reset-admin', async (req, res) => {
    try {
        const { secret } = req.query;

        // Simple security check
        if (secret !== 'FAJ2026RESET') {
            return res.status(403).json({ error: 'غير مصرح' });
        }

        // Check if admin exists
        const admin = await get('SELECT id, username FROM users WHERE username = ?', 'admin');

        if (!admin) {
            return res.status(404).json({ error: 'المدير غير موجود' });
        }

        // Update admin credentials
        const newPassword = bcrypt.hashSync('admin@123', 10);
        const newFullName = 'فهد الجعيدي';

        await run(
            'UPDATE users SET password_hash = ?, full_name = ?, updated_at = datetime(?) WHERE username = ?',
            [newPassword, newFullName, new Date().toISOString(), 'admin']
        );

        res.json({
            success: true,
            message: 'تم تحديث معلومات المدير بنجاح',
            credentials: {
                username: 'admin',
                password: 'admin@123',
                full_name: 'فهد الجعيدي'
            }
        });

    } catch (error) {
        console.error('Error resetting admin:', error);
        res.status(500).json({ error: 'حدث خطأ في التحديث', details: error.message });
    }
});

// Check admin credentials endpoint
router.get('/check-admin', async (req, res) => {
    try {
        const admin = await get('SELECT id, username, full_name, role FROM users WHERE username = ?', 'admin');

        if (!admin) {
            return res.status(404).json({ error: 'المدير غير موجود' });
        }

        res.json({
            success: true,
            admin: {
                id: admin.id,
                username: admin.username,
                full_name: admin.full_name,
                role: admin.role
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
