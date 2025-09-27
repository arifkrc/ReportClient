/**
 * Product Input Component
 * Ürün kodu girişi ve arama özelliği sağlayan merkezi component
 */

import ApiClient from './api-client.js';
import { APP_CONFIG } from '../../config/app-config.js';

class ProductInputComponent {
  constructor(options = {}) {
    this.apiClient = new ApiClient(APP_CONFIG.API.BASE_URL);
    this.productsCache = null;
    this.cacheTimestamp = null;
    this.cacheDuration = options.cacheDuration || 5 * 60 * 1000; // 5 dakika
    this.searchTimeout = null;
    this.foundProductId = null;
    this.onProductFound = options.onProductFound || (() => {});
    this.onProductNotFound = options.onProductNotFound || (() => {});
    this.onError = options.onError || (() => {});
  }

  /**
   * Ürün input alanı ve display alanını oluşturur
   * @param {HTMLElement} container - Input ve display'in yerleştirileceği container
   * @param {Object} options - Konfigürasyon seçenekleri
   * @returns {Object} Input ve display elementleri
   */
  createProductInput(container, options = {}) {
    const {
      inputName = 'productCode',
      placeholder = 'Ürün kodunu yazın...',
      required = true,
      inputClass = 'mt-1 px-3 py-2 bg-neutral-800 rounded text-neutral-100 w-full',
      displayClass = 'text-xs text-neutral-400 mt-1 min-h-4'
    } = options;

    // HTML yapısını oluştur
    container.innerHTML = `
      <div class="relative">
        <input name="${inputName}" type="text" 
               class="${inputClass}" 
               placeholder="${placeholder}" ${required ? 'required' : ''} />
        <div class="product-name-display ${displayClass}">
          <!-- Ürün adı burada görünecek -->
        </div>
      </div>
    `;

    const input = container.querySelector(`[name="${inputName}"]`);
    const display = container.querySelector('.product-name-display');

    // Event listener ekle
    this.attachProductLookup(input, display);

    return { input, display };
  }

  /**
   * Mevcut input elementine product lookup özelliği ekler
   * @param {HTMLInputElement} input - Ürün kodu input elementi
   * @param {HTMLElement} display - Ürün adı display elementi
   */
  attachProductLookup(input, display) {
    input.addEventListener('input', (e) => {
      this.handleProductInput(e.target.value.trim().toUpperCase(), display);
    });

    // Blur event'inde de arama yap
    input.addEventListener('blur', (e) => {
      this.handleProductInput(e.target.value.trim().toUpperCase(), display);
    });
  }

  /**
   * Ürün kodu girişini işler
   * @param {string} productCode - Girilen ürün kodu
   * @param {HTMLElement} display - Ürün adı display elementi
   */
  async handleProductInput(productCode, display) {
    // Timeout'u temizle
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }

    if (!productCode) {
      display.textContent = '';
      display.className = display.className.replace(/text-(green|red)-400/g, 'text-neutral-400');
      this.foundProductId = null;
      this.onProductNotFound(null);
      return;
    }

