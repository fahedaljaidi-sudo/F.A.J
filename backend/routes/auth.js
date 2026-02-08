const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getDatabase, prepare } = require('../database/db');
const { JWT_SECRET, authenticateToken } = require('../middleware/auth');
const detectMobile = require('../middleware/detectMobile');
const { schemas, validate } = require('../middleware/validation');

const router = express.Router();

// POST /api/auth/login - User login
router.post('/login', detectMobile, validate(schemas.login), async (req, res) => {
    try {
        await getDatabase();
        const { username, password } = req.body;

        // Check if mobile device and restrict access
        if (req.isMobile && username !== 'admin') {
            console.log('🚫 Mobile Login BLOCKED:', {
                username,
                userAgent: req.headers['user-agent']?.substring(0, 100),
                timestamp: new Date().toISOString()
            });

            return res.status(403).json({
                error: 'تسجيل الدخول من الأجهزة المحمولة محظور - يُسمح فقط لحساب المسؤول',
                isMobileRestricted: true
            });
        }

        // Log mobile login for admin
        if (req.isMobile && username === 'admin') {
            console.log('✅ Mobile Login ALLOWED for admin:', {
                timestamp: new Date().toISOString()
            });
        }

        // Find user
        const user = prepare(`
            SELECT id, username, password_hash, full_name, email, role, unit_number, is_active
            FROM users WHERE username = ?
        `).get(username);

        if (!user) {
            return res.status(401).json({ error: 'اسم المستخدم أو كلمة المرور غير صحيحة' });
        }

        if (!user.is_active) {
            return res.status(401).json({ error: 'الحساب معطل - يرجى التواصل مع المسؤول' });
        }

        // Verify password
        const validPassword = bcrypt.compareSync(password, user.password_hash);
        if (!validPassword) {
            return res.status(401).json({ error: 'اسم المستخدم أو كلمة المرور غير صحيحة' });
        }

        // Generate JWT token
        const token = jwt.sign(
            {
                id: user.id,
                username: user.username,
                full_name: user.full_name,
                role: user.role,
                unit_number: user.unit_number
            },
            JWT_SECRET,
            { expiresIn: '12h' }
        );

        // Log activity
        prepare(`
            INSERT INTO activity_log (event_type, description, user_id, status)
            VALUES (?, ?, ?, ?)
        `).run('system', `تسجيل دخول: ${user.full_name}`, user.id, 'success');

        res.json({
            message: 'تم تسجيل الدخول بنجاح',
            token,
            user: {
                id: user.id,
                username: user.username,
                full_name: user.full_name,
                email: user.email,
                role: user.role,
                unit_number: user.unit_number
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'خطأ في النظام' });
    }
});

// GET /api/auth/me - Get current user info
router.get('/me', authenticateToken, async (req, res) => {
    try {
        await getDatabase();
        const user = prepare(`
            SELECT id, username, full_name, email, role, unit_number, is_active, created_at
            FROM users WHERE id = ?
        `).get(req.user.id);

        if (!user) {
            return res.status(404).json({ error: 'المستخدم غير موجود' });
        }

        res.json({ user });

    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({ error: 'خطأ في النظام' });
    }
});

// POST /api/auth/logout - Logout (client-side token removal)
router.post('/logout', authenticateToken, async (req, res) => {
    try {
        await getDatabase();
        // Log activity
        prepare(`
            INSERT INTO activity_log (event_type, description, user_id, status)
            VALUES (?, ?, ?, ?)
        `).run('system', `تسجيل خروج: ${req.user.full_name}`, req.user.id, 'success');

        res.json({ message: 'تم تسجيل الخروج بنجاح' });

    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({ error: 'خطأ في النظام' });
    }
});

module.exports = router;
