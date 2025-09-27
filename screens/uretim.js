import { showToast, showFormErrors, clearFormErrors } from '../ui/helpers.js';
import { createUretimTable } from '../ui/tables/uretim-table.js';
import { APP_CONFIG } from '../config/app-config.js';
import ApiClient from '../ui/core/api-client.js';

let _cleanup = null;

export async function mount(container, { setHeader }) {
  setHeader('Üretim', 'Günlük üretim verileri');
  container.innerHTML = `
    <div class="mt-2">
      <div class="mt-6 bg-neutral-800 p-4 rounded">
        <h4 class="text-lg font-medium mb-3">Üretim Listesi (Rapor Modu)</h4>
        <div id="uretim-controls" class="mb-3"></div>
        <div id="uretim-table-container" class="overflow-auto"></div>
      </div>
    </div>
  `;

  function setDefaultDate() {
    const dateInput = container.querySelector('[name="tarih"]');
    if (dateInput && !dateInput.value) {
      const today = new Date();
      dateInput.value = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
    }
  }
  setDefaultDate();

  // Initialize the production table and mount it
  const tableContainer = container.querySelector('#uretim-table-container');
  const uretimTable = createUretimTable(APP_CONFIG.API.BASE_URL);
  await uretimTable.init();
  tableContainer.appendChild(uretimTable);

  // Controls area reserved for future report filters (report-only mode hides interactive selects)
  // Helper: compute average 'second' from CycleTimes for a product (optionally by operation)
  async function getCycleTimeSuggestion(productId, operationId) {
    try {
      if (!productId) return null;
      // Try efficient filtered endpoint first
      let resp;
      try {
        // ensure apiClient exists
        const apiClient = new ApiClient(APP_CONFIG.API.BASE_URL);
        const q = operationId ? `/CycleTimes?productId=${encodeURIComponent(productId)}&operationId=${encodeURIComponent(operationId)}` : `/CycleTimes?productId=${encodeURIComponent(productId)}`;
        resp = await apiClient.get(q);
      } catch (e) {
        console.warn('Filtered CycleTimes query failed, falling back to full list:', e.message || e);
        const apiClient = new ApiClient(APP_CONFIG.API.BASE_URL);
        resp = await apiClient.get('/CycleTimes');
      }

      if (!resp || !resp.success) {
        return null;
      }

      const all = Array.isArray(resp.data) ? resp.data : (resp.data?.data || []);
      const filtered = all.filter(r => {
        const matchesProduct = (r.productId != null && String(r.productId) == String(productId)) || (r.productId == null && (r.productCode && false));
        if (!matchesProduct) return false;
        if (operationId) return String(r.operationId) === String(operationId);
        return true;
      }).filter(r => r.second != null && !isNaN(Number(r.second)));

      if (!filtered.length) return null;

      const sum = filtered.reduce((s, r) => s + Number(r.second), 0);
      const avg = Math.round(sum / filtered.length);
      return avg;
    } catch (err) {
      console.error('getCycleTimeSuggestion error', err);
      return null;
    }
  }

  // In report-only mode we intentionally hide lookup controls; operations mapping is handled centrally in the table helper.

  // No form or submission handlers in report-only client

  _cleanup = () => {
    try { const tc = container.querySelector('#uretim-table-container'); if (tc) tc.innerHTML = ''; } catch(e){}
    try { container.innerHTML = ''; } catch(e){}
    _cleanup = null;
  };
}

export async function unmount(container) {
  if (_cleanup) _cleanup();
}
