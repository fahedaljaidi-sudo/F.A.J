const CACHE_NAME = 'faj-security-v1';
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
    'https://fonts.googleapis.com/css2?family=Public+Sans:wght@400;500;600;700;800&display=swap',
    'https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap',
    'https://cdn.tailwindcss.com?plugins=forms,container-queries'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
});

self.addEventListener('fetch', (event) => {
    // API requests should typically not be cached or should have specific strategies
    if (event.request.url.includes('/api/')) {
        return;
    }

    event.respondWith(
        caches.match(event.request).then((response) => {
            return response || fetch(event.request);
        })
    );
});
