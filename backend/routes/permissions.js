const express = require('express');
const { getDatabase, prepare, all, run } = require('../database/db');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// GET /api/permissions - Get all roles and their permissions
router.get('/', authenticateToken, async (req, res) => {
    try {
        await getDatabase();
        const companyId = req.user.company_id;
        const permissions = await prepare('SELECT role, permission FROM role_permissions WHERE company_id = $1').all(companyId);
        
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
        const companyId = req.user.company_id;

        if (!role || !permission) {
            return res.status(400).json({ error: 'الدور والصلاحية مطلوبان' });
        }

        await getDatabase();
        const existing = await prepare('SELECT id FROM role_permissions WHERE company_id = $1 AND role = $2 AND permission = $3').get(companyId, role, permission);

        if (existing) {
            await run('DELETE FROM role_permissions WHERE company_id = $1 AND role = $2 AND permission = $3', [companyId, role, permission]);
            res.json({ message: 'تم إزالة الصلاحية', active: false });
        } else {
            await run('INSERT INTO role_permissions (company_id, role, permission) VALUES ($1, $2, $3)', [companyId, role, permission]);
            res.json({ message: 'تم إضافة الصلاحية', active: true });
        }

    } catch (error) {
        console.error('Toggle permission error:', error);
        res.status(500).json({ error: 'خطأ في تعديل الصلاحية' });
    }
});

module.exports = router;
