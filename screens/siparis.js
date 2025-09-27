import { showToast } from '../ui/helpers.js';
import { createOrdersTable } from '../ui/tables/orders-table.js';
import ApiClient from '../ui/core/api-client.js';
import { APP_CONFIG } from '../config/app-config.js';
import { createContext, destroyContext } from '../ui/core/event-manager.js';

let _cleanup = null;

export async function mount(container, { setHeader }) {
  setHeader('Siparişler', 'Sipariş yönetimi ve takibi');

  // EventManager context oluştur
  const eventContext = createContext('orders-form');

  container.innerHTML = `
    <div class="mt-2">
      <h3 class="text-xl font-semibold mb-2">Siparişler (Okuma Modu)</h3>
      <p class="text-sm text-neutral-400 mb-4">Yeni sipariş oluşturma ve düzenleme devre dışı. Aşağıdaki liste yalnızca görüntüleme amaçlıdır.</p>
  <div id="siparis-list-placeholder" class="mt-2"></div>
    </div>
  `;

  const placeholder = container.querySelector('#siparis-list-placeholder');
  // Merkezi sistemleri başlat
  const apiClient = new ApiClient(APP_CONFIG.API.BASE_URL);

  // Tabloyu oluştur ve yükle
  const dataTable = createOrdersTable(APP_CONFIG.API.BASE_URL);
  placeholder.appendChild(dataTable);
  await dataTable.init();
  
  // Cleanup fonksiyonu
  _cleanup = () => {
    try {
      eventContext.removeAll();
      destroyContext('orders-form');

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
