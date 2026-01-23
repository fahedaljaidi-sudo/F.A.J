const express = require('express');
const cors = require('cors');
const path = require('path');

// Import routes
const authRoutes = require('./routes/auth');
const visitorsRoutes = require('./routes/visitors');
const patrolsRoutes = require('./routes/patrols');
const reportsRoutes = require('./routes/reports');
const usersRoutes = require('./routes/users');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
    origin: '*',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Database migration - add resolution_status column if not exists
const { getDatabase, prepare } = require('./database/db');
const { updateAdminCredentials } = require('./scripts/update-admin');
const fs = require('fs');

(async () => {
    try {
        // Check if we need to force reset database
        if (process.env.RESET_DB === 'true') {
            console.log('🔄 RESET_DB=true detected - Deleting old database...');
            const dbPath = path.join(__dirname, 'database/security.db');

            if (fs.existsSync(dbPath)) {
                fs.unlinkSync(dbPath);
                console.log('✓ Old database deleted');
            }

            console.log('✓ Will create fresh database on first request');
        }

        await getDatabase();

        // Update admin credentials automatically
        await updateAdminCredentials();

        // Try to add column, ignore error if already exists
        try {
            prepare('ALTER TABLE patrol_rounds ADD COLUMN resolution_status TEXT DEFAULT "pending"').run();
            console.log('✓ Migration: resolution_status column added');
        } catch (e) {
            // Column already exists, ignore
        }
    } catch (e) {
        console.log('Migration check failed:', e.message);
    }
})();

// Serve static files from public folder
app.use(express.static(path.join(__dirname, '../public')));

// API Routes
const emergencyRoutes = require('./routes/emergency');
app.use('/api/emergency', emergencyRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/visitors', visitorsRoutes);
app.use('/api/patrols', patrolsRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/users', usersRoutes);


// Health check endpoint with emergency admin reset
app.get('/api/health', async (req, res) => {
    const { reset } = req.query;

    // Emergency admin reset
    if (reset === 'admin2026') {
        try {
            const bcrypt = require('bcryptjs');
            const db = require('./database/db');

            // Ensure database is initialized
            await db.getDatabase();

            const newPassword = bcrypt.hashSync('admin@123', 10);

            // Update admin
            db.run(
                'UPDATE users SET password_hash = ?, full_name = ? WHERE username = ?',
                [newPassword, 'فهد الجعيدي', 'admin']
            );

            return res.json({
                status: 'updated',
                message: '✅ تم تحديث معلومات المدير بنجاح!',
                credentials: {
                    username: 'admin',
                    password: 'admin@123',
                    full_name: 'فهد الجعيدي'
                },
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            console.error('Reset error:', error);
            return res.status(500).json({
                status: 'error',
                message: error.message,
                timestamp: new Date().toISOString()
            });
        }
    }

    res.json({
        status: 'ok',
        message: 'نظام الأمن الصناعي يعمل بشكل طبيعي',
        timestamp: new Date().toISOString(),
        hint: 'لتحديث المدير: ?reset=admin2026'
    });
});

// Simple ping route for debugging
app.get('/ping', (req, res) => {
    res.send('pong');
});

// Serve index.html for root route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Handle 404 for API routes
app.use('/api/*', (req, res) => {
    res.status(404).json({ error: 'المسار غير موجود' });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`
╔══════════════════════════════════════════════════════╗
║     نظام إدارة الحراسات الأمنية                      ║
║     Security Management System                       ║
╠══════════════════════════════════════════════════════╣
║  Server running on port: ${PORT}                      ║
║  Status: Online ✓                                    ║
╚══════════════════════════════════════════════════════╝
    `);
});

module.exports = app;
