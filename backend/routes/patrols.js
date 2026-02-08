const express = require('express');
const { getDatabase, prepare } = require('../database/db');
const { authenticateToken } = require('../middleware/auth');
const { saveBase64Image } = require('../utils/fileHandler');
const { schemas, validate } = require('../middleware/validation');

const router = express.Router();

// GET /api/patrols - List patrol rounds
router.get('/', authenticateToken, async (req, res) => {
    try {
        await getDatabase();
        const { date, page = 1, limit = 20 } = req.query;
        const offset = (page - 1) * limit;
        const isAdmin = req.user.role === 'admin' || req.user.role === 'supervisor';

        let query = `
            SELECT p.*, u.full_name as guard_name, u.unit_number
            FROM patrol_rounds p
            LEFT JOIN users u ON p.guard_id = u.id
            WHERE 1=1
        `;
        let countQuery = `SELECT COUNT(*) as total FROM patrol_rounds WHERE 1=1`;
        let params = [];
        let countParams = [];
        let pIndex = 1;

        // Role filter
        if (!isAdmin) {
            query += ` AND p.guard_id = $${pIndex}`;
            countQuery += ` AND guard_id = $${pIndex}`;
            params.push(req.user.id);
            countParams.push(req.user.id);
            pIndex++;
        }

        if (date) {
            query += ` AND p.patrol_time::date = $${pIndex}`;
            countQuery += ` AND patrol_time::date = $${pIndex}`;
            params.push(date);
            countParams.push(date);
            pIndex++;
        }

        query += ` ORDER BY p.patrol_time DESC LIMIT $${pIndex} OFFSET $${pIndex + 1}`;
        params.push(parseInt(limit), parseInt(offset));

        const patrols = await prepare(query).all(...params);
        const totalResult = await prepare(countQuery).get(...countParams);

        res.json({
            patrols,
            pagination: {
                total: totalResult ? parseInt(totalResult.total) : 0,
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

        let patrols;
        if (isAdmin) {
            patrols = await prepare(`
                SELECT p.*, u.full_name as guard_name
                FROM patrol_rounds p
                LEFT JOIN users u ON p.guard_id = u.id
                ORDER BY p.patrol_time DESC
                LIMIT $1
            `).all(parseInt(limit));
        } else {
            patrols = await prepare(`
                SELECT p.*, u.full_name as guard_name
                FROM patrol_rounds p
                LEFT JOIN users u ON p.guard_id = u.id
                WHERE p.guard_id = $1
                ORDER BY p.patrol_time DESC
                LIMIT $2
            `).all(req.user.id, parseInt(limit));
        }

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

        const patrols = await prepare(`
            SELECT p.*, u.full_name as guard_name
            FROM patrol_rounds p
            LEFT JOIN users u ON p.guard_id = u.id
            WHERE p.guard_id = $1
            ORDER BY p.patrol_time DESC
            LIMIT $2
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
        const isAdmin = req.user.role === 'admin' || req.user.role === 'supervisor';

        let completed, normal, observation, danger;

        if (isAdmin) {
            completed = await prepare(`SELECT COUNT(*) as count FROM patrol_rounds WHERE patrol_time::date = CURRENT_DATE`).get();
            normal = await prepare(`SELECT COUNT(*) as count FROM patrol_rounds WHERE patrol_time::date = CURRENT_DATE AND security_status = 'normal'`).get();
            observation = await prepare(`SELECT COUNT(*) as count FROM patrol_rounds WHERE patrol_time::date = CURRENT_DATE AND security_status = 'observation'`).get();
            danger = await prepare(`SELECT COUNT(*) as count FROM patrol_rounds WHERE patrol_time::date = CURRENT_DATE AND security_status = 'danger'`).get();
        } else {
            completed = await prepare(`SELECT COUNT(*) as count FROM patrol_rounds WHERE patrol_time::date = CURRENT_DATE AND guard_id = $1`).get(req.user.id);
            normal = await prepare(`SELECT COUNT(*) as count FROM patrol_rounds WHERE patrol_time::date = CURRENT_DATE AND security_status = 'normal' AND guard_id = $1`).get(req.user.id);
            observation = await prepare(`SELECT COUNT(*) as count FROM patrol_rounds WHERE patrol_time::date = CURRENT_DATE AND security_status = 'observation' AND guard_id = $1`).get(req.user.id);
            danger = await prepare(`SELECT COUNT(*) as count FROM patrol_rounds WHERE patrol_time::date = CURRENT_DATE AND security_status = 'danger' AND guard_id = $1`).get(req.user.id);
        }

        res.json({
            completed: completed ? parseInt(completed.count) : 0,
            expected: 6,
            normal: normal ? parseInt(normal.count) : 0,
            observation: observation ? parseInt(observation.count) : 0,
            danger: danger ? parseInt(danger.count) : 0,
            date: new Date().toISOString().split('T')[0]
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
        const locations = await prepare('SELECT * FROM locations ORDER BY name_ar').all();
        res.json({ locations });
    } catch (error) {
        console.error('Get locations error:', error);
        res.status(500).json({ error: 'خطأ في جلب المواقع' });
    }
});

// POST /api/patrols - Log new patrol round
router.post('/', authenticateToken, validate(schemas.createPatrol), async (req, res) => {
    try {
        await getDatabase();
        const { location, security_status, notes, attachments, image } = req.body;

        // Handle Image: Save to disk if provided
        let savedImagePath = '';
        const rawImage = image || attachments; 
        
        if (rawImage && (rawImage.startsWith('data:image') || rawImage.length > 200)) {
            const savedPath = saveBase64Image(rawImage);
            if (savedPath) savedImagePath = savedPath;
        } else if (attachments) {
            savedImagePath = attachments;
        }

        const result = await prepare(`
            INSERT INTO patrol_rounds (guard_id, location, security_status, notes, attachments)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id
        `).run(req.user.id, location, security_status, notes || '', savedImagePath);

        const statusText = { 'normal': 'طبيعي', 'observation': 'ملاحظة', 'danger': 'خطر' };
        const description = notes
            ? `جولة أمنية: ${location} - ${statusText[security_status]} | ${notes}`
            : `جولة أمنية: ${location} - ${statusText[security_status]}`;

        await prepare(`
            INSERT INTO activity_log (event_type, description, user_id, patrol_id, location, status)
            VALUES ($1, $2, $3, $4, $5, $6)
        `).run('patrol', description, req.user.id, result.lastInsertRowid, location, security_status === 'normal' ? 'completed' : 'review');

        const newPatrol = await prepare(`
            SELECT p.*, u.full_name as guard_name
            FROM patrol_rounds p
            LEFT JOIN users u ON p.guard_id = u.id
            WHERE p.id = $1
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
        const isAdmin = req.user.role === 'admin' || req.user.role === 'supervisor';

        const patrol = await prepare('SELECT * FROM patrol_rounds WHERE id = $1').get(id);

        if (!patrol) {
            return res.status(404).json({ error: 'الجولة غير موجودة' });
        }

        if (!isAdmin && patrol.guard_id !== req.user.id) {
            return res.status(403).json({ error: 'غير مصرح لك بتعديل هذه الجولة' });
        }

        await prepare(`
            UPDATE patrol_rounds 
            SET location = $1, security_status = $2, notes = $3, updated_at = CURRENT_TIMESTAMP
            WHERE id = $4
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
        const isAdmin = req.user.role === 'admin' || req.user.role === 'supervisor';

        const patrol = await prepare('SELECT * FROM patrol_rounds WHERE id = $1').get(id);

        if (!patrol) {
            return res.status(404).json({ error: 'الجولة غير موجودة' });
        }

        if (!isAdmin && patrol.guard_id !== req.user.id) {
            return res.status(403).json({ error: 'غير مصرح لك بتعديل حالة هذه الجولة' });
        }

        await prepare(`
            UPDATE patrol_rounds 
            SET resolution_status = $1, updated_at = CURRENT_TIMESTAMP
            WHERE id = $2
        `).run(resolution_status, id);

        res.json({ message: 'تم تحديث حالة الجولة' });

    } catch (error) {
        console.error('Change status error:', error);
        res.status(500).json({ error: 'خطأ في تحديث الحالة' });
    }
});

// DELETE /api/patrols/:id - Delete patrol
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        await getDatabase();
        const { id } = req.params;
        const isAdmin = req.user.role === 'admin' || req.user.role === 'supervisor';

        if (!isAdmin) {
            return res.status(403).json({ error: 'غير مصرح لك بحذف الجولات' });
        }

        const patrol = await prepare('SELECT * FROM patrol_rounds WHERE id = $1').get(id);

        if (!patrol) {
            return res.status(404).json({ error: 'الجولة غير موجودة' });
        }

        await prepare('DELETE FROM patrol_rounds WHERE id = $1').run(id);
        await prepare('DELETE FROM activity_log WHERE patrol_id = $1').run(id);

        res.json({ message: 'تم حذف الجولة بنجاح' });

    } catch (error) {
        console.error('Delete patrol error:', error);
        res.status(500).json({ error: 'خطأ في حذف الجولة' });
    }
});

module.exports = router;