const { getDatabase, prepare } = require('./backend/database/db');

async function testQuery() {
    try {
        const db = await getDatabase();
        console.log('Database connected.');

        // 1. Check if activity_log table exists and has data
        const count = prepare('SELECT COUNT(*) as total FROM activity_log').get();
        console.log('Total activity logs:', count);

        // 2. Test the query used in reports.js
        console.log('Testing main report query...');
        const limit = 20;
        const offset = 0;

        // Simulating the query without dates (simplest case)
        const logs = prepare(`
            SELECT a.*, u.full_name as user_name, v.full_name as visitor_name, v.company as visitor_company,
                   p.notes as patrol_notes
            FROM activity_log a
            LEFT JOIN users u ON a.user_id = u.id
            LEFT JOIN visitors v ON a.visitor_id = v.id
            LEFT JOIN patrol_rounds p ON a.patrol_id = p.id
            ORDER BY a.event_time DESC
            LIMIT ? OFFSET ?
        `).all(limit, offset);

        console.log('Query successful. Retrieved rows:', logs.length);
        if (logs.length > 0) {
            console.log('Sample row:', logs[0]);
        }

    } catch (error) {
        console.error('Query failed:', error);
    }
}

testQuery();
