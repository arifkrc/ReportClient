import ApiClient from '../ui/core/api-client.js';
import { APP_CONFIG } from '../config/app-config.js';
import { createSimpleTable } from '../ui/simple-table.js';

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export async function mount(container, opts = {}) {
  const setHeader = opts.setHeader || (() => {});
  setHeader('Üretim-Paket Farkı', 'Üretim ile paketleme arasındaki fark');
  container.innerHTML = `
    <div class="p-4">
      <h3 class="text-lg font-semibold mb-2">Üretim - Paketleme Farkı</h3>
      <p class="text-sm text-neutral-400 mb-4">Üretim ve paketleme kayıtları arasındaki farklılıklar listelenir.</p>

      <div class="flex gap-2 items-end mb-3">
        <div>
          <label class="text-xs text-neutral-400">Başlangıç</label>
          <input id="diff-from" type="date" class="mt-1 px-2 py-1 bg-neutral-700 rounded text-sm">
        </div>
        <div>
          <label class="text-xs text-neutral-400">Bitiş</label>
          <input id="diff-to" type="date" class="mt-1 px-2 py-1 bg-neutral-700 rounded text-sm">
        </div>
        <div>
          <label class="text-xs text-neutral-400">Sayfa büyüklüğü</label>
          <select id="diff-page-size" class="mt-1 px-2 py-1 bg-neutral-700 rounded text-sm">
            <option value="10">10</option>
            <option value="20" selected>20</option>
            <option value="50">50</option>
            <option value="100">100</option>
          </select>
        </div>
        <div>
          <button id="diff-refresh" class="mt-1 px-3 py-1 bg-indigo-600 rounded text-sm">Uygula</button>
        </div>
      </div>

      <div id="uretim-paket-farki-container" class="bg-neutral-800 p-4 rounded">Yükleniyor...</div>
      <div id="uretim-paket-farki-table" class="mt-3"></div>
      <div class="flex items-center gap-2 mt-3">
        <button id="diff-prev" class="px-2 py-1 bg-neutral-700 rounded">Önceki</button>
        <div id="diff-page-info" class="text-sm text-neutral-400">Sayfa 1</div>
        <button id="diff-next" class="px-2 py-1 bg-neutral-700 rounded">Sonraki</button>
      </div>
    </div>
  `;

  const api = new ApiClient(APP_CONFIG.API.BASE_URL);
  const containerEl = container.querySelector('#uretim-paket-farki-container');
  const fromInput = container.querySelector('#diff-from');
  const toInput = container.querySelector('#diff-to');
  const pageSizeInput = container.querySelector('#diff-page-size');
  const pageInfo = container.querySelector('#diff-page-info');
  let currentPage = 1;
  const tableMount = container.querySelector('#uretim-paket-farki-table');

  // Table for showing missing items
  const missingTable = createSimpleTable({
    apiBaseUrl: APP_CONFIG.API.BASE_URL,
    endpoints: { list: '/dummy' }, // dummy - we'll set data client-side
    columns: [
      { field: 'id', header: 'ID', sortable: true },
      { field: 'productCode', header: 'Ürün Kodu', sortable: true },
      { field: 'date', header: 'Tarih', sortable: true },
      { field: 'quantity', header: 'Adet', className: 'text-right', sortable: true }
    ],
    title: 'Paketlenmemiş Üretim'
  });
  tableMount.appendChild(missingTable);
  await missingTable.init();

  function buildQuery({ page, pageSize, from, to }) {
    const params = new URLSearchParams();
    if (page) params.set('page', String(page));
    if (pageSize) params.set('pageSize', String(pageSize));
    if (from) params.set('startDate', from);
    if (to) params.set('endDate', to);
    return params.toString() ? `?${params.toString()}` : '';
  }

  // Normalize date to YYYY-MM-DD for matching
  function normalizeDate(value) {
    if (!value) return '';
    try { const d = new Date(value); if (isNaN(d.getTime())) return value.slice(0,10); return d.toISOString().slice(0,10); } catch(e) { return String(value).slice(0,10); }
  }

  async function loadPage(page = 1) {
    containerEl.innerHTML = 'Yükleniyor...';
    const pageSize = Number(pageSizeInput.value || 20);
    const from = fromInput.value || null;
    const to = toInput.value || null;

  const endpointU = (APP_CONFIG.API.ENDPOINTS.PRODUCTION || '/uretim') + '/paged' + buildQuery({ page, pageSize, from, to });
  const endpointP = (APP_CONFIG.API.ENDPOINTS.PACKAGING || '/paketleme') + '/paged' + buildQuery({ page, pageSize, from, to });

    try {
      const [uretimRes, paketRes] = await Promise.all([
        api.get(endpointU),
        api.get(endpointP)
      ]);

      if (!uretimRes.success) throw new Error('Üretim hata: ' + (uretimRes.error || 'hata'));
      if (!paketRes.success) throw new Error('Paketleme hata: ' + (paketRes.error || 'hata'));

      const uretim = Array.isArray(uretimRes.data) ? uretimRes.data : (uretimRes.data && uretimRes.data.items) ? uretimRes.data.items : [];
      const paket = Array.isArray(paketRes.data) ? paketRes.data : (paketRes.data && paketRes.data.items) ? paketRes.data.items : [];

      // Build fast lookup maps
      const paketById = new Map();
      paket.forEach(p => { const key = (p.id||p.ID||p._id||'').toString(); if (key) paketById.set(key, p); });

      const paketByCodeDate = new Map();
      paket.forEach(p => {
        const code = (p.productCode || p.productcode || p.code || '').toString().toUpperCase();
        const date = normalizeDate(p.date || p.addedDateTime || p.createdAt || p.tarih || '');
        if (!code) return;
        const k = `${code}||${date}`;
        if (!paketByCodeDate.has(k)) paketByCodeDate.set(k, []);
        paketByCodeDate.get(k).push(p);
      });

      // Find missing: prefer id match; fallback to productCode+date
      const missing = [];
      for (const u of uretim) {
        const uid = (u.id||u.ID||u._id||'').toString();
        if (uid && paketById.has(uid)) continue; // packaged

        const ucode = (u.productCode || u.productcode || u.code || '').toString().toUpperCase();
        const udate = normalizeDate(u.date || u.addedDateTime || u.createdAt || u.tarih || '');
        const k = `${ucode}||${udate}`;
        if (ucode && paketByCodeDate.has(k)) continue; // matched by code+date

        missing.push(u);
      }

      if (!missing.length) {
        containerEl.innerHTML = `<div class="text-sm text-neutral-400">Üretim ve paketleme arasında fark bulunamadı.</div>`;
        pageInfo.textContent = `Sayfa ${page}`;
        return;
      }

      // populate missingTable with missing items (client-side)
      // missingTable expects container.addRecord / reload to use loadData; we can replace allRecords by calling addRecord repeatedly
      // Simpler: set missingTable's internal allRecords by calling missingTable.reload with a custom builder: we will rely on renderTable reading allRecords from its internal state via addRecord
      // Clear existing records by reloading dummy endpoint with empty
      missingTable.reload({ page: 1, pageSize: 20 });
      // Add missing records to the table using its public addRecord method
      missing.forEach(m => {
        const rec = {
          id: m.id || m.ID || m._id || '',
          productCode: m.productCode || m.productcode || m.code || '',
          date: m.date || m.createdAt || m.tarih || '',
          quantity: m.quantity || m.adet || ''
        };
        missingTable.addRecord(rec);
      });
      containerEl.innerHTML = `<div class="text-sm font-medium mb-2">Paketlenmemiş üretim kayıtları: ${missing.length}</div>`;
      pageInfo.textContent = `Sayfa ${page}`;
    } catch (err) {
      console.error('uretim-paket-farki load error', err);
      containerEl.innerHTML = `<div class="text-rose-400">Veri yüklenemedi: ${escapeHtml(err.message || String(err))}</div>`;
    }
  }

  container.querySelector('#diff-refresh').addEventListener('click', () => { currentPage = 1; loadPage(1); });
  container.querySelector('#diff-prev').addEventListener('click', () => { if (currentPage > 1) { currentPage--; loadPage(currentPage); } });
  container.querySelector('#diff-next').addEventListener('click', () => { currentPage++; loadPage(currentPage); });

  await loadPage(1);
}

export async function unmount(container) {
  try { const el = container.querySelector('#uretim-paket-farki-container'); if (el) el.innerHTML = ''; } catch(e){}
  try { container.innerHTML = ''; } catch(e){}
}
