import { showToast } from '../ui/helpers.js';
import { createPackingsTable } from '../ui/tables/packings-table.js';
import ApiClient from '../ui/core/api-client.js';
import { APP_CONFIG } from '../config/app-config.js';
import { createContext, destroyContext } from '../ui/core/event-manager.js';

let _cleanup = null;

export async function mount(container, { setHeader }) {
  setHeader('Paketleme', 'Paketleme işlemleri ve takibi');

  // EventManager context oluştur
  const eventContext = createContext('packings-form');

  container.innerHTML = `
    <div class="mt-2">
      <h3 class="text-xl font-semibold mb-2">Paketleme (Okuma Modu)</h3>
      <p class="text-sm text-neutral-400 mb-4">Yeni paketleme kaydı oluşturma kapalıdır. Aşağıdaki liste rapor amaçlıdır.</p>
  <div id="packings-list-placeholder" class="mt-2"></div>
    </div>
  `;

  const placeholder = container.querySelector('#packings-list-placeholder');
  // Merkezi sistemleri başlat
  const apiClient = new ApiClient(APP_CONFIG.API.BASE_URL);

  // Tabloyu oluştur ve yükle
  const dataTable = createPackingsTable(APP_CONFIG.API.BASE_URL);
  placeholder.appendChild(dataTable);

  // Initialize table
  await dataTable.init();

  // Cleanup fonksiyonu
  _cleanup = () => {
    try {
      eventContext.removeAll();
      destroyContext('packings-form');
      
      // nothing specific to clean for product input in read-only mode
      
      container.innerHTML = '';
    } catch (err) {
      console.error('Cleanup error:', err);
    }
    _cleanup = null;
  };
}

export async function unmount(container) { 
  if (_cleanup) _cleanup(); 
}
