// Check Service Worker version
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js')
            .then((reg) => {
                console.log('Service Worker terdaftar:', reg.scope);
                // Paksa cek update setiap kali halaman dibuka, jangan
                reg.update();
            })
            .catch((err) => {
                console.log('Service Worker tidak aktif di konteks ini:', err.message);
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