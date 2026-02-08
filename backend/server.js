const express = require('express');
const cors = require('cors');
const path = require('path');
const rateLimit = require('express-rate-limit');

// Import routes
const authRoutes = require('./routes/auth');
const visitorsRoutes = require('./routes/visitors');
const patrolsRoutes = require('./routes/patrols');
const reportsRoutes = require('./routes/reports');
const usersRoutes = require('./routes/users');

const app = express();
const PORT = process.env.PORT || 3000;

// Rate Limiter for Login
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, 
    max: 10, 
    message: { error: 'تم تجاوز عدد محاولات تسجيل الدخول المسموحة، يرجى المحاولة لاحقاً' }
});

// Middleware
app.use(cors({ origin: '*', credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Database Initialization
const { getDatabase, prepare } = require('./database/db');
const { updateAdminCredentials } = require('./scripts/update-admin');

(async () => {
    try {
        await getDatabase();
        await updateAdminCredentials();
        console.log('✅ System ready with PostgreSQL');
    } catch (e) {
        console.error('❌ System startup failed:', e.message);
    }
})();

// Static Files
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

// API Routes
const fixRoutes = require('./routes/fix');
const emergencyRoutes = require('./routes/emergency');
app.use('/api/fix', fixRoutes);
app.use('/api/emergency', emergencyRoutes);
app.post('/api/auth/login', loginLimiter); // Use .post specifically
app.use('/api/auth', authRoutes);
app.use('/api/visitors', visitorsRoutes);
app.use('/api/patrols', patrolsRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/users', usersRoutes);

// Health check with emergency reset
app.get('/api/health', async (req, res) => {
    const { reset } = req.query;
    if (reset === 'admin2026') {
        try {
            const bcrypt = require('bcryptjs');
            await getDatabase();
            const newPassword = bcrypt.hashSync('admin@123', 10);
            await prepare('UPDATE users SET password_hash = $1, full_name = $2 WHERE username = $3')
                .run(newPassword, 'فهد الجعيدي', 'admin');
            return res.json({ status: 'updated', credentials: { username: 'admin', password: 'admin@123' } });
        } catch (error) {
            return res.status(500).json({ error: error.message });
        }
    }
    res.json({ status: 'ok', engine: 'PostgreSQL', timestamp: new Date().toISOString() });
});

app.get('/ping', (req, res) => res.send('pong'));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public/index.html')));
app.use('/api/*', (req, res) => res.status(404).json({ error: 'المسار غير موجود' }));

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on port: ${PORT} (PostgreSQL Mode)`);
});

process.on('uncaughtException', (err) => console.error('🔥 Uncaught Exception:', err));
process.on('unhandledRejection', (reason) => console.error('🔥 Unhandled Rejection:', reason));

module.exports = app;