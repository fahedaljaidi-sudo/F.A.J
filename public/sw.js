const CACHE_NAME = 'faj-security-v3';
const ASSETS_TO_CACHE = [
    '/',
    '/index.html',
    '/dashboard.html',
    '/patrols.html',
    '/visitors.html',
    '/reports.html',
    '/users.html',
    '/responsive.css',
    '/logo.png',
    '/loader.js',
    '/mobile-nav.js',
    '/js/layout.js',
    '/components/sidebar.html',
    '/mock-api.js'
];

self.addEventListener('install', (event) => {
    self.skipWaiting(); // Force update
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('🧹 Clearing old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});

self.addEventListener('fetch', (event) => {
    // Skip API calls
    if (event.request.url.includes('/api/')) {
        return;
    }

    // Network-First strategy for HTML and JS to ensure updates
    if (event.request.mode === 'navigate' || 
        event.request.url.endsWith('.html') || 
        event.request.url.endsWith('.js')) {
        event.respondWith(
            fetch(event.request)
                .then((response) => {
                    const clonedResponse = response.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, clonedResponse);
                    });
                    return response;
                })
                .catch(() => caches.match(event.request))
        );
        return;
    }

    // Cache-First for images and other assets
    event.respondWith(
        caches.match(event.request).then((response) => {
            return response || fetch(event.request);
        })
    );
});