// Mock data for Vercel demo - no backend required
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

// Mock data
const mockPatrols = [
    { id: 1, location: 'البوابة الرئيسية', security_status: 'normal', guard_name: 'مدير النظام', patrol_time: new Date().toISOString(), notes: '' },
    { id: 2, location: 'حرم المصنع الغربي', security_status: 'observation', guard_name: 'مدير النظام', patrol_time: new Date(Date.now() - 3600000).toISOString(), notes: 'ملاحظة بسيطة' },
    { id: 3, location: 'مواقف السيارات', security_status: 'normal', guard_name: 'مدير النظام', patrol_time: new Date(Date.now() - 7200000).toISOString(), notes: '' }
];

const mockVisitors = [
    { id: 1, full_name: 'أحمد محمد', company: 'شركة الفجر', id_number: '1234567890', purpose: 'اجتماع', entry_time: new Date().toISOString(), status: 'inside' },
    { id: 2, full_name: 'سعود العتيبي', company: 'مؤسسة النور', id_number: '0987654321', purpose: 'صيانة', entry_time: new Date(Date.now() - 3600000).toISOString(), status: 'inside' }
];

const mockActivity = [
    { id: 1, event_type: 'patrol', description: 'جولة أمنية: البوابة الرئيسية - طبيعي', user_name: 'مدير النظام', event_time: new Date().toISOString() },
    { id: 2, event_type: 'visitor_entry', description: 'دخول زائر: أحمد محمد', user_name: 'مدير النظام', event_time: new Date(Date.now() - 1800000).toISOString() },
    { id: 3, event_type: 'system', description: 'تسجيل دخول: مدير النظام', user_name: 'مدير النظام', event_time: new Date(Date.now() - 3600000).toISOString() }
];

// Mock API responses
const mockAPI = {
    '/api/auth/login': (body) => mockLogin(body.username, body.password),
    '/api/patrols/recent': () => ({ patrols: mockPatrols }),
    '/api/patrols/shift-status': () => ({ completed: 3, expected: 6, normal: 2, observation: 1, danger: 0 }),
    '/api/patrols/locations': () => ({
        locations: [
            { id: 1, name_ar: 'البوابة الرئيسية' },
            { id: 2, name_ar: 'حرم المصنع الغربي' },
            { id: 3, name_ar: 'مواقف السيارات' },
            { id: 4, name_ar: 'المستودعات' }
        ]
    }),
    '/api/visitors': () => ({ visitors: mockVisitors }),
    '/api/visitors/stats': () => ({ inside: 2, today_entries: 5, today_exits: 3 }),
    '/api/reports/recent': () => ({ logs: mockActivity }),
    '/api/reports/summary': () => ({ visitors: { total: 25 }, patrols: { total: 50, normal: 40, observation: 8, danger: 2 } }),
    '/api/reports': () => ({ logs: mockActivity, pagination: { total: 3, page: 1, limit: 20, totalPages: 1 } }),
    '/api/users': () => ({ users: [mockUser] }),
    '/api/dashboard/stats': () => ({ visitors_inside: 2, patrols_today: 3, observations: 1, dangers: 0 })
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

console.log('🎭 Mock Mode Enabled - Demo Version');
