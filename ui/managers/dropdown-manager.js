/**
 * Merkezi Dropdown Yöneticisi
 * Dropdown'ların dinamik yüklenmesi ve cache yönetimi
 */

import { APP_CONFIG } from '../../config/app-config.js';

class DropdownCache {
  constructor() {
    this.cache = new Map();
    this.timestamps = new Map();
  }

  set(key, data, duration = APP_CONFIG.CACHE.DEFAULT_DURATION) {
    this.cache.set(key, data);
    this.timestamps.set(key, Date.now() + duration);
    console.log(`📦 Cache set: ${key} (${data.length} items, ${duration}ms TTL)`);
  }

  get(key) {
    const timestamp = this.timestamps.get(key);
    if (!timestamp || Date.now() > timestamp) {
      this.delete(key);
      return null;
    }
    
    const data = this.cache.get(key);
    console.log(`🎯 Cache hit: ${key} (${data ? data.length : 0} items)`);
    return data;
  }

  delete(key) {
    this.cache.delete(key);
    this.timestamps.delete(key);
    console.log(`🗑️ Cache deleted: ${key}`);
  }

  clear() {
    this.cache.clear();
    this.timestamps.clear();
    console.log('🗑️ Cache cleared completely');
  }

  getInfo() {
    const info = {};
    for (const [key] of this.cache) {
      const timestamp = this.timestamps.get(key);
      info[key] = {
        size: this.cache.get(key)?.length || 0,
        expiresAt: new Date(timestamp),
        isValid: timestamp && Date.now() <= timestamp
      };
    }
    return info;
  }
}

export class DropdownManager {
  constructor(apiClient = null) {
    this.apiClient = apiClient; // Opsiyonel - sadece API çağrıları için gerekli
    this.cache = new DropdownCache();
  }

  /**
   * Operations dropdown'ını yükle
   */
  async loadOperations(selectElement, options = {}) {
    const config = {
      includeEmpty: true,
      emptyText: 'Operasyon seçiniz...',
      showCode: true,
      activeOnly: true,
      ...options
    };

    try {
      const cacheKey = `operations_${config.activeOnly ? 'active' : 'all'}`;
      let operations = this.cache.get(cacheKey);

      if (!operations) {
        if (!this.apiClient) {
          throw new Error('API client not provided for operations loading');
        }
        
        console.log('🔄 Loading operations from API...');
        
        const endpoint = config.activeOnly 
          ? `${APP_CONFIG.API.ENDPOINTS.OPERATIONS}?status=active`
          : APP_CONFIG.API.ENDPOINTS.OPERATIONS;
        
        console.log('🔗 Operations API Request:');
        console.log('   Base URL:', this.apiClient.baseURL);
        console.log('   Endpoint:', endpoint);
        console.log('   Full URL:', this.apiClient.baseURL + endpoint);
        
        const response = await this.apiClient.get(endpoint);
        
        if (!response.success) {
          throw new Error(response.error || 'Operations yüklenemedi');
        }

        // Response data extraction
        operations = Array.isArray(response.data) 
          ? response.data 
          : (response.data?.data || []);

        // Cache'e kaydet
        this.cache.set(cacheKey, operations, APP_CONFIG.CACHE.OPERATIONS_DURATION);
      }

      // Select element'i doldur
      this.populateSelect(selectElement, operations, {
        valueField: 'id',
        textFormat: config.showCode 
          ? (item) => `${item.name} (${item.shortCode || item.id})`
          : (item) => item.name,
        ...config
      });

      console.log(`✅ Operations loaded: ${operations.length} items`);
      return operations;

    } catch (error) {
      console.error('❌ Operations loading error:', error);
      
      // Error durumunda fallback
      this.populateSelect(selectElement, [], {
        includeEmpty: true,
        emptyText: 'Operasyon yüklenemedi',
        ...config
      });
      
      throw error;
    }
  }

  /**
   * Product types dropdown'ını yükle (static data)
   */
  async loadProductTypes(selectElement, options = {}) {
    const config = {
      includeEmpty: true,
      emptyText: 'Seçiniz...',
      ...options
    };

    const productTypes = Object.values(BUSINESS_CONFIG.PRODUCT_TYPES).map(type => ({
      id: type.code,
      name: type.code,
      code: type.code
    }));

    this.populateSelect(selectElement, productTypes, {
      valueField: 'code',
      textFormat: (item) => item.name,
      ...config
    });

    console.log(`✅ Product types loaded: ${productTypes.length} items`);
    return productTypes;
  }

  /**
   * Shift options dropdown'ını yükle (static data)
   */
  async loadShiftOptions(selectElement, options = {}) {
    const config = {
      includeEmpty: false,
      ...options
    };

    const shifts = BUSINESS_CONFIG.DEFAULTS.SHIFT_OPTIONS.map((shift, index) => ({
      id: shift,
      name: shift,
      value: shift
    }));

    this.populateSelect(selectElement, shifts, {
      valueField: 'value',
      textFormat: (item) => item.name,
      ...config
    });

    console.log(`✅ Shift options loaded: ${shifts.length} items`);
    return shifts;
  }

