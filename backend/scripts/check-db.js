const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '../database/security.db');

async function checkCounts() {
    try {
        const SQL = await initSqlJs();
        const fileBuffer = fs.readFileSync(dbPath);
        const db = new SQL.Database(fileBuffer);

        const counts = {
            visitors: db.exec('SELECT count(*) FROM visitors')[0].values[0][0],
            patrols: db.exec('SELECT count(*) FROM patrol_rounds')[0].values[0][0],
            activity: db.exec('SELECT count(*) FROM activity_log')[0].values[0][0],
            users: db.exec('SELECT count(*) FROM users')[0].values[0][0]
        };

        console.log('Database Counts:', JSON.stringify(counts, null, 2));

    } catch (err) {
        console.error('Error:', err);
    }
}

checkCounts();
