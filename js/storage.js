/**
 * storage.js
 * Menyimpan & memuat file database SQLite (sebagai binary) ke IndexedDB,
 * supaya data tetap ada meski tab/app ditutup atau HP di-restart.
 */

const IDB_NAME = 'aplikasi-pesanan-storage';
const IDB_STORE = 'sqlite-file';
const IDB_KEY = 'main-db';

function openAppIndexedDB() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(IDB_NAME, 1);
        req.onupgradeneeded = () => {
            if (!req.result.objectStoreNames.contains(IDB_STORE)) {
                req.result.createObjectStore(IDB_STORE);
            }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

async function saveDatabaseToIndexedDB(uint8Array) {
    const idb = await openAppIndexedDB();
    return new Promise((resolve, reject) => {
        const tx = idb.transaction(IDB_STORE, 'readwrite');
        tx.objectStore(IDB_STORE).put(uint8Array, IDB_KEY);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

async function loadDatabaseFromIndexedDB() {
    const idb = await openAppIndexedDB();
    return new Promise((resolve, reject) => {
        const tx = idb.transaction(IDB_STORE, 'readonly');
        const req = tx.objectStore(IDB_STORE).get(IDB_KEY);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
    });
}

/**
 * Minta browser untuk tidak menghapus data ini secara otomatis
 * saat storage HP penuh. Tidak menjamin 100%, tapi jauh lebih aman.
 */
async function requestPersistentStorage() {
    if (navigator.storage && navigator.storage.persist) {
        const isPersisted = await navigator.storage.persist();
        console.log('Persistent storage:', isPersisted ? 'granted' : 'not granted');
        return isPersisted;
    }
    return false;
}
