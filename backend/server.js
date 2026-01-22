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
    origin: ['https://f-a-j.vercel.app', 'http://localhost:3000', 'http://localhost:5500'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Database migration - add resolution_status column if not exists
const { getDatabase, prepare } = require('./database/db');
(async () => {
    try {
        await getDatabase();
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
app.use('/api/auth', authRoutes);
app.use('/api/visitors', visitorsRoutes);
app.use('/api/patrols', patrolsRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/users', usersRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        message: 'نظام الأمن الصناعي يعمل بشكل طبيعي',
        timestamp: new Date().toISOString()
    });
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
app.listen(PORT, () => {
    console.log(`
╔══════════════════════════════════════════════════════╗
║     نظام إدارة الحراسات الأمنية                      ║
║     Security Management System                       ║
╠══════════════════════════════════════════════════════╣
║  Server running on: http://localhost:${PORT}            ║
║  Status: Online ✓                                    ║
╚══════════════════════════════════════════════════════╝
    `);
});

module.exports = app;
