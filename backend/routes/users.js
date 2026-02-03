const express = require('express');
const bcrypt = require('bcryptjs');
const { getDatabase, prepare } = require('../database/db');
const { authenticateToken, requireAdmin, requireSupervisor } = require('../middleware/auth');

const router = express.Router();

// GET /api/users - List all users (admin & supervisor)
router.get('/', authenticateToken, requireSupervisor, async (req, res) => {
    try {
        await getDatabase();
        const { page = 1, limit = 20 } = req.query;
        const offset = (page - 1) * limit;

        const users = prepare(`
            SELECT u.id, u.username, u.full_name, u.email, u.role, u.unit_number, u.is_active, u.created_at, u.updated_at,
                   (SELECT COUNT(*) FROM patrol_rounds WHERE guard_id = u.id) as patrol_count,
                   (SELECT COUNT(*) FROM patrol_rounds WHERE guard_id = u.id AND DATE(patrol_time) = DATE('now')) as today_patrols
            FROM users u
            ORDER BY u.created_at DESC
            LIMIT ? OFFSET ?
        `).all(parseInt(limit), parseInt(offset));

        const totalResult = prepare('SELECT COUNT(*) as total FROM users').get();

        res.json({
            users,
            pagination: {
                total: totalResult ? totalResult.total : 0,
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil((totalResult?.total || 0) / limit)
            }
        });

    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ error: 'خطأ في جلب بيانات المستخدمين' });
    }
});

// GET /api/users/:id - Get single user
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        await getDatabase();
        const { id } = req.params;

        const user = prepare(`
            SELECT id, username, full_name, email, role, unit_number, is_active, created_at, updated_at
            FROM users WHERE id = ?
        `).get(parseInt(id));

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
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
    try {
        await getDatabase();
        const { username, password, full_name, email, role, unit_number } = req.body;

        if (!username || !password || !full_name) {
            return res.status(400).json({ error: 'اسم المستخدم وكلمة المرور والاسم الكامل مطلوبة' });
        }

        if (password.length < 6) {
            return res.status(400).json({ error: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' });
        }

        const existingUser = prepare('SELECT id FROM users WHERE username = ?').get(username);
        if (existingUser) {
            return res.status(400).json({ error: 'اسم المستخدم موجود مسبقاً' });
        }

        const password_hash = bcrypt.hashSync(password, 10);
        const validRoles = ['admin', 'supervisor', 'guard', 'operations_manager', 'hr_manager', 'safety_officer'];
        const validRole = validRoles.includes(role) ? role : 'guard';

        const result = prepare(`
            INSERT INTO users (username, password_hash, full_name, email, role, unit_number)
            VALUES (?, ?, ?, ?, ?, ?)
        `).run(username, password_hash, full_name, email || '', validRole, unit_number || '');

        const newUser = prepare(`
            SELECT id, username, full_name, email, role, unit_number, is_active, created_at
            FROM users WHERE id = ?
        `).get(result.lastInsertRowid);

        prepare(`
            INSERT INTO activity_log (event_type, description, user_id, status)
            VALUES (?, ?, ?, ?)
        `).run('system', `إنشاء مستخدم جديد: ${full_name}`, req.user.id, 'success');

        res.status(201).json({
            message: 'تم إنشاء المستخدم بنجاح',
            user: newUser
        });

    } catch (error) {
        console.error('Create user error:', error);
        console.error('Create user error:', error);
        res.status(500).json({ error: 'خطأ في إنشاء المستخدم: ' + error.message });
    }
});

// PUT /api/users/:id - Update user (admin only)
router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        await getDatabase();
        const { id } = req.params;
        const { full_name, email, role, unit_number, password, is_active } = req.body;

        const existingUser = prepare('SELECT * FROM users WHERE id = ?').get(parseInt(id));
        if (!existingUser) {
            return res.status(404).json({ error: 'المستخدم غير موجود' });
        }

        // Update fields
        if (full_name) {
            prepare('UPDATE users SET full_name = ? WHERE id = ?').run(full_name, parseInt(id));
        }
        if (email !== undefined) {
            prepare('UPDATE users SET email = ? WHERE id = ?').run(email, parseInt(id));
        }
        const validRoles = ['admin', 'supervisor', 'guard', 'operations_manager', 'hr_manager', 'safety_officer'];
        if (role && validRoles.includes(role)) {
            prepare('UPDATE users SET role = ? WHERE id = ?').run(role, parseInt(id));
        }
        if (unit_number !== undefined) {
            prepare('UPDATE users SET unit_number = ? WHERE id = ?').run(unit_number, parseInt(id));
        }
        if (password && password.length >= 6) {
            const hash = bcrypt.hashSync(password, 10);
            prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, parseInt(id));
        }
        if (is_active !== undefined) {
            prepare('UPDATE users SET is_active = ? WHERE id = ?').run(is_active ? 1 : 0, parseInt(id));
        }

        const updatedUser = prepare(`
            SELECT id, username, full_name, email, role, unit_number, is_active, updated_at
            FROM users WHERE id = ?
        `).get(parseInt(id));

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

        if (parseInt(id) === req.user.id) {
            return res.status(400).json({ error: 'لا يمكنك حذف حسابك الخاص' });
        }

        const user = prepare('SELECT * FROM users WHERE id = ?').get(parseInt(id));
        if (!user) {
            return res.status(404).json({ error: 'المستخدم غير موجود' });
        }

        // 1. Unlink related records (preserve history but remove link to deleted user)
        prepare('UPDATE visitors SET registered_by = NULL WHERE registered_by = ?').run(parseInt(id));
        prepare('DELETE FROM patrol_rounds WHERE guard_id = ?').run(parseInt(id));

        // 2. Hard delete the user
        prepare('DELETE FROM users WHERE id = ?').run(parseInt(id));

        prepare(`
            INSERT INTO activity_log (event_type, description, user_id, status)
            VALUES (?, ?, ?, ?)
        `).run('system', `حذف مستخدم نهائياً: ${user.full_name}`, req.user.id, 'success');

        res.json({ message: 'تم حذف الحساب نهائياً من قاعدة البيانات' });

    } catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json({ error: 'خطأ في حذف المستخدم' });
    }
});

module.exports = router;
