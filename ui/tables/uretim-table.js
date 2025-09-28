import { createSimpleTable } from '../simple-table.js';
import { showToast } from '../helpers.js';
import { productionColumns } from './columns.js';
import { APP_CONFIG } from '../../config/app-config.js';

// Üretim tablosu konfigürasyonu
export function createUretimTable(apiBaseUrl) {
  const cfg = {
    apiBaseUrl,
    // Backend expects 1-based pageNumber (server validation requires pageNumber >= 1)
    pageIndexZeroBased: false,
    // Explicit param name mapping to ensure `pageNumber` is used
    paramNames: { page: 'pageNumber', pageSize: 'pageSize' },
    // API endpoints used by the table (list must be paged)
    endpoints: {
      list: APP_CONFIG.API.ENDPOINTS.PRODUCTION_TRACKING_FORMS_PAGED,
      create: APP_CONFIG.API.ENDPOINTS.PRODUCTION_TRACKING_FORMS,
      activate: APP_CONFIG.API.ENDPOINTS.PRODUCTION_TRACKING_FORMS_ACTIVATE,
      deactivate: APP_CONFIG.API.ENDPOINTS.PRODUCTION_TRACKING_FORMS_DEACTIVATE,
      update: APP_CONFIG.API.ENDPOINTS.PRODUCTION_TRACKING_FORMS_UPDATE
    },
    // Column definitions (shared)
    columns: productionColumns,
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

            if (column.field === 'operation') {
              // Prefer human-friendly operation name when available
              const opName = record.operationName || record.operationDisplay || record.operationNameTurkish || null;
              if (opName) return `<span>${opName}</span>`;
              // fallback to raw value
              return value || '-';
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
    // Report-only client: creation is disabled. Keep method for compatibility but suppress network writes.
    console.warn('Attempt to create ProductionTrackingForm while in report-only mode. Create suppressed. Payload:', formData);
    if (typeof showToast === 'function') {
      showToast('Oluşturma devre dışı: Rapor modu etkin.', 'warning');
    }
    // Throw or return null to indicate nothing created. We return null to avoid breaking callers that expect a falsy value.
    return null;
  };

  return table;
}
