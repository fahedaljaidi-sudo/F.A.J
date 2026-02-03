const express = require('express');
const { getDatabase, prepare } = require('../database/db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// GET /api/reports - Get filtered activity log
router.get('/', authenticateToken, async (req, res) => {
    try {
        await getDatabase();
        const { from_date, to_date, event_type, page = 1, limit = 20 } = req.query;
        const offset = (page - 1) * limit;
        const isAdmin = req.user.role === 'admin' || req.user.role === 'supervisor';

        let logs, totalResult;

        if (isAdmin) {
            // Admins see all activities (with optional filters)
            let query = `
                SELECT a.*, u.full_name as user_name, v.full_name as visitor_name, v.company as visitor_company,
                       p.notes as patrol_notes
                FROM activity_log a
                LEFT JOIN users u ON a.user_id = u.id
                LEFT JOIN visitors v ON a.visitor_id = v.id
                LEFT JOIN patrol_rounds p ON a.patrol_id = p.id
                WHERE 1=1
            `;
            const params = [];

            if (from_date && to_date) {
                const startDateTime = `${from_date} 00:00:00`;
                const endDateTime = `${to_date} 23:59:59`;
                query += ` AND a.event_time >= ? AND a.event_time <= ?`;
                params.push(startDateTime, endDateTime);
            }

            if (req.query.user_id) {
                query += ` AND a.user_id = ?`;
                params.push(req.query.user_id);
            }

            // Get total count for pagination before limit/offset
            // We need a separate query for count that matches the filters
            let countQuery = `SELECT COUNT(*) as total FROM activity_log a WHERE 1=1`;
            const countParams = [];

            if (from_date && to_date) {
                const startDateTime = `${from_date} 00:00:00`;
                const endDateTime = `${to_date} 23:59:59`;
                countQuery += ` AND a.event_time >= ? AND a.event_time <= ?`;
                countParams.push(startDateTime, endDateTime);
            }

            if (req.query.user_id) {
                countQuery += ` AND a.user_id = ?`;
                countParams.push(req.query.user_id);
            }

            totalResult = prepare(countQuery).get(...countParams);

            // Add ordering and pagination
            query += ` ORDER BY a.event_time DESC LIMIT ? OFFSET ?`;
            params.push(parseInt(limit), parseInt(offset));

            logs = prepare(query).all(...params);
        } else {
            // Guards see only their own activities
            if (from_date && to_date) {
                // Append time to ensure full day coverage
                const startDateTime = `${from_date} 00:00:00`;
                const endDateTime = `${to_date} 23:59:59`;

                logs = prepare(`
                    SELECT a.*, u.full_name as user_name, v.full_name as visitor_name, v.company as visitor_company,
                           p.notes as patrol_notes
                    FROM activity_log a
                    LEFT JOIN users u ON a.user_id = u.id
                    LEFT JOIN visitors v ON a.visitor_id = v.id
                    LEFT JOIN patrol_rounds p ON a.patrol_id = p.id
                    WHERE a.event_time >= ? AND a.event_time <= ? AND a.user_id = ?
                    ORDER BY a.event_time DESC
                    LIMIT ? OFFSET ?
                `).all(startDateTime, endDateTime, req.user.id, parseInt(limit), parseInt(offset));
            } else {
                logs = prepare(`
                    SELECT a.*, u.full_name as user_name, v.full_name as visitor_name, v.company as visitor_company,
                           p.notes as patrol_notes
                    FROM activity_log a
                    LEFT JOIN users u ON a.user_id = u.id
                    LEFT JOIN visitors v ON a.visitor_id = v.id
                    LEFT JOIN patrol_rounds p ON a.patrol_id = p.id
                    WHERE a.user_id = ?
                    ORDER BY a.event_time DESC
                    LIMIT ? OFFSET ?
                `).all(req.user.id, parseInt(limit), parseInt(offset));
            }
            totalResult = prepare('SELECT COUNT(*) as total FROM activity_log WHERE user_id = ?').get(req.user.id);
        }

        res.json({
            logs,
            pagination: {
                total: totalResult ? totalResult.total : 0,
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil((totalResult?.total || 0) / limit)
            }
        });

    } catch (error) {
        console.error('❌ Get reports error:', error);
        if (error.code === 'SqliteError') {
            console.error('SQL Query Error Details:', error.message);
        }
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
            // Admins see all statistics
            visitors = prepare('SELECT COUNT(*) as total FROM visitors').get();
            patrols = prepare('SELECT COUNT(*) as total FROM patrol_rounds').get();
            normalPatrols = prepare(`SELECT COUNT(*) as count FROM patrol_rounds WHERE security_status = 'normal'`).get();
            observationPatrols = prepare(`SELECT COUNT(*) as count FROM patrol_rounds WHERE security_status = 'observation'`).get();
            dangerPatrols = prepare(`SELECT COUNT(*) as count FROM patrol_rounds WHERE security_status = 'danger'`).get();
        } else {
            // Guards see only their own statistics
            visitors = prepare('SELECT COUNT(*) as total FROM visitors WHERE registered_by = ?').get(req.user.id);
            patrols = prepare('SELECT COUNT(*) as total FROM patrol_rounds WHERE guard_id = ?').get(req.user.id);
            normalPatrols = prepare(`SELECT COUNT(*) as count FROM patrol_rounds WHERE security_status = 'normal' AND guard_id = ?`).get(req.user.id);
            observationPatrols = prepare(`SELECT COUNT(*) as count FROM patrol_rounds WHERE security_status = 'observation' AND guard_id = ?`).get(req.user.id);
            dangerPatrols = prepare(`SELECT COUNT(*) as count FROM patrol_rounds WHERE security_status = 'danger' AND guard_id = ?`).get(req.user.id);
        }

        res.json({
            visitors: { total: visitors ? visitors.total : 0 },
            patrols: {
                total: patrols ? patrols.total : 0,
                normal: normalPatrols ? normalPatrols.count : 0,
                observation: observationPatrols ? observationPatrols.count : 0,
                danger: dangerPatrols ? dangerPatrols.count : 0
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
            // Admins and supervisors see all activity
            logs = prepare(`
                SELECT a.*, u.full_name as user_name, v.full_name as visitor_name
                FROM activity_log a
                LEFT JOIN users u ON a.user_id = u.id
                LEFT JOIN visitors v ON a.visitor_id = v.id
                ORDER BY a.event_time DESC
                LIMIT ?
            `).all(parseInt(limit));
        } else {
            // Guards see only their own activity
            logs = prepare(`
                SELECT a.*, u.full_name as user_name, v.full_name as visitor_name
                FROM activity_log a
                LEFT JOIN users u ON a.user_id = u.id
                LEFT JOIN visitors v ON a.visitor_id = v.id
                WHERE a.user_id = ?
                ORDER BY a.event_time DESC
                LIMIT ?
            `).all(req.user.id, parseInt(limit));
        }

        res.json({ logs });

    } catch (error) {
        console.error('Get recent activity error:', error);
        res.status(500).json({ error: 'خطأ في جلب النشاط الأخير' });
    }
});

module.exports = router;
