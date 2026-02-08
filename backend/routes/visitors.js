const express = require('express');
const { getDatabase, prepare } = require('../database/db');
const { authenticateToken } = require('../middleware/auth');
const { schemas, validate } = require('../middleware/validation');

const router = express.Router();

// GET /api/visitors - List visitors with filters
router.get('/', authenticateToken, async (req, res) => {
    try {
        await getDatabase();
        const { date, status, search, page = 1, limit = 20 } = req.query;
        const offset = (page - 1) * limit;
        const isAdmin = req.user.role === 'admin' || req.user.role === 'supervisor';

        // Build query based on filters
        let visitors, totalResult;

        let query = `
            SELECT v.*, u.full_name as registered_by_name
            FROM visitors v
            LEFT JOIN users u ON v.registered_by = u.id
            WHERE 1=1
        `;
        let countQuery = `SELECT COUNT(*) as total FROM visitors WHERE 1=1`;
        let params = [];
        let countParams = [];

        // Role filter
        if (!isAdmin) {
            query += ` AND v.registered_by = ?`;
            countQuery += ` AND registered_by = ?`;
            params.push(req.user.id);
            countParams.push(req.user.id);
        }

        if (date) {
            query += ` AND DATE(v.entry_time) = ?`;
            countQuery += ` AND DATE(entry_time) = ?`;
            params.push(date);
            countParams.push(date);
        }

        query += ` ORDER BY v.entry_time DESC LIMIT ? OFFSET ?`;
        params.push(parseInt(limit), parseInt(offset));

        visitors = prepare(query).all(...params);
        totalResult = prepare(countQuery).get(...countParams);

        const totalCount = totalResult ? totalResult.total : 0;

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
        const today = new Date().toISOString().split('T')[0];
        const isAdmin = req.user.role === 'admin' || req.user.role === 'supervisor';

        let query = `
            SELECT v.*, u.full_name as registered_by_name
            FROM visitors v
            LEFT JOIN users u ON v.registered_by = u.id
            WHERE DATE(v.entry_time) = ?
        `;
        let params = [today];

        if (!isAdmin) {
            query += ` AND v.registered_by = ?`;
            params.push(req.user.id);
        }

        query += ` ORDER BY v.entry_time DESC`;

        const visitors = prepare(query).all(...params);

        res.json({ visitors, date: today });

    } catch (error) {
        console.error('Get today visitors error:', error);
        res.status(500).json({ error: 'خطأ في جلب بيانات زوار اليوم' });
    }
});

// GET /api/visitors/stats - Dashboard statistics
router.get('/stats', authenticateToken, async (req, res) => {
    try {
        await getDatabase();
        const today = new Date().toISOString().split('T')[0];
        const isAdmin = req.user.role === 'admin' || req.user.role === 'supervisor';

        let total, inside, left, yesterdayTotal;

        if (isAdmin) {
            // Admin sees all stats
            total = prepare(`SELECT COUNT(*) as count FROM visitors WHERE DATE(entry_time) = ?`).get(today);
            inside = prepare(`SELECT COUNT(*) as count FROM visitors WHERE DATE(entry_time) = ? AND status = 'inside'`).get(today);
            left = prepare(`SELECT COUNT(*) as count FROM visitors WHERE DATE(entry_time) = ? AND status = 'left'`).get(today);

            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const yesterdayStr = yesterday.toISOString().split('T')[0];
            yesterdayTotal = prepare(`SELECT COUNT(*) as count FROM visitors WHERE DATE(entry_time) = ?`).get(yesterdayStr);
        } else {
            // Guard sees only their stats
            total = prepare(`SELECT COUNT(*) as count FROM visitors WHERE DATE(entry_time) = ? AND registered_by = ?`).get(today, req.user.id);
            inside = prepare(`SELECT COUNT(*) as count FROM visitors WHERE DATE(entry_time) = ? AND status = 'inside' AND registered_by = ?`).get(today, req.user.id);
            left = prepare(`SELECT COUNT(*) as count FROM visitors WHERE DATE(entry_time) = ? AND status = 'left' AND registered_by = ?`).get(today, req.user.id);

            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const yesterdayStr = yesterday.toISOString().split('T')[0];
            yesterdayTotal = prepare(`SELECT COUNT(*) as count FROM visitors WHERE DATE(entry_time) = ? AND registered_by = ?`).get(yesterdayStr, req.user.id);
        }

        let percentChange = 0;
        if (yesterdayTotal && yesterdayTotal.count > 0) {
            percentChange = Math.round(((total.count - yesterdayTotal.count) / yesterdayTotal.count) * 100);
        }

        res.json({
            today: {
                total: total ? total.count : 0,
                inside: inside ? inside.count : 0,
                left: left ? left.count : 0
            },
            percentChange,
            date: today
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

        const entry_time = new Date().toISOString();

        const result = prepare(`
            INSERT INTO visitors (full_name, id_number, phone, company, host_name, visit_reason, entry_time, gate_number, notes, registered_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(full_name, id_number, phone || '', company || '', host_name || '', visit_reason || '', entry_time, gate_number, notes || '', req.user.id);

        // Log activity
        prepare(`
            INSERT INTO activity_log (event_type, description, user_id, visitor_id, location, status)
            VALUES (?, ?, ?, ?, ?, ?)
        `).run('visitor_entry', `دخول زائر: ${full_name} - ${company || 'زائر شخصي'}`, req.user.id, result.lastInsertRowid, `البوابة ${gate_number}`, 'completed');

        const newVisitor = prepare('SELECT * FROM visitors WHERE id = ?').get(result.lastInsertRowid);

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
        const exit_time = new Date().toISOString();
        const isAdmin = req.user.role === 'admin' || req.user.role === 'supervisor';

        const visitor = prepare('SELECT * FROM visitors WHERE id = ?').get(parseInt(id));

        if (!visitor) {
            return res.status(404).json({ error: 'الزائر غير موجود' });
        }

        // Enforce ownership for non-admins
        if (!isAdmin && visitor.registered_by !== req.user.id) {
            return res.status(403).json({ error: 'غير مصرح لك بتسجيل خروج هذا الزائر' });
        }

        if (visitor.status === 'left') {
            return res.status(400).json({ error: 'تم تسجيل خروج هذا الزائر مسبقاً' });
        }

        prepare(`UPDATE visitors SET exit_time = ?, status = 'left' WHERE id = ?`).run(exit_time, parseInt(id));

        // Log activity
        prepare(`
            INSERT INTO activity_log (event_type, description, user_id, visitor_id, status)
            VALUES (?, ?, ?, ?, ?)
        `).run('visitor_exit', `خروج زائر: ${visitor.full_name}`, req.user.id, parseInt(id), 'completed');

        const updatedVisitor = prepare('SELECT * FROM visitors WHERE id = ?').get(parseInt(id));

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

        const visitor = prepare(`
            SELECT v.*, u.full_name as registered_by_name
            FROM visitors v
            LEFT JOIN users u ON v.registered_by = u.id
            WHERE v.id = ?
        `).get(parseInt(id));

        if (!visitor) {
            return res.status(404).json({ error: 'الزائر غير موجود' });
        }

        // Enforce ownership for non-admins
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
