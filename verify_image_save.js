const { getDatabase, prepare } = require('./backend/database/db');
const fs = require('fs');

(async () => {
    try {
        console.log('🧪 Starting Image Save Verification...');

        await getDatabase();

        // Simulate the breakdown of what happens in the route
        const mockBody = {
            location: 'Test Location',
            security_status: 'normal',
            notes: 'Test Image Save',
            image: 'data:image/png;base64,TEST_IMAGE_DATA_STRING'
        };

        const { location, security_status, notes, attachments, image } = mockBody;

        // This is the EXACT logic I added to patrols.js
        const attachmentsJson = image || (attachments ? JSON.stringify(attachments) : '');

        console.log('📝 Data to be saved:', attachmentsJson);

        // Save to DB
        const result = prepare(`
            INSERT INTO patrol_rounds (guard_id, location, security_status, notes, attachments)
            VALUES (?, ?, ?, ?, ?)
        `).run(1, location, security_status, notes, attachmentsJson);

        console.log('✅ Inserted with ID:', result.lastInsertRowid);

        // Read it back
        const savedPatrol = prepare('SELECT * FROM patrol_rounds WHERE id = ?').get(result.lastInsertRowid);

        console.log('🔍 Retrieved from DB:', savedPatrol.attachments);

        if (savedPatrol.attachments === mockBody.image) {
            console.log('🎉 SUCCESS: Image verified! It matches the input.');
        } else {
            console.error('❌ FAILURE: Image data mismatch.');
        }

    } catch (error) {
        console.error('❌ Error:', error);
    }
})();
