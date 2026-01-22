const express = require('express');
const { getDatabase, prepare } = require('../database/db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// GET /api/visitors - List visitors with filters
router.get('/', authenticateToken, async (req, res) => {
    try {
        await getDatabase();
        const { date, status, search, page = 1, limit = 20 } = req.query;
        const offset = (page - 1) * limit;

        // Build query based on filters
        let visitors;
        if (date) {
            visitors = prepare(`
                SELECT v.*, u.full_name as registered_by_name
                FROM visitors v
                LEFT JOIN users u ON v.registered_by = u.id
                WHERE DATE(v.entry_time) = ?
                ORDER BY v.entry_time DESC
                LIMIT ? OFFSET ?
            `).all(date, parseInt(limit), parseInt(offset));
        } else {
            visitors = prepare(`
                SELECT v.*, u.full_name as registered_by_name
                FROM visitors v
                LEFT JOIN users u ON v.registered_by = u.id
                ORDER BY v.entry_time DESC
                LIMIT ? OFFSET ?
            `).all(parseInt(limit), parseInt(offset));
        }

        const totalResult = prepare('SELECT COUNT(*) as total FROM visitors').get();
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

        const visitors = prepare(`
            SELECT v.*, u.full_name as registered_by_name
            FROM visitors v
            LEFT JOIN users u ON v.registered_by = u.id
            WHERE DATE(v.entry_time) = ?
            ORDER BY v.entry_time DESC
        `).all(today);

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

        // Today's stats
        const total = prepare(`SELECT COUNT(*) as count FROM visitors WHERE DATE(entry_time) = ?`).get(today);
        const inside = prepare(`SELECT COUNT(*) as count FROM visitors WHERE DATE(entry_time) = ? AND status = 'inside'`).get(today);
        const left = prepare(`SELECT COUNT(*) as count FROM visitors WHERE DATE(entry_time) = ? AND status = 'left'`).get(today);

        // Yesterday for comparison
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];
        const yesterdayTotal = prepare(`SELECT COUNT(*) as count FROM visitors WHERE DATE(entry_time) = ?`).get(yesterdayStr);

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
router.post('/', authenticateToken, async (req, res) => {
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

        if (!full_name || !id_number) {
            return res.status(400).json({ error: 'الاسم ورقم الهوية مطلوبان' });
        }

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

        const visitor = prepare('SELECT * FROM visitors WHERE id = ?').get(parseInt(id));

        if (!visitor) {
            return res.status(404).json({ error: 'الزائر غير موجود' });
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

        const visitor = prepare(`
            SELECT v.*, u.full_name as registered_by_name
            FROM visitors v
            LEFT JOIN users u ON v.registered_by = u.id
            WHERE v.id = ?
        `).get(parseInt(id));

        if (!visitor) {
            return res.status(404).json({ error: 'الزائر غير موجود' });
        }

        res.json({ visitor });

    } catch (error) {
        console.error('Get visitor error:', error);
        res.status(500).json({ error: 'خطأ في جلب بيانات الزائر' });
    }
});

module.exports = router;
