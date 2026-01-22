// Mock API for Vercel demo - Fresh Start
const MOCK_MODE = true;

const mockUser = {
    id: 1,
    username: 'admin',
    full_name: 'مدير النظام',
    role: 'admin',
    email: 'admin@faj.com'
};

const mockToken = 'mock-token-for-demo';

// Mock login function
function mockLogin(username, password) {
    if (username === 'admin' && password === 'admin123') {
        return { success: true, user: mockUser, token: mockToken };
    }
    return { success: false, error: 'اسم المستخدم أو كلمة المرور غير صحيحة' };
}

// Empty data - Fresh start
const mockPatrols = [];
const mockVisitors = [];
const mockActivity = [];

// Mock API responses
const mockAPI = {
    '/api/auth/login': (body) => mockLogin(body.username, body.password),
    '/api/patrols/recent': () => ({ patrols: mockPatrols }),
    '/api/patrols/shift-status': () => ({ completed: 0, expected: 6, normal: 0, observation: 0, danger: 0 }),
    '/api/patrols/locations': () => ({
        locations: [
            { id: 1, name_ar: 'البوابة الرئيسية' },
            { id: 2, name_ar: 'حرم المصنع الغربي' },
            { id: 3, name_ar: 'مواقف السيارات' },
            { id: 4, name_ar: 'المستودعات' }
        ]
    }),
    '/api/visitors': () => ({ visitors: mockVisitors }),
    '/api/visitors/stats': () => ({ inside: 0, today_entries: 0, today_exits: 0 }),
    '/api/reports/recent': () => ({ logs: mockActivity }),
    '/api/reports/summary': () => ({ visitors: { total: 0 }, patrols: { total: 0, normal: 0, observation: 0, danger: 0 } }),
    '/api/reports': () => ({ logs: mockActivity, pagination: { total: 0, page: 1, limit: 20, totalPages: 0 } }),
    '/api/users': () => ({ users: [mockUser] }),
    '/api/dashboard/stats': () => ({ visitors_inside: 0, patrols_today: 0, observations: 0, dangers: 0 })
};

// Override fetch for mock mode
if (MOCK_MODE) {
    window.originalFetch = window.fetch;
    window.fetch = async (url, options = {}) => {
        const path = url.split('?')[0];

        if (mockAPI[path]) {
            let body = {};
            if (options.body) {
                try { body = JSON.parse(options.body); } catch (e) { }
            }

            const result = mockAPI[path](body);

            return {
                ok: result.success !== false,
                json: async () => result
            };
        }

        // Fallback for unknown endpoints
        return { ok: true, json: async () => ({}) };
    };
}

console.log('🎭 Mock Mode - Fresh Start');
