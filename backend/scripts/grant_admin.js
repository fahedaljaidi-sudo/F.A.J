const { getDatabase, prepare } = require('../database/db');
const bcrypt = require('bcryptjs');

(async () => {
    try {
        await getDatabase();
        const username = 'manager.hr';

        // 1. Check if user exists
        const user = prepare('SELECT * FROM users WHERE username = ?').get(username);

        if (!user) {
            console.log(`⚠️ المستخدم '${username}' غير موجود. سيتم إنشاءه الآن...`);

            const passwordHash = bcrypt.hashSync('123456', 10);

            prepare(`
                INSERT INTO users (username, password_hash, full_name, role, is_active, created_at)
                VALUES (?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
            `).run(username, passwordHash, 'مدير الموارد البشرية (نائب)', 'admin');

            console.log(`✅ تم إنشاء المستخدم بنجاح!`);
            console.log(`👤 اسم المستخدم: ${username}`);
            console.log(`🔑 كلمة المرور: 123456`);
            console.log(`🛡️ الصلاحية: admin (نائب مدير النظام)`);
        } else {
            console.log(`👤 المستخدم موجود: ${user.full_name}`);
            prepare('UPDATE users SET role = ? WHERE username = ?').run('admin', username);
            console.log(`✅ تم تحديث الصلاحية إلى admin بنجاح.`);
        }

    } catch (e) {
        console.error('❌ حدث خطأ:', e);
    }
})();
