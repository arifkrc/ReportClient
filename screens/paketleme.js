import { showToast } from '../ui/helpers.js';
import { createPackingsTable } from '../ui/tables/packings-table.js';
import ApiClient from '../ui/core/api-client.js';
import { APP_CONFIG } from '../config/app-config.js';
import { createContext, destroyContext } from '../ui/core/event-manager.js';
import ProductInputComponent from '../ui/core/product-input.js';

let _cleanup = null;

export async function mount(container, { setHeader }) {
  setHeader('Paketleme', 'Paketleme işlemleri ve takibi');

  // EventManager context oluştur
  const eventContext = createContext('packings-form');

  container.innerHTML = `
    <div class="mt-2">
      <h3 class="text-xl font-semibold mb-2">Paketleme (Okuma Modu)</h3>
      <p class="text-sm text-neutral-400 mb-4">Yeni paketleme kaydı oluşturma kapalıdır. Aşağıdaki liste rapor amaçlıdır.</p>
      <div id="product-input-container" class="mb-4"></div>
      <div id="packings-list-placeholder" class="mt-2"></div>
    </div>
  `;

  const placeholder = container.querySelector('#packings-list-placeholder');
  const productInputContainer = container.querySelector('#product-input-container');

  // Merkezi sistemleri başlat
  const apiClient = new ApiClient(APP_CONFIG.API.BASE_URL);
  
  // Merkezi Product Input Component'i oluştur
  const productInput = new ProductInputComponent({
    onProductFound: (product) => {
      console.log('✅ Product found via component:', product);
    },
    onProductNotFound: (productCode) => {
      console.log('❌ Product not found via component:', productCode);
    },
    onError: (error) => {
      console.error('❌ Product lookup error via component:', error);
      showToast('Ürün arama hatası', 'error');
    }
  });

  // Product input'u container'a ekle
  const { input: productCodeInput, display: productNameDisplay } = productInput.createProductInput(
    productInputContainer,
    {
      inputName: 'productCode',
      placeholder: 'PRD001',
      required: true
    }
  );

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
      
      // Product input component'i temizle
      if (productInput) {
        productInput.destroy();
      }
      
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
