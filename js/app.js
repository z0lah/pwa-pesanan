/**
 * app.js
 * Menghubungkan db-core.js (logic SQL) dengan storage.js (persistence browser).
 * File ini yang dipanggil oleh halaman-halaman HTML nantinya.
 */

let db = null;
let dbApi = null;
let SQLModule = null;

/**
 * Kalau ada error tak tertangani (misal gagal load sql.js), tampilkan
 * pesan jelas di atas halaman - supaya tidak terlihat seperti "form
 * error tanpa sebab" (input yang seolah disabled/tidak merespon).
 */
function showGlobalError(message) {
    let banner = document.getElementById('globalErrorBanner');
    if (!banner) {
        banner = document.createElement('div');
        banner.id = 'globalErrorBanner';
        banner.style.cssText =
            'position:fixed; top:0; left:0; right:0; background:#f8d7da; ' +
            'color:#721c24; padding:12px 16px; font-size:13px; z-index:9999; ' +
            'text-align:center; box-shadow:0 2px 6px rgba(0,0,0,0.15);';
        document.body.prepend(banner);
    }
    banner.textContent = message;
}

window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled error:', event.reason);
    const msg = (event.reason && event.reason.message) ? event.reason.message : String(event.reason);
    showGlobalError('⚠️ Gagal memuat aplikasi: ' + msg + ' — coba tutup & buka lagi.');
});

/**
 * Panggil ini sekali di awal, sebelum halaman memakai dbApi.
 * Akan otomatis:
 * 1. Load sql.js (WASM)
 * 2. Cek apakah sudah ada database tersimpan di IndexedDB
 *    - Ada -> load itu
 *    - Belum ada -> buat database baru + schema kosong
 */
async function initDatabase() {
    SQLModule = await initSqlJs({
        locateFile: file => `js/vendor/${file}`
    });

    const savedBytes = await loadDatabaseFromIndexedDB();

    if (savedBytes) {
        db = new SQLModule.Database(new Uint8Array(savedBytes));
        console.log('Database dimuat dari penyimpanan lokal HP.');
    } else {
        db = new SQLModule.Database();
        dbApi = createDbApi(db);
        dbApi.initSchema();
        await persistDatabase();
        console.log('Database baru dibuat (pertama kali dipakai).');
    }

    dbApi = createDbApi(db);

    await requestPersistentStorage();

    return dbApi;
}

/**
 * Simpan kondisi database saat ini ke IndexedDB.
 * WAJIB dipanggil setelah operasi tulis (create/update/delete),
 * karena sql.js bekerja di memori — tidak otomatis tersimpan sendiri.
 */
async function persistDatabase() {
    const exported = db.export();
    await saveDatabaseToIndexedDB(exported);
}

/**
 * Helper: bungkus fungsi dbApi supaya otomatis persist setelah dipanggil.
 * Supaya halaman-halaman lain tidak perlu ingat manggil persistDatabase()
 * manual setiap kali habis create/update/delete.
 */
function withAutoSave(fn) {
    return async (...args) => {
        const result = fn(...args);
        await persistDatabase();
        return result;
    };
}

/**
 * Ambil versi dbApi yang otomatis nyimpen tiap ada perubahan data.
 * Panggil ini setelah initDatabase() selesai.
 */
function getAutoSaveDbApi() {
    return {
        // Read-only, tidak perlu auto-save
        getBarangList: dbApi.getBarangList,
        getPesananList: dbApi.getPesananList,
        getPesananById: dbApi.getPesananById,
        getItemsByPesananId: dbApi.getItemsByPesananId,
        getPesananDetail: dbApi.getPesananDetail,
        getRingkasanHariIni: dbApi.getRingkasanHariIni,
        getReceiptData: dbApi.getReceiptData,

        // Write, wajib auto-save
        addBarang: withAutoSave(dbApi.addBarang),
        updateBarang: withAutoSave(dbApi.updateBarang),
        deleteBarang: withAutoSave(dbApi.deleteBarang),
        createPesanan: withAutoSave(dbApi.createPesanan),
        updatePesanan: withAutoSave(dbApi.updatePesanan),
        updateStatus: withAutoSave(dbApi.updateStatus),
        deletePesanan: withAutoSave(dbApi.deletePesanan)
    };
}

/**
 * Export seluruh database sebagai file .sqlite untuk backup manual.
 * Dipakai oleh fitur "Export Backup" (Fase 4).
 */
function exportDatabaseAsFile() {
    const exported = db.export();
    const blob = new Blob([exported], { type: 'application/x-sqlite3' });
    return blob;
}
