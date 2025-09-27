// Basit ve modüler tablo helper'ı
// Sadece CRUD, pagination, search işlevselliği

// Helper functions (eski helper'dan taşınan)
export function showToast(message, type = 'info') {
  try {
    const el = document.createElement('div');
    el.textContent = message;
    let bgClass = 'bg-neutral-700'; // default
    if (type === 'success') bgClass = 'bg-green-600';
    else if (type === 'error') bgClass = 'bg-rose-600';
    else if (type === 'warning') bgClass = 'bg-amber-600';
    
    el.className = `fixed bottom-6 right-6 px-4 py-2 rounded shadow z-50 ${bgClass}`;
    document.body.appendChild(el);
    setTimeout(() => {
      try { el.remove(); } catch(e) { /* element might be already removed */ }
    }, 4000);
  } catch (err) {
    console.error('showToast error:', err);
  }
}

export function showFormErrors(form, errors) {
  try {
    if (!form || !Array.isArray(errors)) return;
    clearFormErrors(form);
    
    errors.forEach(err => {
      if (!err.field || !err.msg) return;
      const field = form.querySelector(`[name="${err.field}"]`);
      if (!field) return;
      
      field.classList.add('border', 'border-rose-500');
      let note = field.parentElement.querySelector('.field-error');
      if (!note) {
        note = document.createElement('div');
        note.className = 'field-error text-rose-400 text-sm mt-1';
        field.parentElement.appendChild(note);
      }
      note.textContent = err.msg;
    });
  } catch (err) {
    console.error('showFormErrors error:', err);
  }
}

export function clearFormErrors(form) {
  try {
    if (!form) return;
    form.querySelectorAll('.field-error').forEach(n => n.remove());
    form.querySelectorAll('.border-rose-500').forEach(el => el.classList.remove('border', 'border-rose-500'));
  } catch (err) {
    console.error('clearFormErrors error:', err);
  }
}

