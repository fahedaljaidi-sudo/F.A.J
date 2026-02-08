const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const uploadDir = path.join(__dirname, '../public/uploads/patrols');

// Ensure directory exists
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

/**
 * Saves a Base64 image string to disk
 * @param {string} base64String - The base64 string (data:image/png;base64,...)
 * @returns {string|null} - The relative path to the saved image or null if failed
 */
function saveBase64Image(base64String) {
    if (!base64String || typeof base64String !== 'string') return null;

    try {
        // Strip metadata if present
        const matches = base64String.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        
        let imageBuffer;
        let extension = 'png'; // Default

        if (matches && matches.length === 3) {
            // Found metadata
            const mimeType = matches[1];
            if (mimeType === 'image/jpeg') extension = 'jpg';
            if (mimeType === 'image/png') extension = 'png';
            if (mimeType === 'image/webp') extension = 'webp';
            
            imageBuffer = Buffer.from(matches[2], 'base64');
        } else {
            // Assume raw base64
            imageBuffer = Buffer.from(base64String, 'base64');
        }

        const filename = `${uuidv4()}.${extension}`;
        const filePath = path.join(uploadDir, filename);

        fs.writeFileSync(filePath, imageBuffer);
        
        return `/uploads/patrols/${filename}`;
    } catch (error) {
        console.error('❌ Error saving image:', error);
        return null;
    }
}

module.exports = { saveBase64Image };
