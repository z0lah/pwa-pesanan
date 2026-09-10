/**
 * receipt.js
 * Logic generate receipt (ESC/POS) & koneksi printer Bluetooth.
 * Diambil PERSIS dari kode pesanan_detail.html lama yang sudah
 * teruji jalan dengan printer fisik - tidak diubah sama sekali,
 * cuma dipindah ke file terpisah supaya reusable.
 */

let bluetoothDevice = null;
let printerCharacteristic = null;

const ESC = '\x1B';
const GS = '\x1D';

const CMD = {
    INIT: ESC + '@',
    ALIGN_CENTER: ESC + 'a' + '1',
    ALIGN_LEFT: ESC + 'a' + '0',
    BOLD_ON: ESC + 'E' + '1',
    BOLD_OFF: ESC + 'E' + '0',
    SIZE_NORMAL: GS + '!' + '\x00',
    SIZE_DOUBLE: GS + '!' + '\x11',
    CUT: GS + 'V' + '1'
};

function formatCurrency(amount) {
    return 'Rp ' + amount.toLocaleString('id-ID');
}

function generateReceipt(data) {
    let receipt = '';

    receipt += CMD.INIT;
    receipt += CMD.ALIGN_CENTER + CMD.SIZE_DOUBLE + CMD.BOLD_ON;
    receipt += 'BAROKAH RASA\n';
    receipt += CMD.SIZE_NORMAL + CMD.BOLD_OFF;
    receipt += 'Jl. Kh. Mimbar Gg.2 Jombang\n';
    receipt += '085156574728\n';
    receipt += '================================\n';
    receipt += CMD.ALIGN_LEFT;
    receipt += CMD.BOLD_ON;
    receipt += 'Nama        : ' + data.nama_pemesan + '\n';
    receipt += CMD.BOLD_OFF;
    receipt += 'No. Pesanan : #' + data.pesanan_id + '\n';
    receipt += 'Tanggal     : ' + data.tanggal + '\n';
    receipt += '================================\n\n';

    data.items.forEach(item => {
        receipt += CMD.BOLD_ON + item.nama + '\n' + CMD.BOLD_OFF;

        if (item.note && item.note.trim()) {
            receipt += '  Note: ' + item.note + '\n';
        }

        const qtyLine = '  ' + item.qty + ' x ' + formatCurrency(item.harga);
        const subtotal = formatCurrency(item.subtotal);
        const spaces = 32 - qtyLine.length - subtotal.length;
        receipt += qtyLine + ' '.repeat(Math.max(spaces, 1)) + subtotal + '\n';
    });

    receipt += '--------------------------------\n';

    receipt += CMD.SIZE_DOUBLE + CMD.BOLD_ON;
    const totalText = 'TOTAL';
    const totalAmount = formatCurrency(data.total);
    const spaces = 16 - totalText.length - totalAmount.length;
    receipt += totalText + ' '.repeat(Math.max(spaces, 1)) + totalAmount + '\n';

    receipt += CMD.SIZE_NORMAL + CMD.BOLD_OFF;
    receipt += '================================\n';

    receipt += CMD.ALIGN_CENTER;
    receipt += 'Terima Kasih\n';
    receipt += '\n\n';

    receipt += CMD.CUT;

    return receipt;
}

async function connectToPrinter(onStatus) {
    try {
        onStatus('📡 Mencari printer Bluetooth...', 'info');

        bluetoothDevice = await navigator.bluetooth.requestDevice({
            filters: [
                { services: ['000018f0-0000-1000-8000-00805f9b34fb'] },
                { namePrefix: 'MP-' },
                { namePrefix: 'Printer' }
            ],
            optionalServices: ['000018f0-0000-1000-8000-00805f9b34fb']
        });

        onStatus('🔗 Menghubungkan ke ' + bluetoothDevice.name + '...', 'info');

        const server = await bluetoothDevice.gatt.connect();
        const service = await server.getPrimaryService('000018f0-0000-1000-8000-00805f9b34fb');
        printerCharacteristic = await service.getCharacteristic('00002af1-0000-1000-8000-00805f9b34fb');

        return true;
    } catch (error) {
        console.error('Bluetooth error:', error);

        if (error.name === 'NotFoundError') {
            onStatus('❌ Printer tidak ditemukan. Pastikan printer nyala dan paired.', 'danger');
        } else {
            onStatus('❌ Gagal connect: ' + error.message, 'danger');
        }

        return false;
    }
}

async function sendToPrinter(data) {
    try {
        const encoder = new TextEncoder();
        const encoded = encoder.encode(data);

        const chunkSize = 20;
        for (let i = 0; i < encoded.length; i += chunkSize) {
            const chunk = encoded.slice(i, i + chunkSize);
            await printerCharacteristic.writeValue(chunk);
            await new Promise(resolve => setTimeout(resolve, 10));
        }

        return true;
    } catch (error) {
        console.error('Print error:', error);
        return false;
    }
}

/**
 * Orkestrasi lengkap: connect (kalau belum) + generate + kirim ke printer.
 * `receiptData` adalah hasil dari dbApi.getReceiptData(id) - struktur
 * field-nya sudah sama persis dengan yang dipakai generateReceipt().
 */
async function printReceipt(receiptData, onStatus) {
    if (!navigator.bluetooth) {
        onStatus('⚠️ Browser tidak support Web Bluetooth. Gunakan Chrome terbaru.', 'warning');
        return false;
    }

    if (!bluetoothDevice || !bluetoothDevice.gatt.connected) {
        const connected = await connectToPrinter(onStatus);
        if (!connected) return false;
    }

    onStatus('📄 Membuat receipt...', 'info');
    const receiptText = generateReceipt(receiptData);

    onStatus('🖨️ Mencetak...', 'info');
    const printed = await sendToPrinter(receiptText);

    if (printed) {
        onStatus('✅ Receipt berhasil dicetak!', 'success');
    } else {
        onStatus('❌ Gagal mencetak. Coba lagi.', 'danger');
    }

    return printed;
}
