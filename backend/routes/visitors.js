const express = require('express');
const { getDatabase, prepare } = require('../database/db');
const { authenticateToken } = require('../middleware/auth');
const { schemas, validate } = require('../middleware/validation');

const router = express.Router();

// GET /api/visitors - List visitors with filters
router.get('/', authenticateToken, async (req, res) => {
    try {
        await getDatabase();
        const { date, search, page = 1, limit = 20 } = req.query;
        const offset = (page - 1) * limit;
        const isAdmin = req.user.role === 'admin' || req.user.role === 'supervisor';
        const companyId = req.user.company_id;

        let query = `
            SELECT v.*, u.full_name as registered_by_name
            FROM visitors v
            LEFT JOIN users u ON v.registered_by = u.id
            WHERE v.company_id = $1
        `;
        let countQuery = `SELECT COUNT(*) as total FROM visitors WHERE company_id = $1`;
        let params = [companyId];
        let countParams = [companyId];
        let vIndex = 2;

        // Role filter
        if (!isAdmin) {
            query += ` AND v.registered_by = $${vIndex}`;
            countQuery += ` AND registered_by = $${vIndex}`;
            params.push(req.user.id);
            countParams.push(req.user.id);
            vIndex++;
        }

        if (date) {
            query += ` AND v.entry_time::date = $${vIndex}`;
            countQuery += ` AND entry_time::date = $${vIndex}`;
            params.push(date);
            countParams.push(date);
            vIndex++;
        }

        if (search) {
            query += ` AND (v.full_name ILIKE $${vIndex} OR v.id_number ILIKE $${vIndex} OR v.company ILIKE $${vIndex})`;
            countQuery += ` AND (full_name ILIKE $${vIndex} OR id_number ILIKE $${vIndex} OR company ILIKE $${vIndex})`;
            params.push(`%${search}%`);
            countParams.push(`%${search}%`);
            vIndex++;
        }

        query += ` ORDER BY v.entry_time DESC LIMIT $${vIndex} OFFSET $${vIndex + 1}`;
        params.push(parseInt(limit), parseInt(offset));

        const visitors = await prepare(query).all(...params);
        const totalResult = await prepare(countQuery).get(...countParams);

        const totalCount = totalResult ? parseInt(totalResult.total) : 0;

        res.json({
            visitors,
            pagination: {
                total: totalCount,
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil(totalCount / limit)
            }
        });

    } catch (error) {
        console.error('Get visitors error:', error);
        res.status(500).json({ error: 'خطأ في جلب بيانات الزوار' });
    }
});

// GET /api/visitors/today - Today's visitor log
router.get('/today', authenticateToken, async (req, res) => {
    try {
        await getDatabase();
        const isAdmin = req.user.role === 'admin' || req.user.role === 'supervisor';
        const companyId = req.user.company_id;

        let query = `
            SELECT v.*, u.full_name as registered_by_name
            FROM visitors v
            LEFT JOIN users u ON v.registered_by = u.id
            WHERE v.company_id = $1 AND v.entry_time::date = CURRENT_DATE
        `;
        let params = [companyId];

        if (!isAdmin) {
            query += ` AND v.registered_by = $2`;
            params.push(req.user.id);
        }

        query += ` ORDER BY v.entry_time DESC`;

        const visitors = await prepare(query).all(...params);

        res.json({ visitors, date: new Date().toISOString().split('T')[0] });

    } catch (error) {
        console.error('Get today visitors error:', error);
        res.status(500).json({ error: 'خطأ في جلب بيانات زوار اليوم' });
    }
});

// GET /api/visitors/stats - Dashboard statistics
router.get('/stats', authenticateToken, async (req, res) => {
    try {
        await getDatabase();
        const isAdmin = req.user.role === 'admin' || req.user.role === 'supervisor';
        const companyId = req.user.company_id;

        let total, inside, left, yesterdayTotal;

        if (isAdmin) {
            total = await prepare(`SELECT COUNT(*) as count FROM visitors WHERE company_id = $1 AND entry_time::date = CURRENT_DATE`).get(companyId);
            inside = await prepare(`SELECT COUNT(*) as count FROM visitors WHERE company_id = $1 AND entry_time::date = CURRENT_DATE AND status = 'inside'`).get(companyId);
            left = await prepare(`SELECT COUNT(*) as count FROM visitors WHERE company_id = $1 AND entry_time::date = CURRENT_DATE AND status = 'left'`).get(companyId);
            yesterdayTotal = await prepare(`SELECT COUNT(*) as count FROM visitors WHERE company_id = $1 AND entry_time::date = CURRENT_DATE - INTERVAL '1 day'`).get(companyId);
        } else {
            total = await prepare(`SELECT COUNT(*) as count FROM visitors WHERE company_id = $1 AND entry_time::date = CURRENT_DATE AND registered_by = $2`).get(companyId, req.user.id);
            inside = await prepare(`SELECT COUNT(*) as count FROM visitors WHERE company_id = $1 AND entry_time::date = CURRENT_DATE AND status = 'inside' AND registered_by = $2`).get(companyId, req.user.id);
            left = await prepare(`SELECT COUNT(*) as count FROM visitors WHERE company_id = $1 AND entry_time::date = CURRENT_DATE AND status = 'left' AND registered_by = $2`).get(companyId, req.user.id);
            yesterdayTotal = await prepare(`SELECT COUNT(*) as count FROM visitors WHERE company_id = $1 AND entry_time::date = CURRENT_DATE - INTERVAL '1 day' AND registered_by = $2`).get(companyId, req.user.id);
        }

        const tCount = parseInt(total?.count || 0);
        const yCount = parseInt(yesterdayTotal?.count || 0);
        let percentChange = 0;
        if (yCount > 0) {
            percentChange = Math.round(((tCount - yCount) / yCount) * 100);
        }

        res.json({
            today: {
                total: tCount,
                inside: parseInt(inside?.count || 0),
                left: parseInt(left?.count || 0)
            },
            percentChange,
            date: new Date().toISOString().split('T')[0]
        });

    } catch (error) {
        console.error('Get stats error:', error);
        res.status(500).json({ error: 'خطأ في جلب الإحصائيات' });
    }
});

