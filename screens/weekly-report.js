import ApiClient from '../ui/core/api-client.js';
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
  setHeader('Haftalık Rapor', 'Haftalık üretim trendleri');
    container.innerHTML = `
      <div class="p-4">
        <h3 class="text-lg font-semibold mb-2">Haftalık Rapor</h3>
        <p class="text-sm text-neutral-400 mb-4">Haftalık üretim trendleri.</p>

        <div class="flex gap-2 items-center mb-3">
          <div>
            <button id="weekly-today" class="px-2 py-1 bg-neutral-700 rounded text-sm">Today</button>
            <button id="weekly-7days" class="px-2 py-1 bg-neutral-700 rounded text-sm">Last 7 days</button>
            <button id="weekly-month" class="px-2 py-1 bg-neutral-700 rounded text-sm">This month</button>
          </div>
        </div>

        <div id="weekly-table-container" class="bg-neutral-800 p-2 rounded"></div>
      </div>
    `;

    const tableContainer = container.querySelector('#weekly-table-container');

    const table = createSimpleTable({
      apiBaseUrl: APP_CONFIG.API.BASE_URL,
      endpoints: { list: (APP_CONFIG.API.ENDPOINTS.PRODUCTION || '/uretim') + '/paged' },
      columns: [
        { field: 'date', header: 'Tarih', className: 'text-xs', sortable: true },
        { field: 'productCode', header: 'Ürün Kodu', className: 'font-mono', sortable: true },
        { field: 'productName', header: 'Ürün Adı', sortable: true },
        { field: 'quantity', header: 'Adet', className: 'text-right', sortable: true }
      ],
      title: 'Haftalık Üretim'
    });

    tableContainer.appendChild(table);
    await table.init();

    function applyRange(startDate, endDate) { table.reload({ page: 1, pageSize: 20, startDate, endDate }); }

    container.querySelector('#weekly-today').addEventListener('click', () => { const d = new Date(); const iso = d.toISOString().slice(0,10); applyRange(iso, iso); });
    container.querySelector('#weekly-7days').addEventListener('click', () => { const to = new Date(); const from = new Date(); from.setDate(to.getDate()-6); applyRange(from.toISOString().slice(0,10), to.toISOString().slice(0,10)); });
    container.querySelector('#weekly-month').addEventListener('click', () => { const to = new Date(); const from = new Date(to.getFullYear(), to.getMonth(), 1); applyRange(from.toISOString().slice(0,10), to.toISOString().slice(0,10)); });

  const api = new ApiClient(APP_CONFIG.API.BASE_URL);
  const containerEl = container.querySelector('#weekly-report-container');
  const fromInput = container.querySelector('#weekly-from');
  const toInput = container.querySelector('#weekly-to');
  const pageSizeInput = container.querySelector('#weekly-page-size');
  const pageInfo = container.querySelector('#weekly-page-info');
  let currentPage = 1;

  function buildQuery({ page, pageSize, from, to }) {
    const params = new URLSearchParams();
    if (page) params.set('page', String(page));
    if (pageSize) params.set('pageSize', String(pageSize));
    if (from) params.set('startDate', from);
    if (to) params.set('endDate', to);
    return params.toString() ? `?${params.toString()}` : '';
  }

  async function loadPage(page = 1) {
    containerEl.innerHTML = 'Yükleniyor...';
    const pageSize = Number(pageSizeInput.value || 20);
    const from = fromInput.value || null;
    const to = toInput.value || null;
    const endpoint = (APP_CONFIG.API.ENDPOINTS.PRODUCTION || '/uretim') + buildQuery({ page, pageSize, from, to });
    try {
      const res = await api.get(endpoint);
      if (!res.success) throw new Error(res.error || 'API hata');
      const raw = res.data || [];
      const data = Array.isArray(raw) ? raw : (raw && raw.items) ? raw.items : [];

      if (!data.length) {
        containerEl.innerHTML = `<div class="text-sm text-neutral-400">Kayıt bulunamadı.</div>`;
        pageInfo.textContent = `Sayfa ${page}`;
        return;
      }

      const rows = data.slice(0, 100).map(it => {
        const id = it.id || it.ID || '';
        const d = it.date || it.createdAt || it.tarih || '';
        const info = it.summary || it.description || JSON.stringify(it);
        return `<div class="p-2 border-b border-neutral-700"><strong>${escapeHtml(String(d))}</strong> - ${escapeHtml(String(info).slice(0,200))}</div>`;
      }).join('');

      containerEl.innerHTML = `<div class="divide-y">${rows}</div>`;
      pageInfo.textContent = `Sayfa ${page}`;
    } catch (err) {
      console.error('weekly-report load error', err);
      containerEl.innerHTML = `<div class="text-rose-400">Veri yüklenemedi: ${escapeHtml(err.message || String(err))}</div>`;
    }
  }

  container.querySelector('#weekly-refresh').addEventListener('click', () => { currentPage = 1; loadPage(1); });
  container.querySelector('#weekly-prev').addEventListener('click', () => { if (currentPage > 1) { currentPage--; loadPage(currentPage); } });
  container.querySelector('#weekly-next').addEventListener('click', () => { currentPage++; loadPage(currentPage); });

  await loadPage(1);
}

export async function unmount(container) {
  try { const el = container.querySelector('#weekly-report-container'); if (el) el.innerHTML = ''; } catch(e){}
  try { container.innerHTML = ''; } catch(e){}
}
