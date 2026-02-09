const jwt = require('jsonwebtoken');

// JWT Secret (in production, use environment variable)
const JWT_SECRET = 'faj_security_system_2024_secret_key';

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'الوصول غير مصرح - يرجى تسجيل الدخول' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'جلسة منتهية - يرجى إعادة تسجيل الدخول' });
        }
        req.user = user;
        next();
    });
};

// Middleware to check if user is admin
const requireAdmin = (req, res, next) => {
    if (req.user && req.user.role === 'admin') {
        next();
    } else {
        return res.status(403).json({ error: 'صلاحيات غير كافية - يتطلب صلاحية مدير' });
    }
};

// Middleware to check if user is admin or supervisor
const requireSupervisor = (req, res, next) => {
    if (req.user && (req.user.role === 'admin' || req.user.role === 'supervisor')) {
        next();
    } else {
        return res.status(403).json({ error: 'صلاحيات غير كافية' });
    }
};

// Middleware to check if user is super admin (GM)
const requireSuperAdmin = (req, res, next) => {
    if (req.user && req.user.role === 'super_admin') {
        next();
    } else {
        return res.status(403).json({ error: 'غير مصرح - يتطلب صلاحية المدير العام' });
    }
};

module.exports = {
    authenticateToken,
    requireAdmin,
    requireSupervisor,
    requireSuperAdmin,
    JWT_SECRET
};
