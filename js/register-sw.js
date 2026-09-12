/**
 * register-sw.js
 * Mendaftarkan Service Worker (sw.js) supaya aplikasi bisa dipakai
 * offline setelah pertama kali dibuka.
 *
 * File ini otomatis "diam saja" (tidak error) kalau dibuka via
 * file:// atau http biasa (bukan https/localhost), karena
 * Service Worker memang cuma didukung di secure context.
 */

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js')
            .then((reg) => {
                console.log('Service Worker terdaftar:', reg.scope);

                // Cek update butuh internet - kalau offline, ini WAJAR gagal
                // dan tidak perlu ditampilkan sebagai error ke pengguna.
                reg.update().catch((err) => {
                    console.log('Cek update dilewati (kemungkinan sedang offline):', err.message);
                });
            })
            .catch((err) => {
                console.error('Gagal mendaftarkan Service Worker:', err);
                // Tampilkan langsung ke layar - sebelumnya cuma console.log
                // yang tidak bisa dilihat tanpa DevTools di HP.
                if (typeof showGlobalError === 'function') {
                    showGlobalError('❌ Gagal mendaftarkan Service Worker: ' + err.name + ' - ' + err.message);
                } else {
                    alert('❌ Gagal mendaftarkan Service Worker: ' + err.name + ' - ' + err.message);
                }
            });

        let alreadyReloaded = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (alreadyReloaded) return;
            alreadyReloaded = true;
            window.location.reload();
        });
    });
}

/**
 * Tombol darurat: bersihkan HANYA cache aplikasi ini (Cache Storage +
 * Service Worker lama), TIDAK menyentuh IndexedDB (data pesanan tetap
 * aman). Dipakai kalau update versi baru tidak kunjung kepakai secara
 * otomatis.
 */
async function forceUpdateApp() {
    try {
        if ('serviceWorker' in navigator) {
            const regs = await navigator.serviceWorker.getRegistrations();
            await Promise.all(regs.map(reg => reg.unregister()));
        }
        if ('caches' in window) {
            const names = await caches.keys();
            await Promise.all(names.map(name => caches.delete(name)));
        }
        alert('✅ Cache aplikasi dibersihkan. Data pesanan Anda TIDAK terhapus. Aplikasi akan dimuat ulang.');
        window.location.reload(true);
    } catch (err) {
        alert('❌ Gagal membersihkan cache: ' + err.message);
    }
}