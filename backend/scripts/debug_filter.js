const { getDatabase, prepare } = require('../database/db');

async function testFilter() {
    try {
        console.log('Initializing database...');
        await getDatabase();

        // Simulate the request parameters
        const from_date = '2024-01-01';
        const to_date = '2026-12-31';
        const limit = 50;
        const offset = 0;
        const user_id = 1; // Assuming admin with ID 1

        console.log(`Testing Filter Query: ${from_date} to ${to_date}`);

        // This matches the ADMIN query path in reports.js
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
        console.log(`✅ Success! Found ${logs.length} logs.`);

        if (logs.length > 0) {
            console.log('Sample Log Date:', logs[0].event_time);
        } else {
            console.log('⚠️ No logs found in this range.');
        }

        // Also check if any date parsing is failing
        console.log('Checking for potentially invalid dates...');
        const rawDates = prepare('SELECT id, event_time, DATE(event_time) as parsed FROM activity_log LIMIT 5').all();
        console.table(rawDates);

    } catch (error) {
        console.error('❌ FILTER QUERY FAILED:', error);
    }
}

testFilter();
