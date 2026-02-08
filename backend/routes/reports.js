const express = require('express');
const { getDatabase, prepare } = require('../database/db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// GET /api/reports - Get filtered activity log
router.get('/', authenticateToken, async (req, res) => {
    try {
        await getDatabase();
        const { from_date, to_date, user_id, page = 1, limit = 20 } = req.query;
        const offset = (page - 1) * limit;
        const isAdmin = req.user.role === 'admin' || req.user.role === 'supervisor';

        let logs, totalResult;

        let query = `
            SELECT a.*, u.full_name as user_name, v.full_name as visitor_name, v.company as visitor_company,
                   p.notes as patrol_notes
            FROM activity_log a
            LEFT JOIN users u ON a.user_id = u.id
            LEFT JOIN visitors v ON a.visitor_id = v.id
            LEFT JOIN patrol_rounds p ON a.patrol_id = p.id
            WHERE 1=1
        `;
        let countQuery = `SELECT COUNT(*) as total FROM activity_log a WHERE 1=1`;
        let params = [];
        let pIndex = 1;

        if (!isAdmin) {
            query += ` AND a.user_id = $${pIndex}`;
            countQuery += ` AND user_id = $${pIndex}`;
            params.push(req.user.id);
            pIndex++;
        } else if (user_id) {
            query += ` AND a.user_id = $${pIndex}`;
            countQuery += ` AND user_id = $${pIndex}`;
            params.push(user_id);
            pIndex++;
        }

        if (from_date && to_date) {
            const startDateTime = `${from_date} 00:00:00`;
            const endDateTime = `${to_date} 23:59:59`;
            query += ` AND a.event_time >= $${pIndex} AND a.event_time <= $${pIndex + 1}`;
            countQuery += ` AND event_time >= $${pIndex} AND event_time <= $${pIndex + 1}`;
            params.push(startDateTime, endDateTime);
            pIndex += 2;
        }

        totalResult = await prepare(countQuery).get(...params.slice(0, pIndex - 1));

        query += ` ORDER BY a.event_time DESC LIMIT $${pIndex} OFFSET $${pIndex + 1}`;
        params.push(parseInt(limit), parseInt(offset));

        logs = await prepare(query).all(...params);

        res.json({
            logs,
            pagination: {
                total: totalResult ? parseInt(totalResult.total) : 0,
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil((parseInt(totalResult?.total || 0)) / limit)
            }
        });

    } catch (error) {
        console.error('❌ Get reports error:', error);
        res.status(500).json({
            error: 'خطأ في جلب التقارير',
            details: error.message
        });
    }
});

// GET /api/reports/summary - Get summary statistics
router.get('/summary', authenticateToken, async (req, res) => {
    try {
        await getDatabase();
        const isAdmin = req.user.role === 'admin' || req.user.role === 'supervisor';

        let visitors, patrols, normalPatrols, observationPatrols, dangerPatrols;

        if (isAdmin) {
            visitors = await prepare('SELECT COUNT(*) as total FROM visitors').get();
            patrols = await prepare('SELECT COUNT(*) as total FROM patrol_rounds').get();
            normalPatrols = await prepare(`SELECT COUNT(*) as count FROM patrol_rounds WHERE security_status = 'normal'`).get();
            observationPatrols = await prepare(`SELECT COUNT(*) as count FROM patrol_rounds WHERE security_status = 'observation'`).get();
            dangerPatrols = await prepare(`SELECT COUNT(*) as count FROM patrol_rounds WHERE security_status = 'danger'`).get();
        } else {
            visitors = await prepare('SELECT COUNT(*) as total FROM visitors WHERE registered_by = $1').get(req.user.id);
            patrols = await prepare('SELECT COUNT(*) as total FROM patrol_rounds WHERE guard_id = $1').get(req.user.id);
            normalPatrols = await prepare(`SELECT COUNT(*) as count FROM patrol_rounds WHERE security_status = 'normal' AND guard_id = $1`).get(req.user.id);
            observationPatrols = await prepare(`SELECT COUNT(*) as count FROM patrol_rounds WHERE security_status = 'observation' AND guard_id = $1`).get(req.user.id);
            dangerPatrols = await prepare(`SELECT COUNT(*) as count FROM patrol_rounds WHERE security_status = 'danger' AND guard_id = $1`).get(req.user.id);
        }

        res.json({
            visitors: { total: visitors ? parseInt(visitors.total) : 0 },
            patrols: {
                total: patrols ? parseInt(patrols.total) : 0,
                normal: normalPatrols ? parseInt(normalPatrols.count) : 0,
                observation: observationPatrols ? parseInt(observationPatrols.count) : 0,
                danger: dangerPatrols ? parseInt(dangerPatrols.count) : 0
            }
        });

    } catch (error) {
        console.error('Get summary error:', error);
        res.status(500).json({ error: 'خطأ في جلب الملخص' });
    }
});

// GET /api/reports/recent - Recent activity for dashboard
router.get('/recent', authenticateToken, async (req, res) => {
    try {
        await getDatabase();
        const { limit = 10 } = req.query;
        const isAdmin = req.user.role === 'admin' || req.user.role === 'supervisor';

        let logs;
        if (isAdmin) {
            logs = await prepare(`
                SELECT a.*, u.full_name as user_name, v.full_name as visitor_name
                FROM activity_log a
                LEFT JOIN users u ON a.user_id = u.id
                LEFT JOIN visitors v ON a.visitor_id = v.id
                ORDER BY a.event_time DESC
                LIMIT $1
            `).all(parseInt(limit));
        } else {
            logs = await prepare(`
                SELECT a.*, u.full_name as user_name, v.full_name as visitor_name
                FROM activity_log a
                LEFT JOIN users u ON a.user_id = u.id
                LEFT JOIN visitors v ON a.visitor_id = v.id
                WHERE a.user_id = $1
                ORDER BY a.event_time DESC
                LIMIT $2
            `).all(req.user.id, parseInt(limit));
        }

        res.json({ logs });

    } catch (error) {
        console.error('Get recent activity error:', error);
        res.status(500).json({ error: 'خطأ في جلب النشاط الأخير' });
    }
});

module.exports = router;