// POST /api/visitors - Register new visitor entry
router.post('/', authenticateToken, validate(schemas.createVisitor), async (req, res) => {
    try {
        await getDatabase();
        const {
            full_name,
            id_number,
            phone,
            company,
            host_name,
            visit_reason,
            gate_number = '1',
            notes
        } = req.body;
        const companyId = req.user.company_id;

        const result = await prepare(`
            INSERT INTO visitors (company_id, full_name, id_number, phone, company, host_name, visit_reason, gate_number, notes, registered_by)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING id
        `).run(companyId, full_name, id_number, phone || '', company || '', host_name || '', visit_reason || '', gate_number, notes || '', req.user.id);

        await prepare(`
            INSERT INTO activity_log (company_id, event_type, description, user_id, visitor_id, location, status)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
        `).run(companyId, 'visitor_entry', `دخول زائر: ${full_name} - ${company || 'زائر شخصي'}`, req.user.id, result.lastInsertRowid, `البوابة ${gate_number}`, 'completed');

        const newVisitor = await prepare('SELECT * FROM visitors WHERE id = $1 AND company_id = $2').get(result.lastInsertRowid, companyId);

        res.status(201).json({
            message: 'تم تسجيل دخول الزائر بنجاح',
            visitor: newVisitor
        });

    } catch (error) {
        console.error('Register visitor error:', error);
        res.status(500).json({ error: 'خطأ في تسجيل الزائر' });
    }
});

// PUT /api/visitors/:id/checkout - Record visitor exit
router.put('/:id/checkout', authenticateToken, async (req, res) => {
    try {
        await getDatabase();
        const { id } = req.params;
        const isAdmin = req.user.role === 'admin' || req.user.role === 'supervisor';
        const companyId = req.user.company_id;

        const visitor = await prepare('SELECT * FROM visitors WHERE id = $1 AND company_id = $2').get(parseInt(id), companyId);

        if (!visitor) {
            return res.status(404).json({ error: 'الزائر غير موجود' });
        }

        if (!isAdmin && visitor.registered_by !== req.user.id) {
            return res.status(403).json({ error: 'غير مصرح لك بتسجيل خروج هذا الزائر' });
        }

        if (visitor.status === 'left') {
            return res.status(400).json({ error: 'تم تسجيل خروج هذا الزائر مسبقاً' });
        }

        await prepare(`UPDATE visitors SET exit_time = CURRENT_TIMESTAMP, status = 'left' WHERE id = $1 AND company_id = $2`).run(parseInt(id), companyId);

        await prepare(`
            INSERT INTO activity_log (company_id, event_type, description, user_id, visitor_id, status)
            VALUES ($1, $2, $3, $4, $5)
        `).run(companyId, 'visitor_exit', `خروج زائر: ${visitor.full_name}`, req.user.id, parseInt(id), 'completed');

        const updatedVisitor = await prepare('SELECT * FROM visitors WHERE id = $1 AND company_id = $2').get(parseInt(id), companyId);

        res.json({
            message: 'تم تسجيل خروج الزائر بنجاح',
            visitor: updatedVisitor
        });

    } catch (error) {
        console.error('Checkout visitor error:', error);
        res.status(500).json({ error: 'خطأ في تسجيل الخروج' });
    }
});

// GET /api/visitors/:id - Get single visitor
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        await getDatabase();
        const { id } = req.params;
        const isAdmin = req.user.role === 'admin' || req.user.role === 'supervisor';
        const companyId = req.user.company_id;

        const visitor = await prepare(`
            SELECT v.*, u.full_name as registered_by_name
            FROM visitors v
            LEFT JOIN users u ON v.registered_by = u.id
            WHERE v.id = $1 AND v.company_id = $2
        `).get(parseInt(id), companyId);

        if (!visitor) {
            return res.status(404).json({ error: 'الزائر غير موجود' });
        }

        if (!isAdmin && visitor.registered_by !== req.user.id) {
            return res.status(403).json({ error: 'غير مصرح لك وعرض تفاصيل هذا الزائر' });
        }

        res.json({ visitor });

    } catch (error) {
        console.error('Get visitor error:', error);
        res.status(500).json({ error: 'خطأ في جلب بيانات الزائر' });
    }
});

module.exports = router;