export function createSimpleTable(config) {
  const {
    apiBaseUrl,
    endpoints, // { list, activate, deactivate, update }
    columns, // Array of column definitions
    searchFields = [],
    title = 'Data Table',
    emptyMessage = 'Kayıt bulunamadı',
    onDataLoaded = () => {},
    // Spesifik işlemler için callback'ler
    renderCell = (value, record, column) => value || '-', // Custom cell rendering
    createEditInput = (value, record, column) => `<input type="text" value="${value || ''}" class="w-full px-2 py-1 bg-neutral-700 rounded text-xs">`, // Custom edit input
    validateRowData = (data) => ({ isValid: true, errors: [] }),
    formatPayload = (data) => data // Transform data for API
  } = config;

  // Enable server-side search and server totals by default for consistency across tables
  config.enableServerSearch = config.enableServerSearch ?? true;
  config.useServerTotals = config.useServerTotals ?? true;

  // Parameter name mapping defaults
  const paramNames = config.paramNames || {
    page: 'pageNumber', // map internal 'page' to pageNumber
    pageSize: 'pageSize',
    startDate: 'startDate',
    endDate: 'endDate',
    searchTerm: 'searchTerm',
    status: 'status',
    sortField: 'sortField',
    sortDir: 'sortDir'
  };

  // whether the backend expects 0-based page indices (default: false -> 1-based)
  const pageIndexZeroBased = config.pageIndexZeroBased ?? false;

  // --- simple in-memory caches for lookups (shared per app)
  // operationsCache: { baseUrl: { fetchedAt: number, ttl: number, map: { id: name } } }
  if (!window.__operationsCache) window.__operationsCache = {};
  const operationsCache = window.__operationsCache;

  async function fetchOperationsOnce() {
    try {
      const cacheKey = apiBaseUrl || (window?.APP_CONFIG?.API?.BASE_URL) || 'default';
      const cacheEntry = operationsCache[cacheKey];
      const now = Date.now();
      const ttl = (window?.APP_CONFIG?.CACHE?.OPERATIONS_DURATION) ?? 5 * 60 * 1000;
      if (cacheEntry && (now - cacheEntry.fetchedAt) < ttl && cacheEntry.map) {
        return cacheEntry.map;
      }

      // build operations URL from config
      const opsEndpoint = (window?.APP_CONFIG?.API?.ENDPOINTS?.OPERATIONS) || '/Operations';
      const base = apiBaseUrl || (window?.APP_CONFIG?.API?.BASE_URL) || '';
      const url = base + opsEndpoint;
      const res = await fetch(url, { method: 'GET', headers: { 'Content-Type': 'application/json' } });
      if (!res.ok) {
        console.warn('Unable to fetch operations list for names:', res.status, res.statusText);
        return null;
      }
      const body = await res.json();
      // assume body is array of { id, name, shortCode }
      const arr = Array.isArray(body) ? body : (body?.data || body?.items || []);
      const map = {};
      arr.forEach(op => {
        if (op == null) return;
        const id = op.id ?? op.operationId ?? op.code ?? null;
        const name = op.name ?? op.operationName ?? op.displayName ?? op.shortCode ?? String(id);
        if (id != null) map[String(id)] = name;
      });

      operationsCache[cacheKey] = { fetchedAt: now, ttl, map };
      return map;
    } catch (e) {
      console.warn('fetchOperationsOnce error', e);
      return null;
    }
  }

  const container = document.createElement('div');
  let showInactive = false;
  let currentPage = 1;
  let pageSize = config.defaultPageSize ?? 20;
  let sortField = null;
  let sortDir = null; // 'asc' | 'desc'
  let allRecords = [];
  let lastServerTotal = null; // when backend returns totals
  let pageSizeInput, searchInput, showInactiveCheckbox, pager, debugInfo, tableContainer;
  // Column selection state for right-click drag selection
  let selectionActive = false;
  // preserve selection order for copy; use array and helper to keep unique
  let selectedColumns = [];
  let selectionStartField = null;

  // Keep references to global handlers for cleanup
  let _globalMouseUpHandler = null;
  let _globalKeyDownHandler = null;

  // Initialize UI components
  function initializeComponents() {
    container.innerHTML = '';

    // Row count selector
    const selectorWrap = document.createElement('div');
    selectorWrap.className = 'flex items-center gap-2 text-sm';
    selectorWrap.innerHTML = `
      <label>Sayfa başına:</label>
      <input list="pageSizeOptions" data-pagesize class="px-2 py-1 rounded bg-neutral-800 text-neutral-200 w-24" placeholder="20" />
      <datalist id="pageSizeOptions">
        <option value="5"></option>
        <option value="10"></option>
        <option value="20"></option>
        <option value="50"></option>
        <option value="100"></option>
        <option value="150"></option>
        <option value="200"></option>
      </datalist>
    `;
    pageSizeInput = selectorWrap.querySelector('input[data-pagesize]');
    const pageSizeDatalist = selectorWrap.querySelector('datalist');

  // Search input
    const searchWrap = document.createElement('div');
    searchWrap.className = 'ml-2';
  searchWrap.innerHTML = `<input type="search" placeholder="Tüm sütunlarda ara..." class="px-3 py-2 rounded bg-neutral-800 text-neutral-200" />`;
    searchInput = searchWrap.querySelector('input');

    // Top row: Controls
    const topRow = document.createElement('div');
    topRow.className = 'flex justify-between items-center mb-4';
    topRow.innerHTML = `<h3 class="text-lg font-semibold">${title}</h3>`;
    
    const controlsDiv = document.createElement('div');
    controlsDiv.className = 'flex items-center gap-2';
    
  // Loading spinner (hidden by default)
  const spinner = document.createElement('div');
  spinner.className = 'hidden items-center';
  spinner.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 animate-spin text-neutral-200" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-opacity="0.2" stroke-width="4"></circle><path d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" stroke-width="4" stroke-linecap="round"></path></svg>`;
  controlsDiv.appendChild(spinner);

  // Refresh button
    const refreshBtn = document.createElement('button');
    refreshBtn.className = 'px-3 py-2 rounded bg-blue-600 hover:bg-blue-500 text-sm text-white';
    refreshBtn.innerHTML = '🔄 Yenile';
    refreshBtn.title = 'Tabloyu backend\'den yeniden yükle';
    controlsDiv.appendChild(refreshBtn);

  // CSV export button
  const exportBtn = document.createElement('button');
  exportBtn.className = 'px-3 py-2 rounded bg-green-600 hover:bg-green-500 text-sm text-white';
  exportBtn.innerHTML = 'CSV Dışarı Aktar';
  exportBtn.title = 'Görüntülenen veriyi CSV olarak indir';
  controlsDiv.appendChild(exportBtn);
    
    controlsDiv.appendChild(selectorWrap);
    controlsDiv.appendChild(searchWrap);
    topRow.appendChild(controlsDiv);

    // Filter toggle for active/inactive records - tabloda ara'nın altında
    const filterWrap = document.createElement('div');
    filterWrap.className = 'mb-4 ml-auto max-w-xs';
    filterWrap.innerHTML = `
      <label class="flex items-center gap-2 text-sm text-neutral-300">
        <input type="checkbox" id="show-inactive" ${showInactive ? 'checked' : ''} class="rounded"/>
        Pasif kayıtları da göster
      </label>
    `;
    showInactiveCheckbox = filterWrap.querySelector('#show-inactive');

    // Table container
    tableContainer = document.createElement('div');
    tableContainer.className = 'overflow-x-auto';

    // Pagination
    pager = document.createElement('div');
    pager.className = 'flex justify-between items-center mt-4 text-sm text-neutral-400';

    // Debug info
    debugInfo = document.createElement('div');
    debugInfo.className = 'mt-2 text-xs text-neutral-500';

  // Assemble (place debugInfo above the table so counts appear above)
  container.appendChild(topRow);
  container.appendChild(filterWrap);
  container.appendChild(debugInfo);
  container.appendChild(tableContainer);
  container.appendChild(pager);

    // Event listeners
    // Load persisted pageSize when available
    try {
      const saved = parseInt(localStorage.getItem('simpleTable.pageSize'));
      if (!isNaN(saved) && saved > 0) {
        pageSize = saved;
        pageSizeInput.value = String(pageSize);
      }
    } catch (e) { /* ignore storage errors */ }

    function applyPageSizeFromInput() {
      const v = parseInt(pageSizeInput.value);
      if (!isNaN(v) && v > 0) {
        pageSize = v;
        try { localStorage.setItem('simpleTable.pageSize', String(pageSize)); } catch(e) {}
        currentPage = 1;
        renderTable();
        showToast(`Sayfa başına ${v} kayıt olarak ayarlandı`, 'success');
      } else {
        showToast('Geçersiz sayfa sayısı', 'error');
      }
    }

    pageSizeInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') applyPageSizeFromInput();
    });
    pageSizeInput.addEventListener('change', applyPageSizeFromInput);

    // debounce helper for cleaner UX
    function debounce(fn, wait = 200) {
      let t = null;
      return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), wait); };
    }

    searchInput.addEventListener('input', debounce(() => {
      currentPage = 1;
      const val = (searchInput.value || '').trim();
      if (config.enableServerSearch) {
        // forward to server (server should accept searchTerm)
        loadData({ page: 1, pageSize, searchTerm: val });
      } else {
        renderTable();
      }
    }, 250));

    showInactiveCheckbox.addEventListener('change', (e) => {
      showInactive = e.target.checked;
      console.log('📊 Show inactive changed:', showInactive);
      loadData(); // Yeni API isteği at
    });
    
    // Refresh button
    refreshBtn.addEventListener('click', async () => {
      console.log('🔄 Manual table refresh requested');
      await loadData();
      showToast('Tablo yenilendi', 'success');
    });
    // CSV export handler
    exportBtn.addEventListener('click', () => {
      try {
        exportCsv();
      } catch (err) {
        console.error('CSV export error', err);
        showToast('CSV dışarı aktarılırken hata oluştu', 'error');
      }
    });
  }

  function setLoading(loading) {
    try {
      const sp = container.querySelector('div svg.animate-spin')?.parentElement;
      if (!sp) return;
      if (loading) sp.classList.remove('hidden'); else sp.classList.add('hidden');
    } catch (e) { /* ignore */ }
  }

  // CSV export: exports current filtered data (all filtered rows, not just current page)
  function escapeCsvCell(v) {
    if (v == null) return '';
    let s = '';
    if (typeof v === 'object') {
      try { s = JSON.stringify(v); } catch(e) { s = String(v); }
    } else {
      s = String(v);
    }
    // escape double quotes by doubling
    s = s.replace(/"/g, '""');
    // wrap in quotes
    return `"${s}"`;
  }

  function exportCsv() {
    const filtered = getFilteredData();
    if (!filtered || !filtered.length) {
      showToast('Dışarı aktarılacak veri yok', 'warning');
      return;
    }

    // Headers from columns
    const headers = columns.map(c => c.header || c.title || c.field || '');
    const rows = [headers.map(h => escapeCsvCell(h)).join(',')];

    filtered.forEach(rec => {
      const cells = columns.map(col => {
        const v = rec[col.field];
        return escapeCsvCell(v);
      });
      rows.push(cells.join(','));
    });

    const csvContent = '\uFEFF' + rows.join('\r\n'); // BOM + CRLF
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const now = new Date();
    const dateStr = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}_${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}`;
    const fname = `${(title || 'export').replace(/\s+/g,'_')}_${dateStr}.csv`;
    a.href = url;
    a.download = fname;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showToast('CSV indirildi: ' + fname, 'success');
  }

  // Load data from API
  // loadData accepts optional params override: { page, pageSize, startDate, endDate, sortField, sortDir }
  async function loadData(params = {}) {
    try {
      // show spinner for server operations
      setLoading(true);
      // API URL'ye status parametresi ekle
      const statusParam = showInactive ? 'all' : 'active';


      // merge params with defaults
  const page = params.page ?? currentPage;
  const pSize = params.pageSize ?? pageSize;
  const startDate = params.startDate ?? params.from ?? null;
  const endDate = params.endDate ?? params.to ?? null;
  const sField = params.sortField ?? sortField;
  const sDir = params.sortDir ?? sortDir;

      // build URL: allow custom builder if provided
      let url = null;
      if (typeof config.buildListUrl === 'function') {
        url = config.buildListUrl({ apiBaseUrl, endpoints, status: statusParam, page, pageSize: pSize, startDate, endDate, sortField: sField, sortDir: sDir, params });
      } else {
        const qp = new URLSearchParams();
        // use mapped param names by default (pageNumber/pageSize/searchTerm/status)
  // Always include status (active by default) and include page/pageSize even if zero
  qp.set(paramNames.status || 'status', statusParam);
  if (page !== undefined && page !== null) {
    const pageToSend = pageIndexZeroBased ? Math.max(0, Number(page) - 1) : page;
    qp.set(paramNames.page || 'pageNumber', String(pageToSend));
  }
  if (pSize !== undefined && pSize !== null) qp.set(paramNames.pageSize || 'pageSize', String(pSize));
  if (startDate !== undefined && startDate !== null) qp.set(paramNames.startDate || 'startDate', startDate);
  if (endDate !== undefined && endDate !== null) qp.set(paramNames.endDate || 'endDate', endDate);
  if (sField !== undefined && sField !== null) qp.set(paramNames.sortField || 'sortField', sField);
  if (sDir !== undefined && sDir !== null) qp.set(paramNames.sortDir || 'sortDir', sDir);

        // include explicit searchTerm if supplied
        if (params.searchTerm) qp.set(paramNames.searchTerm || 'searchTerm', params.searchTerm);

        // Include any additional custom params passed in (user can pass arbitrary keys)
        Object.keys(params || {}).forEach(k => {
          if (['page','pageSize','startDate','endDate','sortField','sortDir','searchTerm'].includes(k)) return;
          const v = params[k];
          if (v != null) qp.set(k, String(v));
        });

        url = `${apiBaseUrl}${endpoints.list}${qp.toString() ? '?' + qp.toString() : ''}`;
      }

      console.log('📡 Loading data from:', url, '(Show inactive:', showInactive, ')');

        const response = await fetch(url, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' }
        });

      if (!response.ok) {
        // Try to extract server-provided error details (JSON or plain text)
        let serverDetail = '';
        try {
          const ct = response.headers.get('content-type') || '';
          if (ct.includes('application/json')) {
            const body = await response.json();
            serverDetail = JSON.stringify(body);
          } else {
            serverDetail = await response.text();
          }
        } catch (e) {
          serverDetail = `unable to read response body: ${e.message}`;
        }
        const errMsg = `HTTP ${response.status} ${response.statusText}${serverDetail ? ' - ' + serverDetail : ''}`;
        console.error('API non-OK response body:', serverDetail);
        throw new Error(errMsg);
      }

      const result = await response.json();
      // support paged response shape: { success, message, data: { items: [...], totalCount, pageNumber, pageSize } }
      let records = [];
      try {
        if (result && result.data && Array.isArray(result.data.items)) {
          records = result.data.items;
          lastServerTotal = Number(result.data.totalCount ?? result.data.total ?? result.data.count ?? NaN);
          if (typeof result.data.pageNumber === 'number') {
            currentPage = pageIndexZeroBased ? (Number(result.data.pageNumber) + 1) : Number(result.data.pageNumber);
          }
        } else if (Array.isArray(result)) {
          records = result;
          lastServerTotal = null;
        } else if (result?.items && Array.isArray(result.items)) {
          records = result.items;
          lastServerTotal = Number(result.total ?? result.totalCount ?? result.count ?? NaN);
        } else if (result?.data && Array.isArray(result.data)) {
          records = result.data;
          lastServerTotal = null;
        } else {
          console.warn('Unexpected API response format:', result);
          records = [];
          lastServerTotal = null;
        }
      } catch (e) {
        console.warn('Error parsing API response shape', e);
        records = [];
        lastServerTotal = null;
      }
      
  allRecords = records;
      // If records contain operation ids but not names, try to enrich them from operations cache
      (async () => {
        try {
          const needMap = allRecords.some(r => r && r.operation && !r.operationName && !r.operationDisplay);
          if (!needMap) return;
          const opMap = await fetchOperationsOnce();
          if (!opMap) return;
          allRecords.forEach(r => {
            if (!r) return;
            if (r.operation && !r.operationName && !r.operationDisplay) {
              const key = String(r.operation);
              if (opMap[key]) r.operationName = opMap[key];
            }
          });
          // re-render to show updated names
          renderTable();
        } catch (e) { console.warn('Operation name enrichment failed', e); }
      })();

      console.log('✅ Data loaded:', allRecords.length, 'records');
    onDataLoaded(allRecords);
    renderTable();

  } catch (err) {
      console.error('❌ LOAD DATA ERROR:', err);
      
      // Hata tipine göre özel mesajlar
      let errorMessage = 'Veri yüklenirken hata oluştu';
      let troubleshooting = '';
      
      if (err.message.includes('Failed to fetch') || err.name === 'TypeError') {
        errorMessage = 'Backend sunucusuna bağlanılamıyor';
        troubleshooting = '🔧 Kontrol edin: Backend server çalışıyor mu? (localhost:7287)';
      } else if (err.message.includes('ERR_EMPTY_RESPONSE')) {
        errorMessage = 'Sunucu boş yanıt döndürdü';
        troubleshooting = '🔧 Kontrol edin: API endpoint\'i doğru mu?';
      } else if (err.message.includes('CORS')) {
        errorMessage = 'CORS hatası';
        troubleshooting = '🔧 Kontrol edin: Backend CORS ayarları';
      }
      
      console.error('🚨 ERROR TYPE:', err.name);
      console.error('📝 ERROR MESSAGE:', err.message);
      console.error('🔧 TROUBLESHOOTING:', troubleshooting);
      
      tableContainer.innerHTML = `
        <div class="text-center py-8">
          <div class="text-rose-400 mb-2">${errorMessage}</div>
          <div class="text-neutral-500 text-sm">${err.message}</div>
          ${troubleshooting ? `<div class="text-yellow-400 text-sm mt-2">${troubleshooting}</div>` : ''}
        </div>
      `;
    }
    finally {
      // hide spinner
      setLoading(false);
    }
  }

  // Filter and search data
  function getFilteredData() {
    let filtered = allRecords;

    // API'den zaten doğru status ile veri geliyor, sadece search filtresi uygula
    const searchTerm = searchInput?.value?.toLowerCase() || '';
    if (searchTerm) {
      // If user didn't specify searchFields, search all visible columns
      const fieldsToSearch = (Array.isArray(searchFields) && searchFields.length) ? searchFields : columns.map(c => c.field).filter(Boolean);
      filtered = filtered.filter(record => {
        return fieldsToSearch.some(field => {
          // support nested properties like 'product.name'
          const parts = String(field).split('.');
          let value = record;
          for (let p of parts) {
            if (value == null) break;
            value = value[p];
          }
          if (value == null) return false;
          try {
            return String(value).toLowerCase().includes(searchTerm);
          } catch (e) { return false; }
        });
      });
    }

    return filtered;
  }

  // Apply client-side sorting if requested
  function applySorting(records) {
    if (!sortField) return records;
    const dir = sortDir === 'desc' ? -1 : 1;
    const sorted = Array.from(records).sort((a,b) => {
      const va = a[sortField];
      const vb = b[sortField];
      if (va == null && vb == null) return 0;
      if (va == null) return -1 * dir;
      if (vb == null) return 1 * dir;
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir;
      return String(va).localeCompare(String(vb), undefined, { numeric: true }) * dir;
    });
    return sorted;
  }

  // Render table
  function renderTable() {
  let filteredData = getFilteredData();
  // client-side sort
  filteredData = applySorting(filteredData);
  const totalItems = (config.useServerTotals && typeof lastServerTotal === 'number') ? lastServerTotal : filteredData.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = Math.min(startIndex + pageSize, totalItems);
    const pageData = filteredData.slice(startIndex, endIndex);

    // Table HTML
    let tableHTML = `
      <table class="w-full bg-neutral-800 rounded-lg overflow-hidden">
        <thead class="bg-neutral-700">
          <tr>
    `;

    columns.forEach(col => {
      const headerText = col.title || col.header || col.field || 'N/A';
      const sortable = col.sortable === false ? false : true;
      // Show indicator only when sorting is active on this field
      const sortIndicator = (sortable && sortField && sortField === col.field) ? (sortDir === 'desc' ? ' ▼' : ' ▲') : '';
      const headerClass = `px-4 py-3 text-left text-xs font-bold text-neutral-300 uppercase tracking-wider ${col.className || ''}`;
      tableHTML += `<th class="${headerClass}" data-sortable="${sortable ? '1' : '0'}" data-field="${col.field}">${headerText}${sortIndicator}</th>`;
    });

    tableHTML += `
          </tr>
        </thead>
        <tbody class="divide-y divide-neutral-700">
    `;

    if (pageData.length === 0) {
      // show empty message spanning all columns
      tableHTML += `<tr><td class="px-4 py-8 text-center text-sm text-neutral-400" colspan="${columns.length}">${emptyMessage}</td></tr>`;
    } else {
      pageData.forEach(record => {
        const isActive = record.isActive !== false;
        tableHTML += `
          <tr class="hover:bg-neutral-700/50 ${!isActive ? 'opacity-60' : ''}">`;

        columns.forEach(col => {
          const value = record[col.field];
          let cellHtml = '';
          try { cellHtml = renderCell(value, record, col) || ''; } catch(e) { cellHtml = String(value ?? '-'); }
          const cellClass = `px-4 py-3 text-sm ${col.className || ''}`;
          tableHTML += `<td class="${cellClass}" data-field="${col.field}" data-record-id="${record.id}">${cellHtml}</td>`;
        });

        tableHTML += '</tr>';
      });
    }

    tableHTML += `
        </tbody>
      </table>
    `;

    tableContainer.innerHTML = tableHTML;
    const tableEl = tableContainer.querySelector('table');
    if (tableEl) tableEl.setAttribute('data-table', 'true');
    // Expose container attributes for header click handlers
    container.setAttribute('data-container', 'true');

    // Attach header click listeners for sorting
    const headerCells = tableEl ? tableEl.querySelectorAll('th[data-field]') : [];
    headerCells.forEach(h => {
      const field = h.getAttribute('data-field');
      const sortable = h.getAttribute('data-sortable') === '1';
      if (!sortable) return;
      h.style.cursor = 'pointer';
      // implement 3-state cycle: none -> asc -> desc -> none
      h.addEventListener('click', () => {
        if (sortField !== field) {
          // start new sort cycle on this field
          sortField = field;
          sortDir = 'asc';
        } else {
          // same field clicked, cycle the direction: asc -> desc -> none
          if (sortDir === 'asc') {
            sortDir = 'desc';
          } else if (sortDir === 'desc') {
            // third touch: clear sorting
            sortField = null;
            sortDir = null;
          } else {
            // was none for some reason, start asc
            sortDir = 'asc';
          }
        }

        // server-side sort: if no sorting set, request without sort params to clear server-side ordering
        const reloadParams = { page: currentPage, pageSize };
        if (sortField && sortDir) {
          reloadParams.sortField = sortField;
          reloadParams.sortDir = sortDir;
        }

        loadData(reloadParams);
      });
    });

    // RIGHT-CLICK DRAG COLUMN SELECTION
    // Prevent native context menu on table to allow right-click selection
  tableEl.addEventListener('contextmenu', (e) => { e.preventDefault(); });

    function clearSelection() {
      selectedColumns = [];
      selectionActive = false;
      selectionStartField = null;
      // remove highlight class
      tableEl.querySelectorAll('th[data-field], td[data-field]').forEach(el => el.classList.remove('selected-col'));
    }

    function highlightSelectedColumns() {
      // clear first
      tableEl.querySelectorAll('th[data-field], td[data-field]').forEach(el => el.classList.remove('selected-col'));
      if (!selectedColumns.length) return;
      tableEl.querySelectorAll('th[data-field]').forEach(th => {
        const f = th.getAttribute('data-field');
        if (selectedColumns.includes(f)) th.classList.add('selected-col');
      });
      tableEl.querySelectorAll('td[data-field]').forEach(td => {
        const f = td.getAttribute('data-field');
        if (selectedColumns.includes(f)) td.classList.add('selected-col');
      });
    }

    // delegate mousedown to start selection when right button pressed
    tableEl.addEventListener('mousedown', (e) => {
      if (e.button !== 2) return; // only right click
      const cell = e.target.closest('[data-field]');
      if (!cell) return;
      e.preventDefault();
  selectionActive = true;
  const field = cell.getAttribute('data-field');
  selectionStartField = field;
  // start with current field (preserve order, avoid duplicates)
  if (!selectedColumns.includes(field)) selectedColumns.push(field);
      highlightSelectedColumns();
      showToast('Sütun seçimi: sağ tıklamayı bırak ve başka sütunların üzerinde gezerek seçimi genişlet. Kopyalamak için Ctrl+C tuşuna basın.', 'info');
    });

    // when moving over cells while right button held, add column
    tableEl.addEventListener('mouseenter', (e) => {
      // noop for delegation - we'll rely on mouseover below
    }, true);

    tableEl.addEventListener('mouseover', (e) => {
      if (!selectionActive) return;
      const cell = e.target.closest('[data-field]');
      if (!cell) return;
      const field = cell.getAttribute('data-field');
      if (!selectedColumns.includes(field)) {
        selectedColumns.push(field);
        highlightSelectedColumns();
      }
    });
    // end selection on mouseup anywhere
    _globalMouseUpHandler = (e) => {
      if (selectionActive && e.button === 2) {
        // right button released
        selectionActive = false;
        // show toast with count and hint
        const cols = selectedColumns.length;
        showToast(`${cols} sütun seçildi. Kopyalamak için Ctrl+C (Cmd+C) kullanın. Seçimi iptal etmek için ESC.` , 'success');
      }
    };
    window.addEventListener('mouseup', _globalMouseUpHandler);

    // keyboard handlers: copy on Ctrl/Cmd+C, cancel on Escape
    function handleKeyDown(e) {
      if (selectedColumns.size === 0) return;
      const key = e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && key === 'c') {
        // build clipboard content and copy
        copySelectedColumnsToClipboard().then(() => {
          showToast('Seçili sütunlar panoya kopyalandı', 'success');
        }).catch(err => {
          console.error('Copy error', err);
          showToast('Kopyalama başarısız', 'error');
        });
        e.preventDefault();
      } else if (key === 'escape') {
        clearSelection();
        showToast('Sütun seçimi iptal edildi', 'info');
      }
    }
  _globalKeyDownHandler = handleKeyDown;
  window.addEventListener('keydown', _globalKeyDownHandler);

    async function copySelectedColumnsToClipboard() {
  const fields = Array.from(selectedColumns);
      if (!fields.length) return;
      const filtered = getFilteredData();
      // header row
      const headerRow = fields.map(f => {
        const col = columns.find(c => c.field === f);
        return col ? (col.header || col.title || col.field) : f;
      }).map(v => String(v)).join('\t');
      const lines = [headerRow];
      filtered.forEach(r => {
        const row = fields.map(f => {
          const v = r[f];
          return v == null ? '' : String(v);
        }).join('\t');
        lines.push(row);
      });
      const text = lines.join('\r\n');
      if (navigator.clipboard && navigator.clipboard.writeText) {
        return navigator.clipboard.writeText(text);
      } else {
        // fallback
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
        return Promise.resolve();
      }
    }

    // Attach methods to table for page navigation
  updatePagination(currentPage, totalPages, startIndex + 1, endIndex, totalItems);
  }

  // Update pagination display
  function updatePagination(current, total, start, end, totalItems) {
    const prevDisabled = current <= 1 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-neutral-700 cursor-pointer';
    const nextDisabled = current >= total ? 'opacity-50 cursor-not-allowed' : 'hover:bg-neutral-700 cursor-pointer';

    // Show page/total info above the table in debugInfo
    debugInfo.innerHTML = `Sayfa ${current} / ${total} (Toplam ${totalItems} kayıt)`;

    // Pager now only contains navigation buttons
    pager.innerHTML = `
      <div class="flex gap-2">
        <button class="px-3 py-1 rounded bg-neutral-700 ${prevDisabled}" ${current > 1 ? `onclick="this.closest('[data-container]').prevPage()"` : ''}>Önceki</button>
        <button class="px-3 py-1 rounded bg-neutral-700 ${nextDisabled}" ${current < total ? `onclick="this.closest('[data-container]').nextPage()"` : ''}>Sonraki</button>
      </div>
    `;

    container.prevPage = () => { if (currentPage > 1) { currentPage--; renderTable(); } };
    container.nextPage = () => { if (currentPage < total) { currentPage++; renderTable(); } };
  }

  // Read-only mode: editing and toggle controls are suppressed

  // Operasyon dropdown'u için fallback yükleme fonksiyonu
  // Public API
  container.init = async () => {
    initializeComponents();
    await loadData();
  };

  // reload can accept params: { page, pageSize, startDate, endDate, sortField, sortDir }
  container.reload = (params = {}) => loadData(params);
  
  // Yeni kayıt ekleme (backend'e istek atmadan)
  container.addRecord = (newRecord) => {
    if (!newRecord || !newRecord.id) {
      console.warn('⚠️ Invalid record for adding:', newRecord);
      return;
    }
    
    // Aktif kayıtları gösteriyorsak ve kayıt aktifse ekle
    if (!showInactive && newRecord.isActive === false) {
      console.log('📝 Record is inactive, not adding to active view');
      return;
    }
    
    // Kayıt zaten var mı kontrol et
    const existingIndex = allRecords.findIndex(r => r.id == newRecord.id);
    if (existingIndex !== -1) {
      console.log('📝 Record already exists, updating:', newRecord.id);
      allRecords[existingIndex] = newRecord;
    } else {
      console.log('📝 Adding new record:', newRecord.id);
      allRecords.unshift(newRecord); // En başa ekle
    }
    
    // Tabloyu yeniden render et
    renderTable();
  };

  // Unmount / cleanup: remove global listeners and clear container
  container.unmount = () => {
    try {
      if (_globalMouseUpHandler) window.removeEventListener('mouseup', _globalMouseUpHandler);
      if (_globalKeyDownHandler) window.removeEventListener('keydown', _globalKeyDownHandler);
    } catch (e) { /* ignore */ }
    try { container.innerHTML = ''; } catch (e) {}
  };

  // Guarded write-affordances: if APP_CONFIG.READ_ONLY is set, provide no-op implementations
  try {
    const cfgApp = (typeof APP_CONFIG !== 'undefined') ? APP_CONFIG : (window?.APP_CONFIG || null);
    if (cfgApp && cfgApp.READ_ONLY) {
      // Provide friendly no-op methods used by table modules
      container.createRecordOnServer = async () => {
        console.warn('createRecordOnServer called but APP_CONFIG.READ_ONLY is true. Suppressing network write.');
        try { showToast('Oluşturma devre dışı: Rapor modu etkin.', 'warning'); } catch(e){}
        return null;
      };
      container.updateRecordOnServer = async () => {
        console.warn('updateRecordOnServer called but APP_CONFIG.READ_ONLY is true. Suppressing network write.');
        try { showToast('Güncelleme devre dışı: Rapor modu etkin.', 'warning'); } catch(e){}
        return false;
      };
      container.deleteRecordOnServer = async () => {
        console.warn('deleteRecordOnServer called but APP_CONFIG.READ_ONLY is true. Suppressing network write.');
        try { showToast('Silme devre dışı: Rapor modu etkin.', 'warning'); } catch(e){}
        return false;
      };
    }
  } catch (e) {
    // ignore config read errors
  }

  return container;
}