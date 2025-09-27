import { createSimpleTable } from '../simple-table.js';

// Çevrim Zamanları tablosu konfigürasyonu
export function createCycleTimesTable(apiBaseUrl) {
  
  // Operasyon listesini dropdown'a yükle (direkt API'den)
  async function loadOperationsToSelect(selectElement, apiBaseUrl) {
    try {
      console.log('📡 Fetching operations directly from API...');
      console.log('🔗 API Base URL:', apiBaseUrl);
      console.log('🎯 Full endpoint URL:', `${apiBaseUrl}/Operations`);
      
      const response = await fetch(`${apiBaseUrl}/Operations`);
      
      console.log('📊 Response status:', response.status);
      console.log('📊 Response ok:', response.ok);
      
      if (!response.ok) {
        console.error('❌ HTTP Error:', response.status, response.statusText);
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      console.log('📦 Raw API response:', result);
      
      // Response format handling
      let operations = [];
      if (Array.isArray(result)) {
        operations = result;
      } else if (result.success && result.data) {
        operations = result.data;
      } else if (result.data) {
        operations = result.data;
      } else {
        console.warn('Unexpected operations API response:', result);
        operations = [];
      }
      
      console.log(`✅ Loaded ${operations.length} operations from API`);
      
      // Dropdown'u populate et
      console.log(`🔧 Populating dropdown with ${operations.length} operations`);
      
      // Mevcut seçimi koru
      const currentOperationId = selectElement.getAttribute('data-current-operation-id');
      const currentOperationName = selectElement.getAttribute('data-current-operation-name');
      
      // Dropdown'u temizle ve placeholder ekle
      selectElement.innerHTML = '<option value="" disabled>Operasyon seçiniz...</option>';
      
      // Operasyonları ekle
      operations.forEach(op => {
        const option = document.createElement('option');
        option.value = op.id;
        option.textContent = `${op.shortCode || 'N/A'} - ${op.name || 'Unnamed'}`;
        
        // Mevcut operasyonu seçili yap
        if (op.id == currentOperationId) {
          option.selected = true;
          console.log(`✅ Current operation selected: ${op.shortCode} - ${op.name}`);
        }
        
        selectElement.appendChild(option);
      });
      
      // Eğer mevcut operasyon listede yoksa, onu da ekle
      if (currentOperationId && currentOperationName && !operations.find(op => op.id == currentOperationId)) {
        const currentOption = document.createElement('option');
        currentOption.value = currentOperationId;
        currentOption.textContent = currentOperationName;
        currentOption.selected = true;
        currentOption.className = 'text-yellow-400'; // Görsel olarak farklı göster
        selectElement.appendChild(currentOption);
        console.log(`⚠️ Added missing current operation: ${currentOperationName}`);
      }
      
      console.log(`✅ Dropdown populated with ${selectElement.options.length - 1} operations`);
      
    } catch (error) {
      console.error('❌ Operations load error:', error);
      selectElement.innerHTML = '<option value="" disabled>Operasyon yüklenemedi</option>';
    }
  }
  
  // Global access için fonksiyonu window'a ekle
  if (typeof window !== 'undefined') {
    window.loadOperationsToSelect = loadOperationsToSelect;
  }

  return createSimpleTable({
    apiBaseUrl,
    endpoints: {
      list: '/CycleTimes',
      activate: '/CycleTimes/{id}/activate',
      deactivate: '/CycleTimes/{id}/deactivate',
      update: '/CycleTimes/{id}'
    },
    columns: [
      { 
        field: 'productCode', 
        title: 'Ürün Kodu', 
        editable: false,
        width: '150px'
      },
      { 
        field: 'productName', 
        title: 'Ürün Adı', 
        editable: false,
        width: '200px'
      },
      { 
        field: 'operationShortCode', 
        title: 'Op. Kodu', 
        editable: false,
        width: '100px'
      },
      { 
        field: 'operationName', 
        title: 'Operasyon', 
        editable: true,
        width: '250px'
      },
      { 
        field: 'second', 
        title: 'Süre (sn)', 
        editable: true,
        width: '120px'
      },
      { 
        field: 'isActive', 
        title: 'Durum', 
        editable: false,
        width: '100px'
      }
    ],
    searchFields: ['operationShortCode', 'operationName', 'productCode', 'productName', 'second'],
    title: 'Çevrim Zamanları',
    emptyMessage: 'Çevrim zamanı kaydı bulunamadı',
    
    // Custom cell renderer - Backend verilerini direkt kullan
    renderCell: (value, record, column) => {
      // İsActive için özel durum
      if (column.field === 'isActive') {
        const isActive = record.isActive;
        return isActive ? 
          '<span class="px-2 py-1 text-xs rounded bg-green-700 text-green-100">Aktif</span>' :
          '<span class="px-2 py-1 text-xs rounded bg-red-700 text-red-100">Pasif</span>';
      }
      
      // Second için özel durum
      if (column.field === 'second') {
        const seconds = record.second || 0;
        return `${seconds} sn`;
      }
      
      // Diğer field'lar için direkt record'dan al
      if (column.field === 'productCode') {
        return record.productCode || '-';
      }
      
      if (column.field === 'productName') {
        return record.productName || '-';
      }
      
      if (column.field === 'operationShortCode') {
        return record.operationShortCode || '-';
      }
      
      if (column.field === 'operationName') {
        return record.operationName || '-';
      }
      
      // Fallback: record'dan field'ı direkt al
      const fieldValue = record[column.field];
      return fieldValue !== undefined && fieldValue !== null ? fieldValue : '-';
    },
    
    // Custom edit input creator
    createEditInput: (value, record, column) => {
      if (column.field === 'operationName') {
        return `<select 
          data-field="${column.field}" 
          name="${column.field}"
          data-current-operation-id="${record.operationId}"
          data-current-operation-name="${record.operationName}"
          class="w-full px-2 py-1 border rounded bg-gray-800 border-gray-600 text-white">
          <option value="" disabled>Yükleniyor...</option>
        </select>`;
      }
      
      if (column.field === 'second') {
        return `<input type="number" 
          data-field="${column.field}" 
          value="${value || ''}" 
          min="0" 
          step="0.1"
          class="w-full px-2 py-1 border rounded bg-gray-800 border-gray-600 text-white" />`;
      }
      
      return `<input type="text" 
        data-field="${column.field}" 
        value="${value || ''}" 
        class="w-full px-2 py-1 border rounded bg-gray-800 border-gray-600 text-white" />`;
    },
    
    // Row validation
    validateRowData: (data) => {
      const errors = [];
      
      if (!data.second || parseFloat(data.second) <= 0) {
        errors.push('Süre 0\'dan büyük olmalıdır');
      }
      
      if (!data.operationName) {
        errors.push('Operasyon seçilmeli');
      }
      
      return {
        isValid: errors.length === 0,
        errors
      };
    },
    
    // Record validation for backend
    validateRecord: (data) => {
      const errors = [];
      
      if (!data.productCode) {
        errors.push({ field: 'productCode', msg: 'Ürün kodu gerekli' });
      }
      
      if (!data.operationId) {
        errors.push({ field: 'operationId', msg: 'Operasyon gerekli' });
      }
      
      if (!data.second || parseFloat(data.second) <= 0) {
        errors.push({ field: 'second', msg: 'Süre 0\'dan büyük olmalıdır' });
      }
      
      return {
        isValid: errors.length === 0,
        errors
      };
    },
    
    // Define editable fields for the table
    getEditFields: () => [
      'operationName',
      'second'
    ],
    
    // Custom update handler
    customUpdateHandler: async (recordId, editableFields, originalRecord, apiBaseUrl, showToast, reloadData) => {
      try {
        console.log('🔄 CycleTimes UPDATE - Record ID:', recordId);
        console.log('🔄 CycleTimes UPDATE - Editable Fields:', editableFields);
        console.log('🔄 CycleTimes UPDATE - Original Record:', originalRecord);
        
        // Form verilerini hazırla
        const operationSelect = editableFields.operationName;
        const secondInput = editableFields.second;
        
        // Operasyon bilgilerini çıkar
        let operationId = null;
        let operationName = '';
        let operationShortCode = '';
        
        if (operationSelect && operationSelect.value) {
          operationId = operationSelect.value;
          const selectedOption = operationSelect.options[operationSelect.selectedIndex];
          if (selectedOption) {
            operationName = selectedOption.textContent;
            operationShortCode = selectedOption.textContent.split(' - ')[0];
          }
        }
        
        const updateData = {
          id: recordId,
          productId: originalRecord.productId,
          productCode: originalRecord.productCode,
          productName: originalRecord.productName,
          operationId: operationId,
          operationName: operationName,
          operationShortCode: operationShortCode,
          second: parseFloat(secondInput.value) || 0,
          isActive: originalRecord.isActive
        };
        
        console.log('📤 CycleTimes UPDATE - Data being sent:', updateData);
        
        // API'ye PUT request gönder
        const response = await fetch(`${apiBaseUrl}/CycleTimes/${recordId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(updateData)
        });
        
        console.log('📊 CycleTimes UPDATE - Response status:', response.status);
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`HTTP ${response.status}: ${errorText}`);
        }
        
        const result = await response.json();
        console.log('✅ CycleTimes UPDATE SUCCESS:', result);
        
        showToast('Çevrim zamanı başarıyla güncellendi', 'success');
        await reloadData(); // Tabloyu yenile
        
        return true;
        
      } catch (error) {
        console.error('❌ CycleTimes UPDATE ERROR:', error);
        showToast('Güncelleme hatası: ' + error.message, 'error');
        return false;
      }
    }
  });
}