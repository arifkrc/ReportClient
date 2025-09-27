import { createSimpleTable } from '../simple-table.js';
import { APP_CONFIG } from '../../config/app-config.js';
import { ordersColumns } from './columns.js';

// Sipariş tablosu konfigürasyonu
export function createOrdersTable(apiBaseUrl) {
  return createSimpleTable({
    apiBaseUrl,
    endpoints: {
      list: APP_CONFIG.API.ENDPOINTS.ORDERS,
      save: APP_CONFIG.API.ENDPOINTS.ORDERS,
      update: APP_CONFIG.API.ENDPOINTS.ORDERS_BY_ID,
      delete: APP_CONFIG.API.ENDPOINTS.ORDERS_BY_ID,
      activate: APP_CONFIG.API.ENDPOINTS.ORDERS_ACTIVATE,
      deactivate: APP_CONFIG.API.ENDPOINTS.ORDERS_DEACTIVATE
    },
    columns: ordersColumns,
    searchFields: ['documentNo', 'customer', 'productCode', 'variants'],
    title: 'Sipariş Listesi',
    
    // Siparişe özel hücre render
    renderCell: (value, record, column) => {
      if (column.field === 'orderAddedDateTime') {
        // Hafta bilgisi için string render (örn: "37.HAFTA")
        return value ? `<span class="text-neutral-200 font-mono">${value}</span>` : '-';
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
      
      if (column.field === 'remaining') {
        // Kalan miktar hesaplama - bu custom render'da yapılıyor
        const orderCount = parseInt(record.orderCount) || 0;
        const completedQuantity = parseInt(record.completedQuantity) || 0;
        const remaining = orderCount - completedQuantity;
        
        // Renk kodlaması
        let colorClass = 'text-neutral-400';
        let bgClass = '';
        if (remaining > 0) {
          colorClass = 'text-green-400';
          bgClass = 'bg-green-900 bg-opacity-20';
        } else if (remaining < 0) {
          colorClass = 'text-red-400';
          bgClass = 'bg-red-900 bg-opacity-20';
        } else {
          bgClass = 'bg-neutral-800';
        }
        
        return `<span class="${colorClass} ${bgClass} px-2 py-1 rounded font-mono text-sm">${remaining}</span>`;
      }
      
      if (column.field === 'orderCount' || column.field === 'carryover' || column.field === 'completedQuantity') {
        return value !== null && value !== undefined ? value.toString() : '0';
      }
      
      if (column.field === 'variants') {
        if (value && value.length > 30) {
          return `<span title="${value}">${value.substring(0, 30)}...</span>`;
        }
        return value || '-';
      }
      
      return value || '-';
    },
    
    // Read-only table: editing inputs removed
    
    // Siparişe özel validasyon
    validateRowData: (data) => {
      const errors = [];
      if (!data.documentNo) errors.push('Belge numarası gerekli');
      if (!data.customer) errors.push('Müşteri adı gerekli');
      if (!data.productCode) errors.push('Ürün kodu gerekli');
      if (!data.orderAddedDateTime) errors.push('Hafta bilgisi gerekli');
      if (data.orderCount !== undefined && data.orderCount < 0) errors.push('Sipariş adeti negatif olamaz');
      if (data.completedQuantity !== undefined && data.completedQuantity < 0) errors.push('Tamamlanan miktar negatif olamaz');
      if (data.carryover !== undefined && data.carryover < 0) errors.push('Devir negatif olamaz');
      
      return { isValid: errors.length === 0, errors };
    },
    
    // API'ye gönderilecek format
    formatPayload: (data) => {
      return {
        orderAddedDateTime: (data.orderAddedDateTime || '').trim(), // Hafta bilgisi
        documentNo: (data.documentNo || '').trim(),
        customer: (data.customer || '').trim(),
        productCode: (data.productCode || '').toUpperCase().trim(),
        variants: (data.variants || '').trim(),
        orderCount: parseInt(data.orderCount) || 0,
        completedQuantity: parseInt(data.completedQuantity) || 0,
        carryover: parseInt(data.carryover) || 0
      };
    },
    
  // Read-only: update/create/delete and interactive handlers disabled
  });
}

// Paketleme kaydı ekleme fonksiyonu
// addPackingRecord removed in report-only client