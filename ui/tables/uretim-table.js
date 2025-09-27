import { createSimpleTable, showToast } from '../simple-table.js';

// Üretim tablosu konfigürasyonu
export function createUretimTable(apiBaseUrl) {
  const cfg = {
    apiBaseUrl,
    endpoints: {
      // Use paged endpoint for listing
      list: '/ProductionTrackingForms/paged',
      // use create for POSTs
      create: '/ProductionTrackingForms',
      activate: '/ProductionTrackingForms/{id}/activate',
      deactivate: '/ProductionTrackingForms/{id}/deactivate',
      update: '/ProductionTrackingForms/{id}'
    },
    columns: [
      { field: 'date', header: 'Tarih', className: 'text-xs', editable: true },
      { field: 'shift', header: 'Vardiya', editable: true },
      { field: 'shiftSupervisor', header: 'Vardiya Sorum.', editable: true },
      { field: 'productCode', header: 'Ürün Kodu', className: 'font-mono', editable: true },
      { field: 'productName', header: 'Ürün Adı', editable: false },
      { field: 'operation', header: 'Operasyon', editable: true },
      { field: 'quantity', header: 'Adet', className: 'text-right', editable: true },
      { field: 'cycleTime', header: 'Çevrim (sn)', className: 'text-xs text-neutral-400', editable: true },
      { field: 'addedDateTime', header: 'Eklenme', className: 'text-neutral-400 text-xs', editable: false }
    ],
    searchFields: ['productCode', 'productName', 'shift', 'operation', 'shiftSupervisor'],
    title: 'Üretim Takip Formları',
    apiBaseUrl,
    endpoints: {
      // Use paged endpoint for listing (duplicate section kept in sync)
      list: '/ProductionTrackingForms/paged',
      create: '/ProductionTrackingForms',
      activate: '/ProductionTrackingForms/{id}/activate',
      deactivate: '/ProductionTrackingForms/{id}/deactivate',
      update: '/ProductionTrackingForms/{id}'
    },
    columns: [
      { field: 'date', header: 'Tarih', className: 'text-xs', editable: true },
      { field: 'shift', header: 'Vardiya', editable: true },
      { field: 'shiftSupervisor', header: 'Vardiya Sorum.', editable: true },
      { field: 'productCode', header: 'Ürün Kodu', className: 'font-mono', editable: true },
      { field: 'productName', header: 'Ürün Adı', editable: false },
      { field: 'operation', header: 'Operasyon', editable: true },
      { field: 'quantity', header: 'Adet', className: 'text-right', editable: true },
      { field: 'cycleTime', header: 'Çevrim (sn)', className: 'text-xs text-neutral-400', editable: true },
      { field: 'addedDateTime', header: 'Eklenme', className: 'text-neutral-400 text-xs', editable: false }
    ],
    searchFields: ['productCode', 'productName', 'shift', 'operation', 'shiftSupervisor'],
    title: 'Üretim Takip Formları',
    // Normalize API wrapper: createSimpleTable expects array of records; the loader will pass through result.data when needed
    renderCell: (value, record, column) => {
      try {
        if (column.field === 'date' || column.field === 'addedDateTime') {
          if (!value) return '-';
          const d = new Date(value);
          if (isNaN(d.getTime())) return `<span class="text-neutral-500">${value}</span>`;
          return `<span>${d.toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>`;
        }

        if (column.field === 'quantity') {
          return `<span class="text-right">${value != null ? value : '-'}</span>`;
        }

        if (column.field === 'cycleTime') {
          if (value == null || value === '') return '-';
          return `${value} sn`;
        }

        return value || '-';
      } catch (err) {
        console.error('Uretim renderCell error:', err);
        return value || '-';
      }
    },
    createEditInput: (value, record, column) => {
      if (column.field === 'date') {
        // store ISO date string (YYYY-MM-DD)
        let v = '';
        try { if (value) v = new Date(value).toISOString().slice(0,10); } catch(e){}
        return `<input type="date" value="${v}" class="w-full px-2 py-1 bg-neutral-700 rounded text-xs">`;
      }

      if (column.field === 'shift') {
        return `
          <select class="w-full px-2 py-1 bg-neutral-700 rounded text-xs">
            <option ${value === '1' || value === '1 00-08' ? 'selected' : ''}>1 00-08</option>
            <option ${value === '2' || value === '2 08-16' ? 'selected' : ''}>2 08-16</option>
            <option ${value === '3' || value === '3 16-24' ? 'selected' : ''}>3 16-24</option>
          </select>
        `;
      }

      if (column.field === 'quantity') {
        return `<input type="number" min="0" value="${value != null ? value : ''}" class="w-full px-2 py-1 bg-neutral-700 rounded text-xs">`;
      }

      if (column.field === 'cycleTime') {
        return `<input type="number" min="0" value="${value != null ? value : ''}" class="w-full px-2 py-1 bg-neutral-700 rounded text-xs">`;
      }

      return `<input type="text" value="${value || ''}" class="w-full px-2 py-1 bg-neutral-700 rounded text-xs">`;
    },
    validateRowData: (data) => {
      const errors = [];
      if (!data.date || String(data.date).trim() === '') errors.push('Tarih gerekli');
      if (!data.productCode || String(data.productCode).trim() === '') errors.push('Ürün kodu gerekli');
      if (data.quantity != null && isNaN(Number(data.quantity))) errors.push('Adet sayı olmalı');
      if (data.cycleTime != null && isNaN(Number(data.cycleTime))) errors.push('Çevrim sayısı geçerli olmalı');
      return { isValid: errors.length === 0, errors };
    },
    formatPayload: (data) => ({
      // Map local edit fields to API expected property names
      date: data.date,
      shift: data.shift,
      line: data.line,
      shiftSupervisor: data.shiftSupervisor,
      machine: data.machine,
      operatorName: data.operatorName,
      sectionSupervisor: data.sectionSupervisor,
      productCode: data.productCode,
      productName: data.productName,
      quantity: data.quantity != null ? Number(data.quantity) : 0,
      operation: data.operation,
      castingDefect: data.castingDefect != null ? Number(data.castingDefect) : 0,
      processingDefect: data.processingDefect != null ? Number(data.processingDefect) : 0,
      cleaning: data.cleaning != null ? Number(data.cleaning) : 0,
      cycleTime: data.cycleTime != null ? Number(data.cycleTime) : 0
    })
  };

  const table = createSimpleTable(cfg);

  // Create new ProductionTrackingForm on the server
  table.createRecordOnServer = async (formData) => {
    try {
      const payload = cfg.formatPayload(formData);
  const postEndpoint = cfg.endpoints.create || cfg.endpoints.list || '/ProductionTrackingForms';
  const url = `${apiBaseUrl}${postEndpoint}`;

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`HTTP ${response.status} ${response.statusText} - ${text}`);
      }

      const result = await response.json();

      // API returns { success, message, data: [...] }
      let created = null;
      if (result?.data) {
        if (Array.isArray(result.data)) created = result.data[0];
        else created = result.data;
      } else if (result && result.id) {
        created = result;
      }

      if (created) {
        table.addRecord(created);
        showToast('Kayıt başarıyla oluşturuldu', 'success');
        return created;
      }

      showToast('Kayıt oluşturuldu (sunucudan nesne alınamadı)', 'warning');
      return result;
    } catch (err) {
      console.error('CREATE ERROR:', err);
      showToast('Oluşturma hatası: ' + err.message, 'error');
      throw err;
    }
  };

  return table;
}
