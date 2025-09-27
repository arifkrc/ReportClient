import { showToast } from '../ui/helpers.js';
import { createCycleTimesTable } from '../ui/tables/cycle-times-table.js';
import ApiClient from '../ui/core/api-client.js';
import { APP_CONFIG } from '../config/app-config.js';
import DropdownManager from '../ui/managers/dropdown-manager.js';
import { createContext, destroyContext } from '../ui/core/event-manager.js';
import { validateCycleTime } from '../ui/core/validation-engine.js';
// ...existing code...

let _cleanup = null;

export async function mount(container, { setHeader }) {
  setHeader('Çevrim Zamanları', 'Operasyon çevrim sürelerini yönetin');

  // EventManager context oluştur
  const eventContext = createContext('cycle-times-form');

  container.innerHTML = `
    <div class="mt-2">
      <h3 class="text-xl font-semibold mb-2">Çevrim Zamanları (Okuma Modu)</h3>
      <p class="text-sm text-neutral-400 mb-4">Çevrim zamanı ekleme/güncelleme kapalıdır. Bu ekran rapor amaçlıdır.</p>
  <div id="cycle-times-list-placeholder" class="mt-2"></div>
    </div>
  `;

  const placeholder = container.querySelector('#cycle-times-list-placeholder');
  // Merkezi sistemleri başlat
  const apiClient = new ApiClient(APP_CONFIG.API.BASE_URL);
  const dropdownManager = new DropdownManager(apiClient);

  // Create an operation select so dropdownManager can populate it
  const operationSelect = document.createElement('select');
  operationSelect.name = 'operationId';
  operationSelect.className = 'mt-2 px-2 py-1 bg-neutral-800 rounded text-sm';
  // add a label for clarity
  const opLabel = document.createElement('div');
  opLabel.className = 'text-sm text-neutral-400 mb-1';
  opLabel.textContent = 'Operasyon seçin';
  placeholder.appendChild(opLabel);
  placeholder.appendChild(operationSelect);

  // Conflict dialog - Kullanıcıya güncelleme seçeneği sun
  async function showConflictDialog(formData, message, errors) {
    return new Promise((resolve) => {
      // Modal overlay oluştur
      const overlay = document.createElement('div');
      overlay.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
      
      // Modal content
      const modal = document.createElement('div');
      modal.className = 'bg-neutral-800 rounded-lg p-6 max-w-md mx-4 text-white';
      
      // Operasyon ve ürün bilgileri
      const operationName = container.querySelector('[name="operationId"] option:checked')?.textContent || 'Bilinmeyen Operasyon';
      const productCode = formData.productCode;
      const productName = container.querySelector('#product-name-display')?.textContent || '';
      const newSeconds = formData.second;
      
      modal.innerHTML = `
        <div class="mb-4">
          <h3 class="text-lg font-semibold text-yellow-400 mb-2">⚠️ Çevrim Zamanı Zaten Mevcut</h3>
          <div class="text-sm text-neutral-300 space-y-1">
            <p><strong>Ürün:</strong> ${productCode} - ${productName}</p>
            <p><strong>Operasyon:</strong> ${operationName}</p>
            <p><strong>Yeni Süre:</strong> ${newSeconds} saniye</p>
          </div>
        </div>
        
        <div class="mb-4 text-sm text-neutral-400">
          <p>${message}</p>
          ${errors.length > 0 ? `<ul class="mt-2 list-disc list-inside">${errors.map(e => `<li>${e}</li>`).join('')}</ul>` : ''}
        </div>
        
        <div class="mb-4 p-3 bg-blue-900 bg-opacity-50 rounded text-sm">
          <p class="text-blue-300"><strong>💡 Seçenekler:</strong></p>
          <p>• <strong>Güncelle:</strong> Mevcut çevrim zamanını yeni değerle günceller</p>
          <p>• <strong>İptal:</strong> Değişiklik yapmadan geri döner</p>
        </div>
        
        <div class="flex gap-2 justify-end">
          <button id="conflict-cancel" class="px-4 py-2 bg-neutral-600 hover:bg-neutral-500 rounded text-sm">İptal</button>
          <button id="conflict-update" class="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded text-sm">🔄 Güncelle</button>
        </div>
      `;
      
      overlay.appendChild(modal);
      document.body.appendChild(overlay);
      
      // Event listeners
      modal.querySelector('#conflict-cancel').addEventListener('click', () => {
        document.body.removeChild(overlay);
        resolve(false);
      });
      
      modal.querySelector('#conflict-update').addEventListener('click', () => {
        document.body.removeChild(overlay);
        resolve(true);
      });
      
      // ESC key ile kapatma
      const handleEscape = (e) => {
        if (e.key === 'Escape') {
          document.body.removeChild(overlay);
          document.removeEventListener('keydown', handleEscape);
          resolve(false);
        }
      };
      document.addEventListener('keydown', handleEscape);
    });
  }
  
  // Mevcut kaydı güncelle
  async function updateExistingRecord(formData) {
    try {
      console.log('🔄 Updating existing cycle time record');
      
  // Önce mevcut kaydı bul
  const foundProductId = formData.productId || null;
  const existingRecord = await findExistingRecord(formData.operationId, foundProductId);
      
      if (!existingRecord) {
        showToast('Güncellenecek kayıt bulunamadı', 'error');
        return false;
      }
      
      // Update by user is disabled in read-only/report client
      showToast('Çevrim zamanı güncelleme devre dışı: rapor istemcisi (read-only)', 'warning');
      return false;
      
    } catch (error) {
      console.error('❌ Update error:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Güncelleme hatası';
      showToast('Güncelleme hatası: ' + errorMessage, 'error');
      return false;
    }
  }
  
  // Mevcut kaydı bul
  async function findExistingRecord(operationId, productId) {
    try {
      const result = await apiClient.get('/CycleTimes');
      if (result.success && result.data) {
        const records = Array.isArray(result.data) ? result.data : (result.data.data || []);
        return records.find(r => 
          r.operationId == operationId && 
          r.productId == productId && 
          r.isActive !== false
        );
      }
      return null;
    } catch (error) {
      console.error('Error finding existing record:', error);
      return null;
    }
  }

  // Table data manipulation helper function
  async function addRecordToTable(newRecord, formData) {
    try {
  // Operasyon bilgilerini cache'den al
  const operations = await dropdownManager.getOperations();
  const operation = operations.find(op => op.id == formData.operationId);
      
  // Ürün bilgisi okunamaz (read-only client); leave blank or use formData.productCode
  const productName = formData.productCode || '';
      
      // Complete record object oluştur
      const completeRecord = {
        id: newRecord.id,
        operationShortCode: operation?.shortCode || '',
        operationName: operation?.name || '',
        productCode: formData.productCode,
        productName: productName,
        second: newRecord.second || formData.second,
        addedDateTime: newRecord.addedDateTime || new Date().toISOString(),
        isActive: true
      };
      
      // Tablonun iç datasına ekle
      if (dataTable && dataTable.addRecord) {
        dataTable.addRecord(completeRecord);
        console.log('✅ Record added to table without backend call');
      } else {
        // Fallback: full reload
        await dataTable.reload();
      }
    } catch (error) {
      console.warn('⚠️ Could not add record to table, falling back to reload:', error);
      await dataTable.reload();
    }
  }

  // Dropdownları doldur (sadece operasyonlar)
  await dropdownManager.populateOperations(operationSelect);

  // Data table oluştur (merkezi sistem kullanarak)
  const dataTable = createCycleTimesTable(APP_CONFIG.API.BASE_URL);
  placeholder.appendChild(dataTable);

  // Initialize
  await dataTable.init();

  _cleanup = () => {
    try { 
      eventContext.removeAll();
      destroyContext('cycle-times-form');
      
  // nothing specific to clean in read-only mode
      
      container.innerHTML = ''; 
    } catch(e) {
      console.error('Cleanup error:', e);
    }
    _cleanup = null;
  };
}

export async function unmount(container) { 
  if (_cleanup) _cleanup(); 
}