// API Configuration - Production Mode
// All /api requests are automatically proxied to Railway backend via vercel.json
const API_BASE_URL = '/api'; // Vercel will proxy to Railway
const PRODUCTION_MODE = true;

// Log production mode
if (PRODUCTION_MODE) {
    console.log('🚀 Production Mode Activated');
    console.log('📡 API requests will be proxied to Railway backend');
    console.log('💾 Data is stored permanently in SQLite database');
}

// Note: No need to override fetch - vercel.json handles the proxying
// See vercel.json for API routing configuration