  /**
   * Generic method - herhangi bir endpoint'ten data yükle
   */
  async loadFromEndpoint(selectElement, endpoint, options = {}) {
    const config = {
      includeEmpty: true,
      emptyText: 'Seçiniz...',
      valueField: 'id',
      textField: 'name',
      cacheKey: endpoint,
      cacheDuration: APP_CONFIG.CACHE.DEFAULT_DURATION,
      ...options
    };

    try {
      let data = this.cache.get(config.cacheKey);

      if (!data) {
        console.log(`🔄 Loading data from ${endpoint}...`);
        
        const response = await this.apiClient.get(endpoint);
        
        if (!response.success) {
          throw new Error(response.error || 'Data yüklenemedi');
        }

        data = Array.isArray(response.data) 
          ? response.data 
          : (response.data?.data || []);

        this.cache.set(config.cacheKey, data, config.cacheDuration);
      }

      this.populateSelect(selectElement, data, config);

      console.log(`✅ Data loaded from ${endpoint}: ${data.length} items`);
      return data;

    } catch (error) {
      console.error(`❌ Error loading from ${endpoint}:`, error);
      
      this.populateSelect(selectElement, [], {
        includeEmpty: true,
        emptyText: 'Yüklenemedi',
        ...config
      });
      
      throw error;
    }
  }

  /**
   * Select element'i doldur
   */
  populateSelect(selectElement, data, config) {
    if (!selectElement) {
      console.error('❌ Select element not found');
      return;
    }

    // Clear existing options
    selectElement.innerHTML = '';

    // Empty option ekle
    if (config.includeEmpty) {
      const emptyOption = document.createElement('option');
      emptyOption.value = '';
      emptyOption.textContent = config.emptyText || 'Seçiniz...';
      selectElement.appendChild(emptyOption);
    }

    // Data options ekle
    data.forEach(item => {
      const option = document.createElement('option');
      option.value = item[config.valueField] || item.id;
      
      // Text format
      if (config.textFormat && typeof config.textFormat === 'function') {
        option.textContent = config.textFormat(item);
      } else if (config.textField) {
        option.textContent = item[config.textField];
      } else {
        option.textContent = item.name || item.toString();
      }

      // Additional attributes
      if (item.code) option.dataset.code = item.code;
      if (item.color) option.dataset.color = item.color;

      selectElement.appendChild(option);
    });

    // Selected value varsa set et
    if (config.selectedValue !== undefined) {
      selectElement.value = config.selectedValue;
    }

    console.log(`📝 Select populated: ${data.length} options`);
  }

  /**
   * Dropdown'ı refresh et (cache'i bypassla)
   */
  async refreshDropdown(selectElement, loaderFunction, options = {}) {
    try {
      // İlgili cache'i temizle
      if (options.cacheKey) {
        this.cache.delete(options.cacheKey);
      }

      // Yeniden yükle
      return await loaderFunction(selectElement, options);
    } catch (error) {
      console.error('❌ Dropdown refresh error:', error);
      throw error;
    }
  }

  /**
   * Cache bilgilerini al
   */
  getCacheInfo() {
    return this.cache.getInfo();
  }

  /**
   * Cache'i temizle
   */
  clearCache(key = null) {
    if (key) {
      this.cache.delete(key);
    } else {
      this.cache.clear();
    }
  }

  /**
   * Product Types dropdown'ını populate et
   */
  async populateProductTypes(selectElement, options = {}) {
    return await this.loadFromConfig(selectElement, 'productTypes', {
      emptyText: 'Ürün tipi seçiniz...',
      valueField: 'code',
      textField: 'name',
      ...options
    });
  }

  /**
   * Operations dropdown'ını populate et  
   */
  async populateOperations(selectElement, options = {}) {
    return await this.loadOperations(selectElement, {
      emptyText: 'Operasyon seçiniz...',
      showCode: true,
      ...options
    });
  }

  /**
   * Config'den dropdown populate et
   */
  async loadFromConfig(selectElement, configKey, options = {}) {
    const config = {
      includeEmpty: true,
      emptyText: 'Seçiniz...',
      valueField: 'id',
      textField: 'name',
      ...options
    };

    try {
      // Config'den data al
      let data = [];
      
      if (configKey === 'productTypes') {
        data = Object.values(APP_CONFIG.BUSINESS.PRODUCT_TYPES);
      } else {
        throw new Error(`Unknown config key: ${configKey}`);
      }

      // Populate
      this.populateSelect(selectElement, data, config);

      console.log(`✅ Config dropdown populated: ${configKey}, ${data.length} items`);
      return data;
    } catch (error) {
      console.error(`❌ Config dropdown error [${configKey}]:`, error);
      
      // Fallback
      if (config.includeEmpty) {
        selectElement.innerHTML = `<option value="">${config.fallbackText || 'Yüklenemedi'}</option>`;
      }
      
      throw error;
    }
  }
}

// Singleton instance
let defaultDropdownManager = null;

export function createDefaultDropdownManager(apiClient = null) {
  defaultDropdownManager = new DropdownManager(apiClient);
  return defaultDropdownManager;
}

export function getDefaultDropdownManager() {
  if (!defaultDropdownManager) {
    defaultDropdownManager = new DropdownManager();
  }
  return defaultDropdownManager;
}

// Utility functions
export const DropdownUtils = {
  /**
   * Select element'te seçili değeri al
   */
  getSelectedValue: (selectElement) => {
    return selectElement ? selectElement.value : null;
  },

  /**
   * Select element'te seçili item'ın data attribute'larını al
   */
  getSelectedData: (selectElement) => {
    if (!selectElement || !selectElement.selectedOptions[0]) {
      return null;
    }

    const option = selectElement.selectedOptions[0];
    return {
      value: option.value,
      text: option.textContent,
      code: option.dataset.code,
      color: option.dataset.color,
      ...option.dataset
    };
  },

  /**
   * Select element'i disable/enable et
   */
  setEnabled: (selectElement, enabled) => {
    if (selectElement) {
      selectElement.disabled = !enabled;
    }
  },

  /**
   * Loading state göster
   */
  showLoading: (selectElement, text = 'Yükleniyor...') => {
    if (selectElement) {
      selectElement.innerHTML = `<option value="">${text}</option>`;
      selectElement.disabled = true;
    }
  }
};

// Default export
export default DropdownManager;