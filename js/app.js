/**
 * app.js
 * Menghubungkan db-core.js (logic SQL) dengan storage.js (persistence browser).
 * File ini yang dipanggil oleh halaman-halaman HTML nantinya.
 */

let db = null;
let dbApi = null;
let SQLModule = null;

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
        locateFile: file => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/${file}`
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
