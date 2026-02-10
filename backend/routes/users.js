const express = require('express');
const bcrypt = require('bcryptjs');
const { getDatabase, prepare } = require('../database/db');
const { authenticateToken, requireAdmin, requireSupervisor } = require('../middleware/auth');
const { schemas, validate } = require('../middleware/validation');

const router = express.Router();

// GET /api/users - List all users (admin & supervisor)
router.get('/', authenticateToken, requireSupervisor, async (req, res) => {
    try {
        await getDatabase();
        const { page = 1, limit = 20 } = req.query;
        const offset = (page - 1) * limit;
        const companyId = req.user.company_id;

        const users = await prepare(`
            SELECT u.id, u.username, u.full_name, u.email, u.role, u.unit_number, u.is_active, u.allow_mobile_login, u.created_at, u.updated_at,
                   (SELECT COUNT(*) FROM patrol_rounds WHERE guard_id = u.id AND company_id = $1) as patrol_count,
                   (SELECT COUNT(*) FROM patrol_rounds WHERE guard_id = u.id AND company_id = $1 AND patrol_time::date = CURRENT_DATE) as today_patrols
            FROM users u
            WHERE u.company_id = $1
            ORDER BY u.created_at DESC
            LIMIT $2 OFFSET $3
        `).all(companyId, parseInt(limit), parseInt(offset));

        const totalResult = await prepare('SELECT COUNT(*) as total FROM users WHERE company_id = $1').get(companyId);

        res.json({
            users,
            pagination: {
                total: totalResult ? parseInt(totalResult.total) : 0,
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil((totalResult?.total || 0) / limit)
            }
        });

    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ 
            error: 'خطأ في جلب بيانات المستخدمين',
            message: error.message 
        });
    }
});

// GET /api/users/:id - Get single user
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        await getDatabase();
        const { id } = req.params;
        const companyId = req.user.company_id;

        const user = await prepare(`
            SELECT id, username, full_name, email, role, unit_number, is_active, created_at, updated_at
            FROM users WHERE id = $1 AND company_id = $2
        `).get(parseInt(id), companyId);

        if (!user) {
            return res.status(404).json({ error: 'المستخدم غير موجود' });
        }

        res.json({ user });

    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({ error: 'خطأ في جلب بيانات المستخدم' });
    }
});

// POST /api/users - Create new user (admin only)
router.post('/', authenticateToken, requireAdmin, validate(schemas.createUser), async (req, res) => {
    try {
        await getDatabase();
        const { username, password, full_name, email, role, unit_number } = req.body;
        const companyId = req.user.company_id;

        const existingUser = await prepare('SELECT id FROM users WHERE username = $1 AND company_id = $2').get(username, companyId);
        if (existingUser) {
            return res.status(400).json({ error: 'اسم المستخدم موجود مسبقاً في هذه الشركة' });
        }

        const password_hash = bcrypt.hashSync(password, 10);
        const validRoles = ['admin', 'supervisor', 'guard', 'operations_manager', 'hr_manager', 'safety_officer'];
        const validRole = validRoles.includes(role) ? role : 'guard';

        const result = await prepare(`
            INSERT INTO users (company_id, username, password_hash, full_name, email, role, unit_number)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING id
        `).run(companyId, username, password_hash, full_name, email || '', validRole, unit_number || '');

        const newId = result.rows[0].id;

        const newUser = await prepare(`
            SELECT id, username, full_name, email, role, unit_number, is_active, created_at
            FROM users WHERE id = $1
        `).get(newId);

        await prepare(`
            INSERT INTO activity_log (company_id, event_type, description, user_id, status)
            VALUES ($1, $2, $3, $4, $5)
        `).run(companyId, 'system', `إنشاء مستخدم جديد: ${full_name}`, req.user.id, 'success');

        res.status(201).json({
            message: 'تم إنشاء المستخدم بنجاح',
            user: newUser
        });

    } catch (error) {
        console.error('Create user error:', error);
        res.status(500).json({ error: 'خطأ في إنشاء المستخدم: ' + error.message });
    }
});

// PUT /api/users/:id - Update user (admin only)
router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        await getDatabase();
        const { id } = req.params;
        const { full_name, email, role, unit_number, password, is_active, allow_mobile_login } = req.body;
        const companyId = req.user.company_id;

        const userId = parseInt(id);
        const existingUser = await prepare('SELECT id FROM users WHERE id = $1 AND company_id = $2').get(userId, companyId);
        if (!existingUser) {
            return res.status(404).json({ error: 'المستخدم غير موجود' });
        }

        // Update fields
        if (full_name) {
            await prepare('UPDATE users SET full_name = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND company_id = $3').run(full_name, userId, companyId);
        }
        if (email !== undefined) {
            await prepare('UPDATE users SET email = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND company_id = $3').run(email, userId, companyId);
        }
        const validRoles = ['admin', 'supervisor', 'guard', 'operations_manager', 'hr_manager', 'safety_officer'];
        if (role && validRoles.includes(role)) {
            await prepare('UPDATE users SET role = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND company_id = $3').run(role, userId, companyId);
        }
        if (unit_number !== undefined) {
            await prepare('UPDATE users SET unit_number = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND company_id = $3').run(unit_number, userId, companyId);
        }
        if (password && password.length >= 6) {
            const hash = bcrypt.hashSync(password, 10);
            await prepare('UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND company_id = $3').run(hash, userId, companyId);
        }
        if (is_active !== undefined) {
            await prepare('UPDATE users SET is_active = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND company_id = $3').run(is_active ? 1 : 0, userId, companyId);
        }
        if (allow_mobile_login !== undefined) {
            await prepare('UPDATE users SET allow_mobile_login = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND company_id = $3').run(allow_mobile_login ? 1 : 0, userId, companyId);
        }

        const updatedUser = await prepare(`
            SELECT id, username, full_name, email, role, unit_number, is_active, allow_mobile_login, updated_at
            FROM users WHERE id = $1 AND company_id = $2
        `).get(userId, companyId);

        res.json({
            message: 'تم تحديث المستخدم بنجاح',
            user: updatedUser
        });

    } catch (error) {
        console.error('Update user error:', error);
        res.status(500).json({ error: 'خطأ في تحديث المستخدم' });
    }
});

// DELETE /api/users/:id - Delete user permanently (admin only)
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        await getDatabase();
        const { id } = req.params;
        const userId = parseInt(id);
        const companyId = req.user.company_id;

        if (userId === req.user.id) {
            return res.status(400).json({ error: 'لا يمكنك حذف حسابك الخاص' });
        }

        const user = await prepare('SELECT * FROM users WHERE id = $1 AND company_id = $2').get(userId, companyId);
        if (!user) {
            return res.status(404).json({ error: 'المستخدم غير موجود' });
        }

        // 1. Unlink related records
        await prepare('UPDATE visitors SET registered_by = NULL WHERE registered_by = $1 AND company_id = $2').run(userId, companyId);
        await prepare('DELETE FROM patrol_rounds WHERE guard_id = $1 AND company_id = $2').run(userId, companyId);

        // 2. Hard delete the user
        await prepare('DELETE FROM users WHERE id = $1 AND company_id = $2').run(userId, companyId);

        await prepare(`
            INSERT INTO activity_log (company_id, event_type, description, user_id, status)
            VALUES ($1, $2, $3, $4, $5)
        `).run(companyId, 'system', `حذف مستخدم نهائياً: ${user.full_name}`, req.user.id, 'success');

        res.json({ message: 'تم حذف الحساب نهائياً من قاعدة البيانات' });

    } catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json({ error: 'خطأ في حذف المستخدم' });
    }
});

module.exports = router;