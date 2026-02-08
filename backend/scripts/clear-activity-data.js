const { getDatabase, pool } = require('../database/db');

async function clearActivityData() {
    console.log('🧹 Starting cleanup of activity data in PostgreSQL (keeping Users and Locations)...');

    try {
        await getDatabase();
        const client = await pool.connect();
        try {
            console.log('📋 Clearing tables...');

            // Clear Visitors, Patrol Rounds, Activity Log and reset sequences
            await client.query('TRUNCATE TABLE visitors, patrol_rounds, activity_log RESTART IDENTITY CASCADE');
            
            console.log('  ✓ Visitors table cleared');
            console.log('  ✓ Patrol Rounds table cleared');
            console.log('  ✓ Activity Log table cleared');

        } finally {
            client.release();
        }

        console.log('\n✅ Data cleanup complete!');
        console.log('🔒 Users and Locations were preserved.');
        process.exit(0);
    } catch (err) {
        console.error('❌ Error during cleanup:', err);
        process.exit(1);
    }
}

clearActivityData();