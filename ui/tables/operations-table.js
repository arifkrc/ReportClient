import { createSimpleTable } from '../simple-table.js';

// Operasyon tablosu konfigürasyonu
export function createOperationsTable(apiBaseUrl) {
  return createSimpleTable({
    apiBaseUrl,
    endpoints: {
      list: '/Operations',
      activate: '/Operations/{id}/activate',
      deactivate: '/Operations/{id}/deactivate',
      update: '/Operations/{id}'
    },
    columns: [
      {
        field: 'shortCode',
        header: 'Operasyon Kodu',
        className: 'font-mono',
        editable: true
      },
      {
        field: 'name',
        header: 'Operasyon Adı',
        editable: true
      },
      {
        field: 'addedDateTime',
        header: 'Eklenme',
        className: 'text-neutral-400 text-xs',
        editable: false
      }
    ],
    searchFields: ['shortCode', 'name', 'addedDateTime'],
    title: 'Tanımlı Operasyonlar',
    
    // Operasyona özel hücre render
    renderCell: (value, record, column) => {
      if (column.field === 'addedDateTime') {
        if (value) {
          try {
            const date = new Date(value);
            
            // Geçersiz tarih kontrolü
            if (isNaN(date.getTime())) {
              console.warn('Invalid date value:', value);
              return `<span class="text-neutral-500">${value}</span>`;
            }
            
            // Sadece tarih formatı: DD.MM.YYYY HH:mm
            const formatted = date.toLocaleDateString('tr-TR', {
              day: '2-digit',
              month: '2-digit', 
              year: 'numeric'
            }) + ' ' + date.toLocaleTimeString('tr-TR', {
              hour: '2-digit',
              minute: '2-digit'
            });
            
            return `<span class="text-neutral-400">${formatted}</span>`;
          } catch (err) {
            console.error('Date rendering error for value:', value, err);
            return `<span class="text-neutral-500" title="Tarih formatı hatası">${value}</span>`;
          }
        }
        return '-';
      }
      
      return value || '-';
    },
    
    // Operasyona özel düzenleme kontrolü
    createEditInput: (value, record, column) => {
      if (column.field === 'shortCode') {
        return `<input type="text" value="${value || ''}" class="w-full px-2 py-1 bg-neutral-700 rounded text-xs uppercase" placeholder="OP001" maxlength="10">`;
      }
      if (column.field === 'name') {
        return `<textarea rows="2" class="w-full px-2 py-1 bg-neutral-700 rounded text-xs" placeholder="Operasyon adı">${value || ''}</textarea>`;
      }
      return `<input type="text" value="${value || ''}" class="w-full px-2 py-1 bg-neutral-700 rounded text-xs">`;
    },
    
    // Operasyona özel validasyon
    validateRowData: (data) => {
      const errors = [];
      if (!data.shortCode || data.shortCode.trim() === '') errors.push('Operasyon kodu boş bırakılamaz');
      if (!data.name || data.name.trim() === '') errors.push('Operasyon adı boş bırakılamaz');
      
      return { isValid: errors.length === 0, errors };
    },
    
    // API'ye gönderilecek format
    formatPayload: (data) => ({
      name: data.name.trim(),
      shortCode: data.shortCode.trim().toUpperCase()
    })
  });
}