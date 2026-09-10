/**
 * sw.js
 * Service Worker untuk caching semua file aplikasi, supaya setelah
 *
 * PENTING: Kalau nanti ada update kode (tambah fitur baru dll),
 * naikkan CACHE_VERSION di bawah ini, supaya browser tahu harus
 * download ulang file-file yang berubah.
 */
 
const CACHE_VERSION = 'v5';
const CACHE_NAME = 'barokah-rasa-' + CACHE_VERSION;
 
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './buat.html',
    './edit.html',
    './detail.html',
    './barang.html',
    './backup.html',
    './manifest.json',
    './css/style.css',
    './js/db-core.js',
    './js/storage.js',
    './js/app.js',
    './js/receipt.js',
    './icons/icon-192.png',
    './icons/icon-512.png',
    'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/sql-wasm.js',
    'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/sql-wasm.wasm'
];
 
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            // addAll akan gagal semua kalau 1 saja gagal, jadi pakai
            // Promise.allSettled supaya file CDN yang mungkin gagal
            // (misal beda versi) tidak menggagalkan seluruh instalasi.
            return Promise.allSettled(
                ASSETS_TO_CACHE.map(url =>
                    cache.add(url).catch(err => {
                        console.warn('Gagal cache:', url, err);
                    })
                )
            );
        }).then(() => self.skipWaiting())
    );
});
 
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys
                    .filter((key) => key !== CACHE_NAME)
                    .map((key) => caches.delete(key))
            );
        }).then(() => self.clients.claim())
    );
});
 
self.addEventListener('fetch', (event) => {
    // Strategi: cache-first, fallback ke network kalau belum ada di cache.
    // Kalau network juga gagal (offline & belum ke-cache), biarkan error normal.
    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) {
                return cachedResponse;
            }
            return fetch(event.request).then((networkResponse) => {
                // Simpan juga ke cache untuk pemakaian offline berikutnya
                return caches.open(CACHE_NAME).then((cache) => {
                    cache.put(event.request, networkResponse.clone());
                    return networkResponse;
                });
            });
        })
    );
});