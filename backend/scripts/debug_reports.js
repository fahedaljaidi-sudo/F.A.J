const { getDatabase, prepare } = require('../database/db');

async function test() {
    try {
        console.log('Initializing database...');
        await getDatabase();
        console.log('Database loaded.');

        const limit = 50;
        const offset = 0;
        const from_date = '2024-01-01';
        const to_date = '2026-12-31';

        console.log(`Testing query with dates: ${from_date} to ${to_date}`);

        const sql = `
            SELECT a.*, u.full_name as user_name, v.full_name as visitor_name, v.company as visitor_company,
                   p.notes as patrol_notes
            FROM activity_log a
            LEFT JOIN users u ON a.user_id = u.id
            LEFT JOIN visitors v ON a.visitor_id = v.id
            LEFT JOIN patrol_rounds p ON a.patrol_id = p.id
            WHERE DATE(a.event_time) BETWEEN ? AND ?
            ORDER BY a.event_time DESC
            LIMIT ? OFFSET ?
        `;

        const logs = prepare(sql).all(from_date, to_date, limit, offset);
        console.log(`Query successful. Retrieved ${logs.length} logs.`);
        console.log('Sample log:', logs[0]);

    } catch (error) {
        console.error('QUERY FAILED:', error);
    }
}

test();
