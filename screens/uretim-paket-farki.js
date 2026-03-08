import ApiClient, { ApiResponseHelpers } from '../ui/core/api-client.js';
import { APP_CONFIG } from '../config/app-config.js';

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
  setHeader('Üretim-Paket Farkı', 'Üretilen ve paketlenen adetlerin kıyaslaması');

  container.innerHTML = `
    <div class="p-4">
      <div class="flex items-center justify-between mb-4">
        <div>
          <h3 class="text-lg font-semibold">Üretim — Paketleme Farkı</h3>
          <div class="text-sm text-neutral-400">Ürün bazında üretim ve paketleme adetlerini karşılaştırır</div>
        </div>
        <div class="flex items-center gap-2">
          <div>
            <label class="text-xs text-neutral-400 block mb-1">Başlangıç</label>
            <input id="diff-from" type="date" class="px-2 py-1 bg-neutral-700 rounded text-sm text-neutral-200">
          </div>
          <div>
            <label class="text-xs text-neutral-400 block mb-1">Bitiş</label>
            <input id="diff-to" type="date" class="px-2 py-1 bg-neutral-700 rounded text-sm text-neutral-200">
          </div>
          <div class="mt-5">
            <button id="diff-apply" class="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 rounded text-sm text-white">Uygula</button>
          </div>
        </div>
      </div>

      <!-- Özet kartlar -->
      <div id="diff-summary" class="grid grid-cols-3 gap-3 mb-4"></div>

      <!-- Tablo -->
      <div id="diff-table-wrap" class="bg-neutral-800 rounded p-3">
        <div class="text-sm text-neutral-400 animate-pulse">Yükleniyor...</div>
      </div>
    </div>
  `;

  const api = new ApiClient(APP_CONFIG.API.BASE_URL);
  const fromInput = container.querySelector('#diff-from');
  const toInput   = container.querySelector('#diff-to');
  const summaryEl = container.querySelector('#diff-summary');
  const tableWrap = container.querySelector('#diff-table-wrap');

  // Varsayılan tarih: bugün
  const today = new Date().toISOString().slice(0, 10);
  fromInput.value = today;
  toInput.value   = today;

  // localStorage'dan kayıtlı tarih varsa kullan (90 günden eski değilse)
  try {
    const saved   = localStorage.getItem('diffReport.lastFrom');
    const savedTo = localStorage.getItem('diffReport.lastTo');
    const cutoff  = new Date(); cutoff.setDate(cutoff.getDate() - 90);
    const cutStr  = cutoff.toISOString().slice(0, 10);
    if (saved   && saved   >= cutStr) fromInput.value = saved;
    if (savedTo && savedTo >= cutStr) toInput.value   = savedTo;
  } catch(e) {}

  async function fetchAllPages(endpointBase, startDate, endDate) {
    // Packings/daterange → array, PTF/paged → paged object
    if (endpointBase.includes('daterange')) {
      const sd = encodeURIComponent(startDate + 'T00:00:00');
      const ed = encodeURIComponent(endDate + 'T00:00:00');
      const res = await api.get(`${endpointBase}?startDate=${sd}&endDate=${ed}`);
      if (!res.success) return [];
      const data = ApiResponseHelpers.extractData(res);
      return Array.isArray(data) ? data : [];
    }
    // Paged endpoint
    let all = [], pg = 1;
    while (true) {
      const res = await api.get(`${endpointBase}?pageNumber=${pg}&pageSize=200&startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`);
      if (!res.success) break;
      let data;
      try { data = ApiResponseHelpers.extractData(res); } catch(e) { break; }
      const items = (data && data.items) ? data.items : (Array.isArray(data) ? data : []);
      if (!items.length) break;
      all = all.concat(items);
      if (!data.hasNextPage || items.length < 200) break;
      pg++;
    }
    return all;
  }

  async function load() {
    const from = fromInput.value;
    const to   = toInput.value || from;
    if (!from) { tableWrap.innerHTML = '<div class="text-amber-400 text-sm">Lütfen başlangıç tarihi seçin.</div>'; return; }

    summaryEl.innerHTML = '';
    tableWrap.innerHTML = '<div class="text-sm text-neutral-400 animate-pulse">Yükleniyor...</div>';

    try {
      // Bitiş günü dahil etmek için endDate'i bir sonraki gün yapıyoruz (daterange için)
      const nextDay = new Date(to);
      nextDay.setDate(nextDay.getDate() + 1);
      const nextDayStr = nextDay.toISOString().slice(0, 10);

      // Paketleme: Packings/daterange (çalışıyor)
      const paketItems = await fetchAllPages('/Packings/daterange', from, nextDayStr);

      // Üretim: ProductionTrackingForms/paged (500 dönebilir, graceful)
      let uretimItems = [];
      try {
        uretimItems = await fetchAllPages('/ProductionTrackingForms/paged', from, to);
      } catch(e) {
        console.warn('PTF fetch failed', e);
      }

      // === Tarih + Ürün koduna göre topla ===
      const byKey = {}; // "YYYY-MM-DD|productCode" → { date, productCode, productName, uretim, paket }

      const truncDate = iso => iso ? iso.slice(0, 10) : '';

      uretimItems.forEach(r => {
        const code = (r.productCode || '').trim();
        const date = truncDate(r.date || r.addedDateTime || '');
        if (!code) return;
        const key = `${date}|${code}`;
        if (!byKey[key]) byKey[key] = { date, productCode: code, productName: r.productName || '', uretim: 0, paket: 0 };
        byKey[key].uretim += (r.quantity || 0);
      });

      paketItems.forEach(r => {
        const code = (r.productCode || '').trim();
        const date = truncDate(r.date || r.addedDateTime || '');
        if (!code) return;
        const key = `${date}|${code}`;
        if (!byKey[key]) byKey[key] = { date, productCode: code, productName: r.productName || '', uretim: 0, paket: 0 };
        byKey[key].paket += (r.quantity || 0);
      });

      const rows = Object.values(byKey).sort((a, b) => {
        // Önce tarihe göre azalan, sonra farka göre azalan
        if (b.date !== a.date) return b.date.localeCompare(a.date);
        return Math.abs(b.uretim - b.paket) - Math.abs(a.uretim - a.paket);
      });

      // === Özet kartlar ===
      const totalUretim = rows.reduce((s, r) => s + r.uretim, 0);
      const totalPaket  = rows.reduce((s, r) => s + r.paket, 0);
      const totalFark   = totalUretim - totalPaket;
      const farkColor   = totalFark > 0 ? 'text-amber-400' : totalFark < 0 ? 'text-rose-400' : 'text-green-400';

      summaryEl.innerHTML = `
        <div class="bg-neutral-800 rounded p-3 border-l-4 border-indigo-500">
          <div class="text-xs text-neutral-400 mb-1">Toplam Üretim</div>
          <div class="text-2xl font-bold text-neutral-100">${totalUretim.toLocaleString('tr-TR')}</div>
          <div class="text-xs text-neutral-500 mt-1">${uretimItems.length} kayıt${uretimItems.length === 0 ? ' (PTF henüz aktif değil)' : ''}</div>
        </div>
        <div class="bg-neutral-800 rounded p-3 border-l-4 border-emerald-500">
          <div class="text-xs text-neutral-400 mb-1">Toplam Paketleme</div>
          <div class="text-2xl font-bold text-emerald-400">${totalPaket.toLocaleString('tr-TR')}</div>
          <div class="text-xs text-neutral-500 mt-1">${paketItems.length} kayıt</div>
        </div>
        <div class="bg-neutral-800 rounded p-3 border-l-4 ${totalFark > 0 ? 'border-amber-500' : totalFark < 0 ? 'border-rose-500' : 'border-green-500'}">
          <div class="text-xs text-neutral-400 mb-1">Fark (Üretim − Paket)</div>
          <div class="text-2xl font-bold ${farkColor}">${totalFark > 0 ? '+' : ''}${totalFark.toLocaleString('tr-TR')}</div>
          <div class="text-xs text-neutral-500 mt-1">${rows.length} farklı ürün kodu</div>
        </div>
      `;

      // === Tablo ===
      if (rows.length === 0) {
        tableWrap.innerHTML = '<div class="text-sm text-neutral-400 text-center py-6">Seçilen tarih aralığında veri bulunamadı.</div>';
        return;
      }

      let html = `
        <div class="overflow-x-auto">
          <table style="width:100%;border-collapse:collapse">
            <thead>
              <tr style="background:#1f2937;border-bottom:2px solid #374151">
                <th style="text-align:left;padding:8px 12px;color:#9ca3af;font-size:12px;font-weight:600">Tarih</th>
                <th style="text-align:left;padding:8px 12px;color:#9ca3af;font-size:12px;font-weight:600">Ürün Kodu</th>
                <th style="text-align:left;padding:8px 12px;color:#9ca3af;font-size:12px;font-weight:600">Ürün Adı</th>
                <th style="text-align:right;padding:8px 12px;color:#818cf8;font-size:12px;font-weight:600">Üretim</th>
                <th style="text-align:right;padding:8px 12px;color:#34d399;font-size:12px;font-weight:600">Paketleme</th>
                <th style="text-align:right;padding:8px 12px;color:#f59e0b;font-size:12px;font-weight:600">Fark</th>
                <th style="text-align:left;padding:8px 12px;color:#9ca3af;font-size:12px;font-weight:600">Durum</th>
              </tr>
            </thead>
            <tbody>
      `;

      rows.forEach((r, i) => {
        const fark  = r.uretim - r.paket;
        const farkStr = (fark > 0 ? '+' : '') + fark.toLocaleString('tr-TR');
        let farkColor = '#6b7280';
        let badge = '', badgeStyle = '';
        if (fark > 0)  { farkColor = '#f59e0b'; badge = 'Paket Eksik';   badgeStyle = 'background:#451a03;color:#fbbf24'; }
        else if (fark < 0) { farkColor = '#f87171'; badge = 'Paket Fazla'; badgeStyle = 'background:#450a0a;color:#fca5a5'; }
        else           { badge = 'Eşit';          badgeStyle = 'background:#052e16;color:#86efac'; }

        const rowBg = i % 2 === 0 ? '#111827' : '#0f172a';
        html += `
          <tr style="background:${rowBg};border-bottom:1px solid #1f2937" class="hover:bg-neutral-700">
            <td style="padding:8px 12px;font-family:monospace;font-size:12px;color:#6b7280">${escapeHtml(r.date || '-')}</td>
            <td style="padding:8px 12px;font-family:monospace;font-size:13px;color:#c7d2fe">${escapeHtml(r.productCode)}</td>
            <td style="padding:8px 12px;font-size:12px;color:#d1d5db;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escapeHtml(r.productName)}">${escapeHtml(r.productName || '-')}</td>
            <td style="padding:8px 12px;text-align:right;font-weight:600;color:#818cf8">${r.uretim > 0 ? r.uretim.toLocaleString('tr-TR') : '<span style="color:#6b7280">-</span>'}</td>
            <td style="padding:8px 12px;text-align:right;font-weight:600;color:#34d399">${r.paket > 0 ? r.paket.toLocaleString('tr-TR') : '<span style="color:#6b7280">-</span>'}</td>
            <td style="padding:8px 12px;text-align:right;font-weight:700;color:${farkColor}">${farkStr}</td>
            <td style="padding:8px 12px"><span style="padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600;${badgeStyle}">${escapeHtml(badge)}</span></td>
          </tr>
        `;
      });

      html += '</tbody></table></div>';
      tableWrap.innerHTML = html;

      // Kaydet
      try {
        localStorage.setItem('diffReport.lastFrom', from);
        localStorage.setItem('diffReport.lastTo', to);
      } catch(e) {}

    } catch (err) {
      console.error('uretim-paket-farki load error', err);
      tableWrap.innerHTML = `<div class="text-rose-400 text-sm p-3">Veri yüklenemedi: ${escapeHtml(err.message || String(err))}</div>`;
    }
  }

  container.querySelector('#diff-apply').addEventListener('click', load);
  fromInput.addEventListener('keydown', e => { if (e.key === 'Enter') load(); });
  toInput.addEventListener('keydown',   e => { if (e.key === 'Enter') load(); });

  await load();
}

export async function unmount(container) {
  try { container.innerHTML = ''; } catch(e) {}
}
