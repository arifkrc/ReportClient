import { showToast } from '../ui/helpers.js';
import { createOperationsTable } from '../ui/tables/operations-table.js';
import ApiClient from '../ui/core/api-client.js';
import { APP_CONFIG } from '../config/app-config.js';
import { createContext, destroyContext } from '../ui/core/event-manager.js';
import { validateOperation } from '../ui/core/validation-engine.js';

let _cleanup = null;

export async function mount(container, { setHeader }) {
  setHeader('Operasyonlar', 'Operasyon tanımları');

  // EventManager context oluştur
  const eventContext = createContext('operation-form');

  container.innerHTML = `
    <div class="mt-2">
      <h3 class="text-xl font-semibold mb-2">Operasyonlar (Okuma Modu)</h3>
      <p class="text-sm text-neutral-400 mb-4">Operasyon ekleme/düzenleme kapalı. Listeleme amaçlı görünüm.</p>
      <div id="operasyon-list-placeholder"></div>
    </div>
  `;

  const form = container.querySelector('#operasyon-form');
  const placeholder = container.querySelector('#operasyon-list-placeholder');

  // Merkezi sistemleri başlat
  const apiClient = new ApiClient(APP_CONFIG.API.BASE_URL);
  
  // Data table oluştur (merkezi sistem kullanarak)
  const dataTable = createOperationsTable(APP_CONFIG.API.BASE_URL);
  placeholder.appendChild(dataTable);

  // Initialize
  await dataTable.init();

  _cleanup = () => {
    try { 
      eventContext.removeAll(); // removeAll metodunu kullan
      destroyContext('operation-form');
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