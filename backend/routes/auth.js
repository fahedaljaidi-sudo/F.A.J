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
        const { company_code, username, password } = req.body;

        // 1. Verify Company
        const company = await prepare(`
            SELECT id, name, status, expiry_date FROM companies WHERE company_code = $1
        `).get(company_code);

        if (!company) {
            return res.status(401).json({ error: 'كود الشركة غير صحيح' });
        }

        if (company.status !== 'active') {
            return res.status(403).json({ error: 'اشتراك الشركة معلق أو غير نشط' });
        }

        if (new Date(company.expiry_date) < new Date()) {
            return res.status(403).json({ error: 'انتهت صلاحية اشتراك الشركة، يرجى التجديد' });
        }

        // 2. Find user within the company
        const user = await prepare(`
            SELECT u.id, u.username, u.password_hash, u.full_name, u.email, u.role, u.unit_number, u.is_active, u.allow_mobile_login, u.company_id,
                   EXISTS(SELECT 1 FROM role_permissions rp WHERE rp.company_id = u.company_id AND rp.role = u.role AND rp.permission = 'mobile_login') as role_has_mobile
            FROM users u 
            WHERE u.company_id = $1 AND u.username = $2
        `).get(company.id, username);

        if (!user) {
            return res.status(401).json({ error: 'اسم المستخدم أو كلمة المرور غير صحيحة' });
        }

        if (!user.is_active) {
            return res.status(401).json({ error: 'الحساب معطل - يرجى التواصل مع المسؤول' });
        }

        // Check mobile login permission
        const isMobileAllowed = user.role === 'admin' || user.role_has_mobile || user.allow_mobile_login;

        if (req.isMobile && !isMobileAllowed) {
            return res.status(403).json({
                error: 'تسجيل الدخول من الجوال غير مصرح به لرتبتك الوظيفية',
                isMobileRestricted: true
            });
        }

        // Verify password
        const validPassword = bcrypt.compareSync(password, user.password_hash);
        if (!validPassword) {
            return res.status(401).json({ error: 'اسم المستخدم أو كلمة المرور غير صحيحة' });
        }

        // Generate JWT token including company_id
        const token = jwt.sign(
            {
                id: user.id,
                company_id: user.company_id,
                username: user.username,
                full_name: user.full_name,
                role: user.role,
                unit_number: user.unit_number
            },
            JWT_SECRET,
            { expiresIn: '12h' }
        );

        // Log activity
        await prepare(`
            INSERT INTO activity_log (company_id, event_type, description, user_id, status)
            VALUES ($1, $2, $3, $4, $5)
        `).run(user.company_id, 'system', `تسجيل دخول: ${user.full_name}`, user.id, 'success');

        res.json({
            message: 'تم تسجيل الدخول بنجاح',
            token,
            user: {
                id: user.id,
                company_id: user.company_id,
                username: user.username,
                full_name: user.full_name,
                email: user.email,
                role: user.role,
                unit_number: user.unit_number,
                company_name: company.name
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
        const user = await prepare(`
            SELECT id, username, full_name, email, role, unit_number, is_active, created_at
            FROM users WHERE id = $1
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
        await prepare(`
            INSERT INTO activity_log (event_type, description, user_id, status)
            VALUES ($1, $2, $3, $4)
        `).run('system', `تسجيل خروج: ${req.user.full_name}`, req.user.id, 'success');

        res.json({ message: 'تم تسجيل الخروج بنجاح' });

    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({ error: 'خطأ في النظام' });
    }
});

module.exports = router;
