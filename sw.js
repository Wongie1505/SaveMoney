const V = 'gid-v2';
const FILES = [
    './', 'index.html', 'manifest.json', 'icon-192.png', 'icon-512.png',
    'css/style.css', 'js/app.js', 'js/jspdf.umd.min.js'
];

self.addEventListener('install', e => {
    e.waitUntil(caches.open(V).then(c => c.addAll(FILES)));
    self.skipWaiting();
});

self.addEventListener('activate', e => {
    e.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== V).map(k => caches.delete(k)))
        )
    );
});

self.addEventListener('fetch', e => {
    e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
});
