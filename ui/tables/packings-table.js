import { createSimpleTable } from '../simple-table.js';

// Paketleme tablosu konfigürasyonu
export function createPackingsTable(apiBaseUrl) {
  return createSimpleTable({
    apiBaseUrl,
    endpoints: {
      list: '/Packings',
      save: '/Packings', 
      update: '/Packings/{id}',
      delete: '/Packings/{id}',
      activate: '/Packings/{id}/activate',
      deactivate: '/Packings/{id}/deactivate'
    },
    columns: [
      {
        field: 'date',
        header: 'Tarih',
        className: 'text-neutral-400 text-xs',
        editable: true
      },
      {
        field: 'shift',
        header: 'Vardiya',
        className: 'text-center font-mono',
        editable: true
      },
      {
        field: 'supervisor',
        header: 'Sorumlu',
        className: 'text-sm',
        editable: true
      },
      {
        field: 'productCode',
        header: 'Ürün Kodu',
        className: 'font-mono',
        editable: true
      },
      {
        field: 'quantity',
        header: 'Miktar',
        className: 'text-center font-medium',
        editable: true
      },
      {
        field: 'explodedFrom',
        header: 'Exploded From',
        className: 'text-sm text-neutral-400',
        editable: true
      },
      {
        field: 'explodingTo',
        header: 'Exploding To',
        className: 'text-sm text-neutral-400',
        editable: true
      },
      {
        field: 'addedDateTime',
        header: 'Eklenme',
        className: 'text-neutral-400 text-xs',
        editable: false
      }
    ],
    searchFields: ['productCode', 'supervisor', 'shift', 'explodedFrom', 'explodingTo'],
    title: 'Paketleme Listesi',
    
    // Paketleme'ye özel hücre render
    renderCell: (value, record, column) => {
      if (column.field === 'date') {
        if (value) {
          try {
            const date = new Date(value);
            
            // Geçersiz tarih kontrolü
            if (isNaN(date.getTime())) {
              console.warn('Invalid date value:', value);
              return `<span class="text-neutral-500">${value}</span>`;
            }
            
            // Tarih formatı: DD.MM.YYYY HH:mm
            const formatted = date.toLocaleDateString('tr-TR', {
              day: '2-digit',
              month: '2-digit', 
              year: 'numeric'
            }) + ' ' + date.toLocaleTimeString('tr-TR', {
              hour: '2-digit',
              minute: '2-digit'
            });
            
            return `<span class="text-neutral-300">${formatted}</span>`;
          } catch (err) {
            console.error('Date rendering error for value:', value, err);
            return `<span class="text-neutral-500" title="Tarih formatı hatası">${value}</span>`;
          }
        }
        return '-';
      }
      
      if (column.field === 'addedDateTime') {
        if (value) {
          try {
            const date = new Date(value);
            
            // Geçersiz tarih kontrolü
            if (isNaN(date.getTime())) {
              console.warn('Invalid date value:', value);
              return `<span class="text-neutral-500">${value}</span>`;
            }
            
            // Tarih formatı: DD.MM.YYYY HH:mm
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
      
      if (column.field === 'shift') {
        // Vardiya renk kodlaması
        let colorClass = 'text-neutral-300';
        if (value === '00-08') {
          colorClass = 'text-blue-400'; // Gece vardiyası - mavi
        } else if (value === '08-16') {
          colorClass = 'text-green-400'; // Gündüz vardiyası - yeşil
        } else if (value === '16-24') {
          colorClass = 'text-orange-400'; // Akşam vardiyası - turuncu
        }
        
        return value ? `<span class="${colorClass} font-mono">${value}</span>` : '-';
      }
      
      if (column.field === 'quantity') {
        return value !== null && value !== undefined ? 
          `<span class="font-medium text-green-400">${value.toString()}</span>` : '0';
      }
      
      if (column.field === 'productCode') {
        return value ? `<span class="font-mono text-blue-300">${value}</span>` : '-';
      }
      
      if (column.field === 'explodedFrom' || column.field === 'explodingTo') {
        return value || '-';
      }
      
      return value || '-';
    },
    
    // Read-only table: editing inputs removed
    
    // Paketleme'ye özel validasyon
    validateRowData: (data) => {
      const errors = [];
      if (!data.date) errors.push('Tarih gerekli');
      if (!data.shift) errors.push('Vardiya seçimi gerekli');
      if (!data.productCode) errors.push('Ürün kodu gerekli');
      if (!data.quantity || data.quantity <= 0) errors.push('Miktar 0\'dan büyük olmalı');
      
      return { isValid: errors.length === 0, errors };
    },
    
    // API'ye gönderilecek format
    formatPayload: (data) => {
      return {
        date: data.date ? new Date(data.date + 'T00:00:00').toISOString() : new Date().toISOString(),
        shift: (data.shift || '').trim() || null,
        supervisor: (data.supervisor || '').trim() || null,
        productCode: (data.productCode || '').toUpperCase().trim(),
        quantity: parseInt(data.quantity) || 1,
        explodedFrom: (data.explodedFrom || '').trim() || null,
        explodingTo: (data.explodingTo || '').trim() || null
      };
    }
  });
}