    // 300ms sonra ürün araması yap
    this.searchTimeout = setTimeout(async () => {
      try {
        display.textContent = 'Aranıyor...';
        display.className = display.className.replace(/text-(green|red)-400/g, 'text-neutral-400');

        const foundProduct = await this.searchProduct(productCode);

        if (foundProduct) {
          const productName = foundProduct.name || foundProduct.productName || foundProduct.Name || foundProduct.ProductName || 'İsimsiz Ürün';
          display.textContent = productName;
          display.className = display.className.replace(/text-(neutral|red)-400/g, 'text-green-400');
          this.foundProductId = foundProduct.id || foundProduct.Id;
          
          console.log('✅ Product found:', this.foundProductId, productName);
          this.onProductFound(foundProduct);
        } else {
          display.textContent = 'Ürün bulunamadı';
          display.className = display.className.replace(/text-(neutral|green)-400/g, 'text-red-400');
          this.foundProductId = null;
          
          console.log('❌ Product not found for code:', productCode);
          this.onProductNotFound(productCode);
        }
      } catch (err) {
        console.error('❌ Product lookup error:', err);
        display.textContent = 'Arama hatası: ' + err.message;
        display.className = display.className.replace(/text-(neutral|green)-400/g, 'text-red-400');
        this.foundProductId = null;
        this.onError(err);
      }
    }, 300);
  }

  /**
   * Ürün arama işlemi
   * @param {string} productCode - Aranacak ürün kodu
   * @returns {Promise<Object|null>} Bulunan ürün veya null
   */
  async searchProduct(productCode) {
    try {
      console.log(`🔍 Searching product: ${productCode}`);
      
      let foundProduct = null;

      // 1. Önce özel endpoint ile ara (en hızlı)
      foundProduct = await this.searchProductByCode(productCode);

      // 2. Endpoint başarısız olduysa cache'ten ara
      if (!foundProduct && this.isCacheValid()) {
        console.log('🎯 Fallback to cache search for:', productCode);
        foundProduct = this.searchProductInCache(productCode);
      }

      // 3. Cache'te de yoksa veya cache geçersizse, cache'i yükle ve ara
      if (!foundProduct && !this.isCacheValid()) {
        console.log('🔄 Cache miss or expired, loading from API...');
        
        try {
          await this.loadProductsCache();
          foundProduct = this.searchProductInCache(productCode);
        } catch (error) {
          console.log('⚠️ Cache load failed:', error.message);
          // Cache yüklenemezse direkt API'den ara (fallback)
          const response = await this.apiClient.get('/Products');
          
          if (response.success) {
            const products = response.data?.data || response.data;
            if (Array.isArray(products)) {
              foundProduct = products.find(p => {
                const productCodeField = p.code || p.productCode || p.Code || p.ProductCode;
                return productCodeField && productCodeField.toString().toUpperCase() === productCode;
              });
            }
          }
        }
      }

      return foundProduct;
    } catch (error) {
      console.error('❌ Product search error:', error);
      throw error;
    }
  }

  /**
   * Tek ürün API endpoint'i ile arama
   * @param {string} productCode - Aranacak ürün kodu
   * @returns {Promise<Object|null>} Bulunan ürün veya null
   */
  async searchProductByCode(productCode) {
    try {
      console.log(`🎯 Searching product by code endpoint: ${productCode}`);
      const response = await this.apiClient.get(`/Products/code/${encodeURIComponent(productCode)}`);
      
      if (!response.success) {
        return null; // Ürün bulunamadı
      }
      
      // Single product response
      let product = null;
      if (response.data) {
        product = response.data.data || response.data;
      }
      
      if (product) {
        console.log('✅ Product found via endpoint:', product);
        return product;
      }
      
      return null;
    } catch (error) {
      console.log('❌ Product endpoint search failed:', error.message);
      return null; // Endpoint hatası, cache'e fallback yapacağız
    }
  }

  /**
   * Ürünleri cache'e yükle
   * @returns {Promise<Array>} Ürün listesi
   */
  async loadProductsCache() {
    try {
      console.log('🔄 Loading products to cache...');
      const response = await this.apiClient.get('/Products');
      
      if (!response.success) {
        throw new Error(response.error || 'API çağrısı başarısız');
      }
      
      // API response formatını düzgün parse et
      let products = [];
      if (Array.isArray(response.data)) {
        products = response.data;
      } else if (response.data && Array.isArray(response.data.data)) {
        products = response.data.data; // Nested data structure
      } else if (response.data && response.data.success && Array.isArray(response.data.data)) {
        products = response.data.data;
      } else {
        console.error('❌ Unexpected API response format:', response);
        throw new Error('API\'den array formatında veri gelmiyor');
      }
      
      this.productsCache = products;
      this.cacheTimestamp = Date.now();
      
      console.log(`✅ Products cached: ${products.length} items`);
      
      // İlk 5 ürünün kod formatını debug için göster
      if (products.length > 0) {
        console.log('📋 Sample product codes:', products.slice(0, 5).map(p => ({
          id: p.id || p.Id,
          code: p.code || p.productCode || p.Code || p.ProductCode,
          name: p.name || p.productName || p.Name || p.ProductName,
          allFields: Object.keys(p)
        })));
      }
      
      return products;
    } catch (error) {
      console.error('❌ Products cache loading error:', error);
      throw error;
    }
  }

  /**
   * Cache'den ürün ara
   * @param {string} productCode - Aranacak ürün kodu
   * @returns {Object|null} Bulunan ürün veya null
   */
  searchProductInCache(productCode) {
    if (!this.productsCache) {
      console.log('❌ Cache is empty');
      return null;
    }
    
    console.log(`🔍 Searching for code: "${productCode}" in ${this.productsCache.length} products`);
    
    const foundProduct = this.productsCache.find(p => {
      const productCodeField = p.code || p.productCode || p.Code || p.ProductCode;
      const matches = productCodeField && productCodeField.toString().toUpperCase() === productCode.toUpperCase();
      
      if (matches) {
        console.log(`✅ Match found! Product code: "${productCodeField}" matches search: "${productCode}"`);
      }
      
      return matches;
    });
    
    if (!foundProduct) {
      // İlk 10 ürünün kodlarını göster
      console.log('❌ No match found. Available codes:', 
        this.productsCache.slice(0, 10).map(p => {
          const code = p.code || p.productCode || p.Code || p.ProductCode;
          return `"${code}"`;
        }).join(', ')
      );
    }
    
    return foundProduct;
  }

  /**
   * Cache'in güncel olup olmadığını kontrol et
   * @returns {boolean} Cache geçerli mi
   */
  isCacheValid() {
    return this.productsCache && this.cacheTimestamp && (Date.now() - this.cacheTimestamp) < this.cacheDuration;
  }

  /**
   * Bulunan ürün ID'sini döner
   * @returns {number|null} Ürün ID'si
   */
  getFoundProductId() {
    return this.foundProductId;
  }

  /**
   * Cache'i temizler
   */
  clearCache() {
    this.productsCache = null;
    this.cacheTimestamp = null;
    console.log('🗑️ Product input cache cleared');
  }

  /**
   * Component'i temizler
   */
  destroy() {
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
      this.searchTimeout = null;
    }
    this.clearCache();
    this.foundProductId = null;
  }
}

export default ProductInputComponent;