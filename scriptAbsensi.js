const STORAGE_KEY = 'presensiData';

const form = document.getElementById('presensiForm');
const tbody = document.getElementById('tbody');
const searchInput = document.getElementById('searchInput');
const exportBtn = document.getElementById('exportBtn');
const resetBtn = document.getElementById('resetBtn');
const message = document.getElementById('message');
const scanQrBtn = document.getElementById('scanQrBtn');
const reader = document.getElementById('reader');
const namaInput = document.getElementById('nama');
const nisInput = document.getElementById('nis');
const kelasSelect = document.getElementById('kelas');
const tanggalInput = document.getElementById('tanggal');
const bulanInput = document.getElementById('bulan');
const sidebarLinks = document.querySelectorAll('.sidebar a');
const logoutLink = document.getElementById('logoutLink');
const qrModal = document.getElementById('qrModal');
const closeQrModal = document.getElementById('closeQrModal');
const qrCodeContainer = document.getElementById('qrCode');
const qrStudentInfo = document.getElementById('qrStudentInfo');

let qrStream = null;
let scanningActive = false;
let detector = null;

const defaultData = [
    { nama: 'Ayu Lestari', nis: '202401', kelas: 'IPA 1', tanggal: '2026-07-19', bulan: 'Juli', status: 'Hadir' },
    { nama: 'Budi Santoso', nis: '202402', kelas: 'IPA 2', tanggal: '2026-07-19', bulan: 'Juli', status: 'Izin' },
    { nama: 'Citra Dewi', nis: '202403', kelas: 'IPA 3', tanggal: '2026-07-19', bulan: 'Juli', status: 'Sakit' },
    { nama: 'Dimas Pratama', nis: '202404', kelas: 'IPA 4', tanggal: '2026-07-19', bulan: 'Juli', status: 'Alpha' },
    { nama: 'Rina Amelia', nis: '202405', kelas: 'IPA 5', tanggal: '2026-07-19', bulan: 'Juli', status: 'Hadir' }
];

const studentProfileMap = {
    '202401': { nama: 'Ayu Lestari', kelas: 'IPA 1' },
    '202402': { nama: 'Budi Santoso', kelas: 'IPA 2' },
    '202403': { nama: 'Citra Dewi', kelas: 'IPA 3' },
    '202404': { nama: 'Dimas Pratama', kelas: 'IPA 4' },
    '202405': { nama: 'Rina Amelia', kelas: 'IPA 5' }
};

let presensiData = sortPresensiData(loadData());

function normalizeClassName(kelas) {
    if (!kelas) return 'IPA 1';

    const normalized = String(kelas).trim();
    const validClasses = ['IPA 1', 'IPA 2', 'IPA 3', 'IPA 4', 'IPA 5'];
    if (validClasses.includes(normalized)) {
        return normalized;
    }

    const legacyMap = {
        'X RPL 1': 'IPA 1',
        'X RPL 2': 'IPA 2',
        'XI RPL 1': 'IPA 3',
        'XI RPL 2': 'IPA 4',
        'XII RPL 1': 'IPA 5'
    };

    return legacyMap[normalized] || 'IPA 1';
}

function loadData() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultData));
        return [...defaultData].map(item => ({ ...item, kelas: normalizeClassName(item.kelas) }));
    }

    try {
        const parsed = JSON.parse(saved);
        const safeData = Array.isArray(parsed) ? parsed : [...defaultData];
        return safeData.map(item => ({
            ...item,
            kelas: normalizeClassName(item.kelas)
        }));
    } catch {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultData));
        return [...defaultData].map(item => ({ ...item, kelas: normalizeClassName(item.kelas) }));
    }
}

function saveData() {
    presensiData = sortPresensiData(presensiData);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(presensiData));
}

function sortPresensiData(data) {
    return [...data].sort((a, b) => {
        const kelasCompare = a.kelas.localeCompare(b.kelas, 'id');
        if (kelasCompare !== 0) return kelasCompare;
        return a.nama.localeCompare(b.nama, 'id');
    });
}

