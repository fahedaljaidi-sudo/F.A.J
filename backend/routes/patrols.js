const express = require('express');
const { getDatabase, prepare } = require('../database/db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// GET /api/patrols - List patrol rounds
router.get('/', authenticateToken, async (req, res) => {
    try {
        await getDatabase();
        const { date, page = 1, limit = 20 } = req.query;
        const offset = (page - 1) * limit;

        let patrols;
        if (date) {
            patrols = prepare(`
                SELECT p.*, u.full_name as guard_name, u.unit_number
                FROM patrol_rounds p
                LEFT JOIN users u ON p.guard_id = u.id
                WHERE DATE(p.patrol_time) = ?
                ORDER BY p.patrol_time DESC
                LIMIT ? OFFSET ?
            `).all(date, parseInt(limit), parseInt(offset));
        } else {
            patrols = prepare(`
                SELECT p.*, u.full_name as guard_name, u.unit_number
                FROM patrol_rounds p
                LEFT JOIN users u ON p.guard_id = u.id
                ORDER BY p.patrol_time DESC
                LIMIT ? OFFSET ?
            `).all(parseInt(limit), parseInt(offset));
        }

        const totalResult = prepare('SELECT COUNT(*) as total FROM patrol_rounds').get();

        res.json({
            patrols,
            pagination: {
                total: totalResult ? totalResult.total : 0,
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil((totalResult?.total || 0) / limit)
            }
        });

    } catch (error) {
        console.error('Get patrols error:', error);
        res.status(500).json({ error: 'خطأ في جلب بيانات الدوريات' });
    }
});

// GET /api/patrols/recent - Recent logs for sidebar
router.get('/recent', authenticateToken, async (req, res) => {
    try {
        await getDatabase();
        const { limit = 5 } = req.query;
        const isAdmin = req.user.role === 'admin' || req.user.role === 'supervisor';

        console.log('--- PATROLS/RECENT DEBUG ---');
        console.log('User ID:', req.user.id);
        console.log('User Name:', req.user.full_name);
        console.log('User Role:', req.user.role);
        console.log('Is Admin:', isAdmin);

        let patrols;
        if (isAdmin) {
            // Admins and supervisors see all patrols
            patrols = prepare(`
                SELECT p.*, u.full_name as guard_name
                FROM patrol_rounds p
                LEFT JOIN users u ON p.guard_id = u.id
                ORDER BY p.patrol_time DESC
                LIMIT ?
            `).all(parseInt(limit));
        } else {
            // Guards see only their own patrols
            patrols = prepare(`
                SELECT p.*, u.full_name as guard_name
                FROM patrol_rounds p
                LEFT JOIN users u ON p.guard_id = u.id
                WHERE p.guard_id = ?
                ORDER BY p.patrol_time DESC
                LIMIT ?
            `).all(req.user.id, parseInt(limit));
        }

        console.log('Patrols found:', patrols.length);
        res.json({ patrols });

    } catch (error) {
        console.error('Get recent patrols error:', error);
        res.status(500).json({ error: 'خطأ في جلب آخر الدوريات' });
    }
});

// GET /api/patrols/guard/:id - Get patrols for specific guard
router.get('/guard/:id', authenticateToken, async (req, res) => {
    try {
        await getDatabase();
        const { id } = req.params;
        const { limit = 50 } = req.query;

        const patrols = prepare(`
            SELECT p.*, u.full_name as guard_name
            FROM patrol_rounds p
            LEFT JOIN users u ON p.guard_id = u.id
            WHERE p.guard_id = ?
            ORDER BY p.patrol_time DESC
            LIMIT ?
        `).all(parseInt(id), parseInt(limit));

        res.json({ patrols });

    } catch (error) {
        console.error('Get guard patrols error:', error);
        res.status(500).json({ error: 'خطأ في جلب جولات الحارس' });
    }
});

// GET /api/patrols/shift-status - Current shift statistics
router.get('/shift-status', authenticateToken, async (req, res) => {
    try {
        await getDatabase();
        const today = new Date().toISOString().split('T')[0];
        const isAdmin = req.user.role === 'admin' || req.user.role === 'supervisor';

        let completed, normal, observation, danger;

        if (isAdmin) {
            // Admins see all patrols
            completed = prepare(`SELECT COUNT(*) as count FROM patrol_rounds WHERE DATE(patrol_time) = ?`).get(today);
            normal = prepare(`SELECT COUNT(*) as count FROM patrol_rounds WHERE DATE(patrol_time) = ? AND security_status = 'normal'`).get(today);
            observation = prepare(`SELECT COUNT(*) as count FROM patrol_rounds WHERE DATE(patrol_time) = ? AND security_status = 'observation'`).get(today);
            danger = prepare(`SELECT COUNT(*) as count FROM patrol_rounds WHERE DATE(patrol_time) = ? AND security_status = 'danger'`).get(today);
        } else {
            // Guards see only their own patrols
            completed = prepare(`SELECT COUNT(*) as count FROM patrol_rounds WHERE DATE(patrol_time) = ? AND guard_id = ?`).get(today, req.user.id);
            normal = prepare(`SELECT COUNT(*) as count FROM patrol_rounds WHERE DATE(patrol_time) = ? AND security_status = 'normal' AND guard_id = ?`).get(today, req.user.id);
            observation = prepare(`SELECT COUNT(*) as count FROM patrol_rounds WHERE DATE(patrol_time) = ? AND security_status = 'observation' AND guard_id = ?`).get(today, req.user.id);
            danger = prepare(`SELECT COUNT(*) as count FROM patrol_rounds WHERE DATE(patrol_time) = ? AND security_status = 'danger' AND guard_id = ?`).get(today, req.user.id);
        }

        res.json({
            completed: completed ? completed.count : 0,
            expected: 6,
            normal: normal ? normal.count : 0,
            observation: observation ? observation.count : 0,
            danger: danger ? danger.count : 0,
            date: today
        });

    } catch (error) {
        console.error('Get shift status error:', error);
        res.status(500).json({ error: 'خطأ في جلب حالة الوردية' });
    }
});

// GET /api/patrols/locations - Get predefined locations
router.get('/locations', authenticateToken, async (req, res) => {
    try {
        await getDatabase();
        const locations = prepare('SELECT * FROM locations ORDER BY name_ar').all();
        res.json({ locations });
    } catch (error) {
        console.error('Get locations error:', error);
        res.status(500).json({ error: 'خطأ في جلب المواقع' });
    }
});

// POST /api/patrols - Log new patrol round
router.post('/', authenticateToken, async (req, res) => {
    try {
        await getDatabase();
        const { location, security_status, notes, attachments } = req.body;

        if (!location) {
            return res.status(400).json({ error: 'الموقع مطلوب' });
        }

        if (!['normal', 'observation', 'danger'].includes(security_status)) {
            return res.status(400).json({ error: 'حالة أمنية غير صالحة' });
        }

        const patrol_time = new Date().toISOString();
        const attachmentsJson = attachments ? JSON.stringify(attachments) : '';

        const result = prepare(`
            INSERT INTO patrol_rounds (guard_id, location, security_status, notes, attachments, patrol_time)
            VALUES (?, ?, ?, ?, ?, ?)
        `).run(req.user.id, location, security_status, notes || '', attachmentsJson, patrol_time);

        const statusText = { 'normal': 'طبيعي', 'observation': 'ملاحظة', 'danger': 'خطر' };
        const description = notes
            ? `جولة أمنية: ${location} - ${statusText[security_status]} | ${notes}`
            : `جولة أمنية: ${location} - ${statusText[security_status]}`;

        prepare(`
            INSERT INTO activity_log (event_type, description, user_id, patrol_id, location, status)
            VALUES (?, ?, ?, ?, ?, ?)
        `).run('patrol', description, req.user.id, result.lastInsertRowid, location, security_status === 'normal' ? 'completed' : 'review');

        const newPatrol = prepare(`
            SELECT p.*, u.full_name as guard_name
            FROM patrol_rounds p
            LEFT JOIN users u ON p.guard_id = u.id
            WHERE p.id = ?
        `).get(result.lastInsertRowid);

        res.status(201).json({
            message: 'تم تسجيل الجولة بنجاح',
            patrol: newPatrol
        });

    } catch (error) {
        console.error('Create patrol error:', error);
        res.status(500).json({ error: 'خطأ في تسجيل الجولة' });
    }
});

// PUT /api/patrols/:id - Update patrol
router.put('/:id', authenticateToken, async (req, res) => {
    try {
        await getDatabase();
        const { id } = req.params;
        const { location, security_status, notes } = req.body;

        prepare(`
            UPDATE patrol_rounds 
            SET location = ?, security_status = ?, notes = ?
            WHERE id = ?
        `).run(location, security_status, notes || '', id);

        res.json({ message: 'تم تحديث الجولة بنجاح' });

    } catch (error) {
        console.error('Update patrol error:', error);
        res.status(500).json({ error: 'خطأ في تحديث الجولة' });
    }
});

// PUT /api/patrols/:id/status - Change resolution status
router.put('/:id/status', authenticateToken, async (req, res) => {
    try {
        await getDatabase();
        const { id } = req.params;
        const { resolution_status } = req.body;

        prepare(`
            UPDATE patrol_rounds 
            SET resolution_status = ?
            WHERE id = ?
        `).run(resolution_status, id);

        res.json({ message: 'تم تحديث حالة الجولة' });

    } catch (error) {
        console.error('Change status error:', error);
        res.status(500).json({ error: 'خطأ في تحديث الحالة' });
    }
});

module.exports = router;
