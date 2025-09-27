import { createSimpleTable } from '../simple-table.js';
import ProductInputComponent from '../core/product-input.js';

// Sipariş tablosu konfigürasyonu
export function createOrdersTable(apiBaseUrl) {
  return createSimpleTable({
    apiBaseUrl,
    endpoints: {
      list: '/Orders',
      save: '/Orders', 
      update: '/Orders/{id}',
      delete: '/Orders/{id}',
      activate: '/Orders/{id}/activate',
      deactivate: '/Orders/{id}/deactivate'
    },
    columns: [
      {
        field: 'documentNo',
        header: 'Belge No',
        className: 'font-mono',
        editable: true
      },
      {
        field: 'customer',
        header: 'Müşteri',
        editable: true
      },
      {
        field: 'productCode',
        header: 'Ürün Kodu',
        className: 'font-mono',
        editable: true,
        customRender: (record) => {
          if (record.productCode) {
            const productInfo = record.productName ? 
              `${record.productCode} (${record.productName})` : 
              record.productCode;
            return `<span title="ID: ${record.productId || 'N/A'}">${productInfo}</span>`;
          }
          return record.productCode || '';
        }
      },
      {
        field: 'variants',
        header: 'Varyantlar',
        className: 'text-sm',
        editable: true
      },
      {
        field: 'orderCount',
        header: 'Sipariş Adet',
        className: 'text-center',
        editable: true
      },
      {
        field: 'completedQuantity',
        header: 'Tamamlanan',
        className: 'text-center',
        editable: true
      },
      {
        field: 'remaining',
        header: 'Kalan',
        className: 'text-center font-medium',
        editable: false,
        customRender: (record) => {
          const orderCount = parseInt(record.orderCount) || 0;
          const completedQuantity = parseInt(record.completedQuantity) || 0;
          const remaining = orderCount - completedQuantity;
          
          // Kalan miktar negatifse kırmızı, pozitifse yeşil, sıfırsa gri renk
          let colorClass = 'text-neutral-400';
          if (remaining > 0) {
            colorClass = 'text-green-400';
          } else if (remaining < 0) {
            colorClass = 'text-red-400';
          }
          
          return `<span class="${colorClass} font-mono">${remaining}</span>`;
        }
      },
      {
        field: 'carryover',
        header: 'Devir',
        className: 'text-center',
        editable: true
      },
      {
        field: 'orderAddedDateTime',
        header: 'Hafta',
        className: 'text-center font-mono',
        editable: true
      },
      {
        field: 'addedDateTime',
        header: 'Eklenme',
        className: 'text-neutral-400 text-xs',
        editable: false
      }
    ],
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
    
    // All update/create/delete behavior removed for report-only client

    // All interactive update handlers removed for report-only client
  });
}

// Paketleme kaydı ekleme fonksiyonu
// addPackingRecord removed in report-only client