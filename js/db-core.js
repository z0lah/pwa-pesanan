/**
 * db-core.js
 * Logic inti database (schema + query). File ini dipakai SAMA PERSIS
 * baik saat testing di Node.js maupun saat jalan di browser HP.
 * Tidak ada kode khusus browser (fetch, DOM, dll) di sini.
 */

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS barang (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nama TEXT NOT NULL,
    harga REAL NOT NULL,
    available INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS pesanan (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nama_pemesan TEXT NOT NULL,
    total REAL NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'Disiapkan',
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS pesanan_item (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pesanan_id INTEGER NOT NULL,
    barang_id INTEGER,
    nama_barang TEXT NOT NULL,
    harga REAL NOT NULL,
    jumlah INTEGER NOT NULL,
    subtotal REAL NOT NULL,
    note TEXT DEFAULT NULL,
    FOREIGN KEY (pesanan_id) REFERENCES pesanan (id) ON DELETE CASCADE
);
`;

/**
 * Buat helper API dari instance sql.js Database yang sudah di-init.
 * `db` adalah instance dari `new SQL.Database()` atau
 * `new SQL.Database(existingBytes)`.
 */
function createDbApi(db) {

    function nowISOLocal() {
        // Timestamp lokal HP (otomatis Asia/Jakarta jika itu timezone HP-nya)
        const d = new Date();
        const pad = (n) => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
               `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    }

    function runQuery(sql, params = []) {
        const stmt = db.prepare(sql);
        stmt.bind(params);
        const rows = [];
        while (stmt.step()) {
            rows.push(stmt.getAsObject());
        }
        stmt.free();
        return rows;
    }

    function runExec(sql, params = []) {
        db.run(sql, params);
    }

    function initSchema() {
        db.run(SCHEMA_SQL);
    }

    // ===== BARANG =====

    function addBarang(nama, harga, available = 1) {
        runExec(
            'INSERT INTO barang (nama, harga, available) VALUES (?, ?, ?)',
            [nama, harga, available]
        );
        return lastInsertId();
    }

    function getBarangList(onlyAvailable = false) {
        const sql = onlyAvailable
            ? 'SELECT * FROM barang WHERE available = 1 ORDER BY nama'
            : 'SELECT * FROM barang ORDER BY nama';
        return runQuery(sql);
    }

    function updateBarang(id, nama, harga, available) {
        runExec(
            'UPDATE barang SET nama = ?, harga = ?, available = ? WHERE id = ?',
            [nama, harga, available, id]
        );
    }

    function deleteBarang(id) {
        runExec('DELETE FROM barang WHERE id = ?', [id]);
    }

    function lastInsertId() {
        const rows = runQuery('SELECT last_insert_rowid() as id');
        return rows[0].id;
    }

    // ===== PESANAN =====

    function createPesanan(namaPemesan, items) {
        const total = items.reduce((sum, it) => sum + it.subtotal, 0);
        const createdAt = nowISOLocal();

        runExec(
            'INSERT INTO pesanan (nama_pemesan, total, status, created_at) VALUES (?, ?, ?, ?)',
            [namaPemesan, total, 'Disiapkan', createdAt]
        );
        const pesananId = lastInsertId();

        for (const item of items) {
            runExec(
                `INSERT INTO pesanan_item
                 (pesanan_id, barang_id, nama_barang, harga, jumlah, subtotal, note)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [
                    pesananId,
                    item.barang_id || null,
                    item.nama_barang,
                    item.harga,
                    item.jumlah,
                    item.subtotal,
                    item.note || null
                ]
            );
        }

        return pesananId;
    }

    function updatePesanan(id, namaPemesan, items) {
        const total = items.reduce((sum, it) => sum + it.subtotal, 0);

        runExec(
            'UPDATE pesanan SET nama_pemesan = ?, total = ? WHERE id = ?',
            [namaPemesan, total, id]
        );

        // Hapus semua item lama, insert ulang (sama seperti behaviour app lama)
        runExec('DELETE FROM pesanan_item WHERE pesanan_id = ?', [id]);

        for (const item of items) {
            runExec(
                `INSERT INTO pesanan_item
                 (pesanan_id, barang_id, nama_barang, harga, jumlah, subtotal, note)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [
                    id,
                    item.barang_id || null,
                    item.nama_barang,
                    item.harga,
                    item.jumlah,
                    item.subtotal,
                    item.note || null
                ]
            );
        }
    }

    function updateStatus(id, status) {
        runExec('UPDATE pesanan SET status = ? WHERE id = ?', [status, id]);
    }

    function deletePesanan(id) {
        runExec('DELETE FROM pesanan_item WHERE pesanan_id = ?', [id]);
        runExec('DELETE FROM pesanan WHERE id = ?', [id]);
    }

    function getPesananList() {
        // Tie-breaker "id DESC" penting: created_at presisi per-detik,
        // jadi 2 pesanan yang dibuat di detik yang sama harus tetap
        // terurut benar (yang terakhir dibuat = paling atas).
        return runQuery('SELECT * FROM pesanan ORDER BY created_at DESC, id DESC');
    }

    function getPesananById(id) {
        const rows = runQuery('SELECT * FROM pesanan WHERE id = ?', [id]);
        return rows[0] || null;
    }

    function getItemsByPesananId(id) {
        return runQuery('SELECT * FROM pesanan_item WHERE pesanan_id = ?', [id]);
    }

    function getPesananDetail(id) {
        const pesanan = getPesananById(id);
        if (!pesanan) return null;
        const items = getItemsByPesananId(id);
        return { pesanan, items };
    }

    // Ringkasan hari ini (jam 00:00 - 23:59 waktu lokal HP)
    function getRingkasanHariIni() {
        const today = nowISOLocal().split(' ')[0]; // YYYY-MM-DD
        const rows = runQuery(
            `SELECT * FROM pesanan WHERE created_at LIKE ? ORDER BY created_at DESC`,
            [today + '%']
        );
        const totalPemasukan = rows.reduce((sum, p) => sum + p.total, 0);
        return {
            jumlah_pesanan: rows.length,
            total_pemasukan: totalPemasukan,
            pesanan: rows
        };
    }

    // Data siap-pakai untuk generateReceipt() di halaman print (struktur SAMA
    // seperti response /api/get-receipt-data/<id> pada app Flask lama)
    function getReceiptData(id) {
        const detail = getPesananDetail(id);
        if (!detail) return null;

        return {
            pesanan_id: detail.pesanan.id,
            nama_pemesan: detail.pesanan.nama_pemesan,
            tanggal: detail.pesanan.created_at,
            status: detail.pesanan.status,
            total: detail.pesanan.total,
            items: detail.items.map(it => ({
                nama: it.nama_barang,
                qty: it.jumlah,
                harga: it.harga,
                subtotal: it.subtotal,
                note: it.note
            }))
        };
    }

    return {
        initSchema,
        addBarang,
        getBarangList,
        updateBarang,
        deleteBarang,
        createPesanan,
        updatePesanan,
        updateStatus,
        deletePesanan,
        getPesananList,
        getPesananById,
        getItemsByPesananId,
        getPesananDetail,
        getRingkasanHariIni,
        getReceiptData
    };
}

// Export untuk Node.js (testing) — di browser, blok ini otomatis diabaikan
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SCHEMA_SQL, createDbApi };
}
