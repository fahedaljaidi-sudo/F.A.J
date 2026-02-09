const express = require('express');
const { getDatabase, prepare, all, run } = require('../database/db');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// GET /api/permissions - Get all roles and their permissions
router.get('/', authenticateToken, async (req, res) => {
    try {
        await getDatabase();
        const permissions = await all('SELECT role, permission FROM role_permissions');
        
        // Group by role
        const grouped = permissions.reduce((acc, curr) => {
            if (!acc[curr.role]) acc[curr.role] = [];
            acc[curr.role].push(curr.permission);
            return acc;
        }, {});

        res.json({ permissions: grouped });
    } catch (error) {
        console.error('Get permissions error:', error);
        res.status(500).json({ error: 'خطأ في جلب الصلاحيات' });
    }
});

// POST /api/permissions/toggle - Toggle a permission for a role
router.post('/toggle', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { role, permission } = req.body;
        if (!role || !permission) {
            return res.status(400).json({ error: 'الدور والصلاحية مطلوبان' });
        }

        await getDatabase();
        const existing = await prepare('SELECT id FROM role_permissions WHERE role = $1 AND permission = $2').get(role, permission);

        if (existing) {
            await run('DELETE FROM role_permissions WHERE role = $1 AND permission = $2', [role, permission]);
            res.json({ message: 'تم إزالة الصلاحية', active: false });
        } else {
            await run('INSERT INTO role_permissions (role, permission) VALUES ($1, $2)', [role, permission]);
            res.json({ message: 'تم إضافة الصلاحية', active: true });
        }

    } catch (error) {
        console.error('Toggle permission error:', error);
        res.status(500).json({ error: 'خطأ في تعديل الصلاحية' });
    }
});

module.exports = router;
