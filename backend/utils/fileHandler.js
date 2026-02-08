const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// Use an absolute path that is easy to map to a volume
const uploadDir = path.resolve(process.cwd(), 'public/uploads/patrols');

// Ensure directory exists at startup
if (!fs.existsSync(uploadDir)) {
    console.log('📁 Creating upload directory:', uploadDir);
    fs.mkdirSync(uploadDir, { recursive: true });
}

/**
 * Saves a Base64 image string to disk
 * @param {string} base64String - The base64 string
 * @returns {string|null} - The relative path for the browser
 */
function saveBase64Image(base64String) {
    if (!base64String || typeof base64String !== 'string') return null;

    try {
        const matches = base64String.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        
        let imageBuffer;
        let extension = 'png'; 

        if (matches && matches.length === 3) {
            const mimeType = matches[1];
            if (mimeType === 'image/jpeg') extension = 'jpg';
            else if (mimeType === 'image/png') extension = 'png';
            else if (mimeType === 'image/webp') extension = 'webp';
            
            imageBuffer = Buffer.from(matches[2], 'base64');
        } else {
            imageBuffer = Buffer.from(base64String, 'base64');
        }

        const filename = `${uuidv4()}.${extension}`;
        const filePath = path.join(uploadDir, filename);

        fs.writeFileSync(filePath, imageBuffer);
        console.log('✅ Image saved to:', filePath);
        
        // Return the URL path
        return `/uploads/patrols/${filename}`;
    } catch (error) {
        console.error('❌ Error saving image:', error);
        return null;
    }
}

module.exports = { saveBase64Image };