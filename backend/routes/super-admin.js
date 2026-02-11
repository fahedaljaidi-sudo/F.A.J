const express = require('express');
const bcrypt = require('bcryptjs');
const { getDatabase, prepare, all, run, get } = require('../database/db');
const { authenticateToken, requireSuperAdmin } = require('../middleware/auth');

const router = express.Router();

// GET /api/super-admin/companies - List all companies
router.get('/companies', authenticateToken, requireSuperAdmin, async (req, res) => {
    try {
        await getDatabase();
        const companies = await all(`
            SELECT c.*
            FROM companies c
            ORDER BY c.created_at DESC
        `);
        res.json({ companies });
    } catch (error) {
        console.error('Get companies error:', error);
        res.status(500).json({ error: 'خطأ في جلب بيانات الشركات' });
    }
});

// POST /api/super-admin/companies - Register new company
router.post('/companies', authenticateToken, requireSuperAdmin, async (req, res) => {
    try {
        const { name, company_code, subscription_plan, expiry_days, max_users, admin_username, admin_password, admin_full_name, logo } = req.body;

        if (!name || !company_code || !admin_username || !admin_password) {
            return res.status(400).json({ error: 'يرجى إكمال جميع الحقول المطلوبة' });
        }

        await getDatabase();
        
        // 1. Create Company
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + (parseInt(expiry_days) || 30));

        // Handle Logo Save (if provided)
        let savedLogoPath = null;
        if (logo && logo.startsWith('data:image')) {
            const fs = require('fs');
            const path = require('path');
            const fileName = `logo_${Date.now()}_${company_code.toLowerCase()}.png`;
            const uploadDir = path.join(__dirname, '../public/uploads/logos');
            
            if (!fs.existsSync(uploadDir)) {
                fs.mkdirSync(uploadDir, { recursive: true });
            }
            
            const base64Data = logo.replace(/^data:image\/\w+;base64,/, "");
            fs.writeFileSync(path.join(uploadDir, fileName), base64Data, 'base64');
            savedLogoPath = `/uploads/logos/${fileName}`;
        }

        const companyResult = await run(`
            INSERT INTO companies (name, company_code, subscription_plan, expiry_date, max_users, logo_url, status)
            VALUES ($1, $2, $3, $4, $5, $6, 'active')
            RETURNING id
        `, [name, company_code.toUpperCase(), subscription_plan || 'basic', expiryDate.toISOString(), parseInt(max_users) || 10, savedLogoPath]);

        const companyId = companyResult.rows[0].id;

        // 2. Create Company Admin
        const passwordHash = bcrypt.hashSync(admin_password, 10);
        await run(`
            INSERT INTO users (company_id, username, password_hash, full_name, role, is_active)
            VALUES ($1, $2, $3, $4, 'admin', 1)
        `, [companyId, admin_username, passwordHash, admin_full_name]);

        // 3. Seed Default Permissions for the new company
        const defaultPermissions = [
            ['admin', 'manage_users'],
            ['admin', 'manage_permissions'],
            ['admin', 'view_reports'],
            ['admin', 'manage_visitors'],
            ['admin', 'manage_patrols'],
            ['admin', 'mobile_login'],
            ['supervisor', 'view_reports'],
            ['supervisor', 'manage_visitors'],
            ['supervisor', 'manage_patrols'],
            ['supervisor', 'mobile_login'],
            ['guard', 'manage_visitors'],
            ['guard', 'manage_patrols'],
            ['guard', 'mobile_login']
        ];

        for (const [role, perm] of defaultPermissions) {
            await run('INSERT INTO role_permissions (company_id, role, permission) VALUES ($1, $2, $3)', [companyId, role, perm]);
        }

        res.status(201).json({ message: 'تم تسجيل الشركة وإنشاء حساب المدير بنجاح', companyId });

    } catch (error) {
        console.error('Create company error:', error);
        res.status(500).json({ error: 'خطأ في إنشاء الشركة: ' + error.message });
    }
});

// PUT /api/super-admin/companies/:id - Update company data
router.put('/companies/:id', authenticateToken, requireSuperAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { status, expiry_date, name, subscription_plan, max_users, logo } = req.body;

        await getDatabase();
        
        const updates = [];
        const params = [];
        let paramIdx = 1;

        if (status) { updates.push(`status = $${paramIdx++}`); params.push(status); }
        if (expiry_date) { updates.push(`expiry_date = $${paramIdx++}`); params.push(expiry_date); }
        if (name) { updates.push(`name = $${paramIdx++}`); params.push(name); }
        if (subscription_plan) { updates.push(`subscription_plan = $${paramIdx++}`); params.push(subscription_plan); }
        if (max_users) { updates.push(`max_users = $${paramIdx++}`); params.push(parseInt(max_users)); }

        // Handle Logo Update
        if (logo && logo.startsWith('data:image')) {
            const fs = require('fs');
            const path = require('path');
            
            // Get company code for filename
            const company = await get('SELECT company_code FROM companies WHERE id = $1', id);
            const fileName = `logo_${Date.now()}_${company.company_code.toLowerCase()}.png`;
            const uploadDir = path.join(__dirname, '../public/uploads/logos');
            
            if (!fs.existsSync(uploadDir)) {
                fs.mkdirSync(uploadDir, { recursive: true });
            }
            
            const base64Data = logo.replace(/^data:image\/\w+;base64,/, "");
            fs.writeFileSync(path.join(uploadDir, fileName), base64Data, 'base64');
            const savedLogoPath = `/uploads/logos/${fileName}`;
            
            updates.push(`logo_url = $${paramIdx++}`);
            params.push(savedLogoPath);
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'لا يوجد بيانات لتحديثها' });
        }

        updates.push(`updated_at = CURRENT_TIMESTAMP`);
        params.push(id);
        
        await run(`UPDATE companies SET ${updates.join(', ')} WHERE id = $${paramIdx}`, params);

        res.json({ message: 'تم تحديث بيانات الشركة بنجاح' });
    } catch (error) {
        console.error('Update company error:', error);
        res.status(500).json({ error: 'خطأ في التحديث: ' + error.message });
    }
});

module.exports = router;
