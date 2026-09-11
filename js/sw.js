/**
 * sw.js
 * Service Worker untuk caching semua file aplikasi, supaya setelah
 * pertama kali dibuka (butuh internet), selanjutnya bisa dipakai
 * 100% offline.
 *
 * PENTING: Kalau nanti ada update kode (tambah fitur baru dll),
 * naikkan CACHE_VERSION di bawah ini, supaya browser tahu harus
 * download ulang file-file yang berubah.
 */

const CACHE_VERSION = 'v8';
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
    './js/register-sw.js',
    './js/vendor/sql-wasm.js',
    './js/vendor/sql-wasm.wasm',
    './icons/icon-192.png',
    './icons/icon-512.png'
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
    const isNavigation = event.request.mode === 'navigate';
    event.respondWith(
        caches.match(event.request, { ignoreSearch: isNavigation }).then((cachedResponse) => {
            if (cachedResponse) {
                return cachedResponse;
            }
            return fetch(event.request).then((networkResponse) => {
                return caches.open(CACHE_NAME).then((cache) => {
                    cache.put(event.request, networkResponse.clone());
                    return networkResponse;
                });
            }).catch(() => {
                if (isNavigation) {
                    return caches.match('./index.html');
                }
                throw new Error('Offline dan resource belum ter-cache: ' + event.request.url);
            });
        })
    );
});