function showMessage(text, type) {
    message.textContent = text;
    message.className = `message ${type}`;
}

function escapeHtml(text) {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function getStatusClass(status) {
    return status.toLowerCase();
}

function updateDashboard() {
    const totalSiswa = presensiData.length;
    const hadir = presensiData.filter(item => item.status === 'Hadir').length;
    const izin = presensiData.filter(item => item.status === 'Izin').length;
    const sakit = presensiData.filter(item => item.status === 'Sakit').length;
    const alpha = presensiData.filter(item => item.status === 'Alpha').length;
    const totalKelas = kelasSelect.options.length;

    document.getElementById('totalSiswa').textContent = totalSiswa;
    document.getElementById('totalKelas').textContent = totalKelas;
    document.getElementById('hadirCount').textContent = hadir;
    document.getElementById('tidakHadirCount').textContent = totalSiswa - hadir;

    document.getElementById('statHadir').textContent = hadir;
    document.getElementById('statIzin').textContent = izin;
    document.getElementById('statSakit').textContent = sakit;
    document.getElementById('statAlpha').textContent = alpha;
}

function activateSidebarLink(targetId) {
    sidebarLinks.forEach(link => {
        const parent = link.parentElement;
        const isActive = link.getAttribute('href') === `#${targetId}`;
        parent.classList.toggle('active', isActive);
    });
}

function handleSidebarNavigation(event) {
    const link = event.currentTarget;
    const targetId = link.getAttribute('href');

    if (!targetId || targetId === '#') {
        return;
    }

    event.preventDefault();
    const section = document.querySelector(targetId);
    if (section) {
        section.scrollIntoView({ behavior: 'smooth', block: 'start' });
        activateSidebarLink(targetId.replace('#', ''));
    }
}

function autoFillStudentByNis() {
    const nis = nisInput.value.trim();
    const profile = studentProfileMap[nis];

    if (!profile) {
        return;
    }

    if (!namaInput.value.trim()) {
        namaInput.value = profile.nama;
    }

    kelasSelect.value = profile.kelas;
}

function renderTable(filterText = '') {
    const search = filterText.toLowerCase().trim();

    const filtered = presensiData.filter(item => {
        const text = `${item.nama} ${item.nis} ${item.kelas} ${item.bulan}`.toLowerCase();
        return text.includes(search);
    });

    tbody.innerHTML = '';

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8">Tidak ada data yang cocok.</td></tr>`;
        return;
    }

    filtered.forEach((item, index) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${index + 1}</td>
            <td>${escapeHtml(item.nama)}</td>
            <td>${escapeHtml(item.nis)}</td>
            <td>${escapeHtml(item.kelas)}</td>
            <td>${escapeHtml(item.tanggal || '-')}</td>
            <td>${escapeHtml(item.bulan || '-')}</td>
            <td><span class="status-badge ${getStatusClass(item.status)}">${item.status}</span></td>
            <td>
                <div class="action-group">
                    <button type="button" class="action-btn qr-btn" data-qr="${escapeHtml(`${item.nama}|${item.nis}|${item.kelas}`)}">QR</button>
                    <button type="button" class="action-btn delete-btn" data-nis="${escapeHtml(item.nis)}">Hapus</button>
                </div>
            </td>
        `;
        tbody.appendChild(row);
    });

    document.querySelectorAll('.delete-btn').forEach(button => {
        button.addEventListener('click', () => deleteData(button.dataset.nis));
    });

    document.querySelectorAll('.qr-btn').forEach(button => {
        button.addEventListener('click', () => openQrModal(button.dataset.qr));
    });
}

function addData(event) {
    event.preventDefault();

    const nama = document.getElementById('nama').value.trim();
    const nis = document.getElementById('nis').value.trim();
    const kelas = normalizeClassName(document.getElementById('kelas').value);
    const tanggal = tanggalInput.value;
    const bulan = bulanInput.value;
    const status = document.getElementById('status').value;

    if (!nama || !nis || !tanggal || !bulan) {
        showMessage('Nama, NIS, tanggal, dan bulan harus diisi.', 'error');
        return;
    }

    const duplicate = presensiData.some(item => item.nis === nis && item.tanggal === tanggal && item.bulan === bulan);
    if (duplicate) {
        showMessage('Data presensi untuk NIS ini pada tanggal dan bulan yang sama sudah ada.', 'error');
        return;
    }

    presensiData.unshift({ nama, nis, kelas, tanggal, bulan, status });
    saveData();
    updateDashboard();
    renderTable(searchInput.value);
    form.reset();
    tanggalInput.value = new Date().toISOString().split('T')[0];
    showMessage('Presensi berhasil disimpan.', 'success');
}

function openQrModal(payload) {
    if (!payload) return;

    const [nama, nis, kelas] = payload.split('|');
    qrStudentInfo.textContent = `${nama} • ${nis} • ${kelas}`;
    qrCodeContainer.innerHTML = '';

    if (typeof QRCode !== 'undefined') {
        new QRCode(qrCodeContainer, {
            text: payload,
            width: 180,
            height: 180,
            colorDark: '#0f172a',
            colorLight: '#ffffff',
            correctLevel: QRCode.CorrectLevel.H
        });
    } else {
        qrCodeContainer.textContent = 'Library QR tidak tersedia.';
    }

    qrModal.classList.add('show');
}

function closeQrModalWindow() {
    qrModal.classList.remove('show');
}

function deleteData(nis) {
    presensiData = presensiData.filter(item => item.nis !== nis);
    saveData();
    updateDashboard();
    renderTable(searchInput.value);
    showMessage('Data presensi berhasil dihapus.', 'success');
}

function resetData() {
    const confirmed = window.confirm('Apakah Anda yakin ingin menghapus semua data presensi?');
    if (!confirmed) return;

    presensiData = [];
    saveData();
    updateDashboard();
    renderTable(searchInput.value);
    showMessage('Semua data presensi berhasil direset.', 'success');
}

function exportToExcel() {
    if (presensiData.length === 0) {
        showMessage('Belum ada data untuk diekspor.', 'error');
        return;
    }

    if (typeof XLSX === 'undefined') {
        showMessage('Library Excel belum tersedia. Coba muat ulang halaman.', 'error');
        return;
    }

    const worksheetData = presensiData.map(item => ({
        Nama: item.nama,
        NIS: item.nis,
        Kelas: item.kelas,
        Tanggal: item.tanggal || '-',
        Bulan: item.bulan || '-',
        Status: item.status
    }));

    const groupedByClass = worksheetData.reduce((result, item) => {
        const key = item.Kelas || 'Tanpa Kelas';
        if (!result[key]) result[key] = [];
        result[key].push(item);
        return result;
    }, {});

    const workbook = XLSX.utils.book_new();
    const allDataSheet = XLSX.utils.json_to_sheet(worksheetData);
    XLSX.utils.book_append_sheet(workbook, allDataSheet, 'Semua Data');

    Object.keys(groupedByClass).sort().forEach(kelas => {
        const sheet = XLSX.utils.json_to_sheet(groupedByClass[kelas]);
        XLSX.utils.book_append_sheet(workbook, sheet, kelas);
    });

    XLSX.writeFile(workbook, 'data-presensi.xlsx');
    showMessage('File Excel berhasil diekspor. Data sudah dikelompokkan per kelas.', 'success');
}

function getCurrentMonthName() {
    const monthNames = [
        'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
        'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];
    return monthNames[new Date().getMonth()];
}

function setTodayDateFields() {
    const today = new Date().toISOString().split('T')[0];
    tanggalInput.value = today;
    bulanInput.value = getCurrentMonthName();
}

function parseQrPayload(payload) {
    try {
        const data = JSON.parse(payload);
        if (data && data.nama && data.nis && data.kelas) {
            document.getElementById('nama').value = data.nama;
            document.getElementById('nis').value = data.nis;
            document.getElementById('kelas').value = data.kelas;
            setTodayDateFields();
            showMessage('QR berhasil dipindai, data siswa otomatis terisi.', 'success');
            return true;
        }
    } catch {
        const parts = payload.split('|');
        if (parts.length >= 3) {
            document.getElementById('nama').value = parts[0];
            document.getElementById('nis').value = parts[1];
            document.getElementById('kelas').value = parts[2];
            setTodayDateFields();
            showMessage('QR berhasil dipindai, data siswa otomatis terisi.', 'success');
            return true;
        }
    }

    showMessage('Format QR tidak valid. Gunakan format JSON atau nama|nis|kelas.', 'error');
    return false;
}

function stopQrScanner() {
    scanningActive = false;
    if (qrStream) {
        qrStream.getTracks().forEach(track => track.stop());
        qrStream = null;
    }
    reader.classList.remove('show');
    reader.innerHTML = '';
}

async function startQrScanner() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        showMessage('Browser ini belum mendukung akses kamera untuk scan QR.', 'error');
        return;
    }

    try {
        stopQrScanner();
        reader.classList.add('show');
        reader.innerHTML = '<video id="qrVideo" autoplay playsinline muted></video>';

        const video = document.getElementById('qrVideo');
        qrStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment' }
        });

        video.srcObject = qrStream;
        await video.play();

        scanningActive = true;

        if ('BarcodeDetector' in window) {
            detector = new BarcodeDetector({ formats: ['qr_code'] });

            const scanFrame = async () => {
                if (!scanningActive) return;

                try {
                    const barcodes = await detector.detect(video);
                    if (barcodes && barcodes.length > 0) {
                        const payload = barcodes[0].rawValue;
                        parseQrPayload(payload);
                        stopQrScanner();
                        return;
                    }
                } catch {
                    // lanjutkan scanning sampai frame berikutnya
                }

                if (scanningActive) {
                    requestAnimationFrame(scanFrame);
                }
            };

            scanFrame();
            showMessage('Scanner QR aktif. Arahkan kamera ke QR siswa.', 'success');
            return;
        }

        if (typeof jsQR !== 'undefined') {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            const scanFrame = () => {
                if (!scanningActive) return;

                const width = video.videoWidth;
                const height = video.videoHeight;

                if (!width || !height) {
                    requestAnimationFrame(scanFrame);
                    return;
                }

                canvas.width = width;
                canvas.height = height;
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const code = jsQR(imageData.data, imageData.width, imageData.height, {
                    inversionAttempts: 'dontInvert'
                });

                if (code) {
                    parseQrPayload(code.data);
                    stopQrScanner();
                    return;
                }

                requestAnimationFrame(scanFrame);
            };

            scanFrame();
            showMessage('Scanner QR aktif. Arahkan kamera ke QR siswa.', 'success');
            return;
        }

        stopQrScanner();
        showMessage('Scanner QR tidak tersedia di browser ini. Coba gunakan browser yang mendukung kamera modern.', 'error');
    } catch {
        stopQrScanner();
        showMessage('Gagal mengaktifkan kamera. Pastikan izin kamera sudah diberikan.', 'error');
    }
}

sidebarLinks.forEach(link => {
    link.addEventListener('click', handleSidebarNavigation);
});

logoutLink.addEventListener('click', (event) => {
    event.preventDefault();
    showMessage('Anda berhasil logout.', 'success');
});

closeQrModal.addEventListener('click', closeQrModalWindow);
qrModal.addEventListener('click', (event) => {
    if (event.target === qrModal) {
        closeQrModalWindow();
    }
});

form.addEventListener('submit', addData);
searchInput.addEventListener('input', (event) => renderTable(event.target.value));
nisInput.addEventListener('input', autoFillStudentByNis);
exportBtn.addEventListener('click', exportToExcel);
resetBtn.addEventListener('click', resetData);
scanQrBtn.addEventListener('click', startQrScanner);

tanggalInput.value = new Date().toISOString().split('T')[0];

updateDashboard();
renderTable();
