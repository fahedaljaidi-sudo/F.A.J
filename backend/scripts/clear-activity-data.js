const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '../database/security.db');

async function clearActivityData() {
    console.log('🧹 Starting cleanup of activity data (keeping Users and Locations)...');

    if (!fs.existsSync(dbPath)) {
        console.error('❌ Database file not found at:', dbPath);
        process.exit(1);
    }

    try {
        const SQL = await initSqlJs();
        const fileBuffer = fs.readFileSync(dbPath);
        const db = new SQL.Database(fileBuffer);

        console.log('📋 Clearing tables...');

        // Clear Visitors
        db.run('DELETE FROM visitors');
        db.run("DELETE FROM sqlite_sequence WHERE name='visitors'");
        console.log('  ✓ Visitors table cleared');

        // Clear Patrol Rounds
        db.run('DELETE FROM patrol_rounds');
        db.run("DELETE FROM sqlite_sequence WHERE name='patrol_rounds'");
        console.log('  ✓ Patrol Rounds table cleared');

        // Clear Activity Log
        db.run('DELETE FROM activity_log');
        db.run("DELETE FROM sqlite_sequence WHERE name='activity_log'");
        console.log('  ✓ Activity Log table cleared');

        // Save changes
        const data = db.export();
        const buffer = Buffer.from(data);
        fs.writeFileSync(dbPath, buffer);
        db.close();

        console.log('\n✅ Data cleanup complete!');
        console.log('🔒 Users and Locations were preserved.');

    } catch (err) {
        console.error('❌ Error during cleanup:', err);
        process.exit(1);
    }
}

clearActivityData();
