// API Configuration - Production Mode
const API_BASE_URL = 'https://faj-backend.onrender.com';
const MOCK_MODE = false;

// Override fetch to use Railway backend
if (!MOCK_MODE) {
    window.originalFetch = window.fetch;
    window.fetch = async (url, options = {}) => {
        // If URL starts with /api, redirect to Railway backend
        if (url.startsWith('/api')) {
            url = API_BASE_URL + url;
        }
        return window.originalFetch(url, options);
    };
    console.log('🚀 Production Mode - Connected to:', API_BASE_URL);
}
