const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const cloudinary = require('cloudinary').v2;

// Configure Cloudinary if environment variables are present
if (process.env.CLOUDINARY_URL || (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY)) {
    cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET
    });
    console.log('☁️ Cloudinary configured for permanent image storage');
}

const uploadDir = path.resolve(process.cwd(), 'public/uploads/patrols');

if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

/**
 * Saves a Base64 image string (either to Cloudinary or local disk)
 * @param {string} base64String 
 * @returns {Promise<string|null>} - The URL or relative path
 */
async function saveBase64Image(base64String) {
    if (!base64String || typeof base64String !== 'string') return null;

    try {
        // Option A: Cloudinary (Permanent)
        if (cloudinary.config().cloud_name) {
            console.log('🛰️ Uploading to Cloudinary...');
            const uploadResponse = await cloudinary.uploader.upload(base64String, {
                folder: 'faj_patrols',
                resource_type: 'image'
            });
            return uploadResponse.secure_url;
        }

        // Option B: Local Disk (Temporary on Railway)
        console.log('💾 Cloudinary not configured. Saving to local disk...');
        const matches = base64String.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        let imageBuffer;
        let extension = 'png';

        if (matches && matches.length === 3) {
            const mimeType = matches[1];
            if (mimeType === 'image/jpeg') extension = 'jpg';
            else if (mimeType === 'image/png') extension = 'png';
            imageBuffer = Buffer.from(matches[2], 'base64');
        } else {
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
