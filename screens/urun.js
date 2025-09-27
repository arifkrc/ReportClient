import { showToast } from '../ui/helpers.js';
import { createProductsTable } from '../ui/tables/products-table.js';
import ApiClient from '../ui/core/api-client.js';
import { APP_CONFIG } from '../config/app-config.js';
//
import { createContext, destroyContext } from '../ui/core/event-manager.js';
import { validateProduct } from '../ui/core/validation-engine.js';

let _cleanup = null;

export async function mount(container, { setHeader }) {
  setHeader('Ürünler', 'Ürün tanımları');

  // EventManager context oluştur
  const eventContext = createContext('product-form');

  container.innerHTML = `
    <div class="mt-2">
      <h3 class="text-xl font-semibold mb-2">Ürünler (Okuma Modu)</h3>
      <p class="text-sm text-neutral-400 mb-4">Bu istemci yalnızca rapor amaçlıdır; kayıt oluşturma veya düzenleme kapalıdır.</p>
      <div id="urun-list-placeholder" class="mt-2"></div>
    </div>
  `;

  const form = container.querySelector('#urun-form');
  const placeholder = container.querySelector('#urun-list-placeholder');

  // Merkezi sistemleri başlat
  const apiClient = new ApiClient(APP_CONFIG.API.BASE_URL);
  
  // No form functionality in report-only client. Dropdowns and lookups are suppressed.

  // Data table oluştur (merkezi sistem kullanarak)
  const dataTable = createProductsTable(APP_CONFIG.API.BASE_URL);
  placeholder.appendChild(dataTable);

  // Initialize
  await dataTable.init();

  _cleanup = () => {
    try { 
      eventContext.removeAll();
      destroyContext('product-form');
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