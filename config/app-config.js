/**
 * Uygulama Konfigürasyonu
 * Tüm sabit değerler ve ayarlar burada merkezi olarak yönetiliyor
 */

// API Configuration
export const API_CONFIG = {
  BASE_URL: 'https://localhost:7287/api',
  TIMEOUT: 30000, // 30 saniye
  RETRY_COUNT: 3,
  
  // Endpoint paths
  ENDPOINTS: {
    // Products
    PRODUCTS: '/Products',
    PRODUCTS_BY_ID: '/Products/{id}',
    PRODUCTS_ACTIVATE: '/Products/{id}/activate',
    PRODUCTS_DEACTIVATE: '/Products/{id}/deactivate',
    
    // Operations
    OPERATIONS: '/Operations',
    OPERATIONS_BY_ID: '/Operations/{id}',
    OPERATIONS_ENTRY: '/Operations/entry',
    OPERATIONS_ACTIVATE: '/Operations/{id}/activate',
    OPERATIONS_DEACTIVATE: '/Operations/{id}/deactivate',
    OPERATIONS_TYPES: '/OperationType',
    
    // Cycle Times
    CYCLE_TIMES: '/CycleTimes',
    CYCLE_TIMES_BY_ID: '/CycleTimes/{id}',
    
    // Orders
    ORDERS: '/Orders',
    ORDERS_BY_ID: '/Orders/{id}',
    ORDERS_ACTIVATE: '/Orders/{id}/activate',
    ORDERS_DEACTIVATE: '/Orders/{id}/deactivate',
    
    // Other endpoints (legacy)
    PRODUCTION: '/uretim',
    PACKAGING: '/paketleme'
  }
};

// Cache Configuration
export const CACHE_CONFIG = {
  OPERATIONS_DURATION: 5 * 60 * 1000, // 5 dakika
  PRODUCTS_DURATION: 2 * 60 * 1000,   // 2 dakika
  DEFAULT_DURATION: 1 * 60 * 1000     // 1 dakika
};

// UI Configuration
export const UI_CONFIG = {
  // Table settings
  TABLE: {
    DEFAULT_PAGE_SIZE: 20,
    PAGE_SIZE_OPTIONS: [10, 20, 50, 100, 'all'],
    MAX_ROWS_FOR_ALL: 1000
  },
  
  // Toast notifications
  TOAST: {
    DURATION: 4000, // 4 saniye
    POSITIONS: {
      BOTTOM_RIGHT: 'bottom-6 right-6',
      TOP_RIGHT: 'top-6 right-6',
      BOTTOM_LEFT: 'bottom-6 left-6'
    },
    DEFAULT_POSITION: 'bottom-6 right-6'
  },
  
  // Form settings
  FORM: {
    AUTO_SAVE_DELAY: 1000, // 1 saniye
    VALIDATION_DELAY: 300   // 300ms
  },
  
  // Animation settings
  ANIMATION: {
    FAST: 150,
    NORMAL: 300,
    SLOW: 500
  }
};

// Business Logic Configuration
export const BUSINESS_CONFIG = {
  // Product codes
  PRODUCT_TYPES: {
    DISK: { code: 'DİSK', name: 'Disk', codeDigit: '1', color: 'blue' },
    KAMPANA: { code: 'KAMPANA', name: 'Kampana', codeDigit: '2', color: 'green' },
    POYRA: { code: 'POYRA', name: 'Poyra', codeDigit: '4', color: 'orange' }
  },
  
  // Validation rules
  VALIDATION: {
    PRODUCT_CODE_MIN_LENGTH: 3,
    OPERATION_CODE_MAX_LENGTH: 10,
    MAX_DESCRIPTION_LENGTH: 500
  },
  
  // Default values
  DEFAULTS: {
    SHIFT_OPTIONS: ['1 00-08', '2 08-16', '3 16-24'],
    TIME_FORMAT: 'HH:mm',
    DATE_FORMAT: 'DD.MM.YYYY'
  }
};

// Environment Detection
export const ENV_CONFIG = {
  isDevelopment: () => {
    try {
      return process.env.NODE_ENV === 'development' || 
             window.location.hostname === 'localhost' ||
             window.location.hostname === '127.0.0.1';
    } catch {
      return true; // Default to development in Electron
    }
  },
  
  isProduction: () => !ENV_CONFIG.isDevelopment(),
  
  // Debug settings
  DEBUG: {
    API_LOGGING: true,
    PERFORMANCE_LOGGING: false,
    CACHE_LOGGING: true
  }
};

// Utility functions for config
export const ConfigUtils = {
  /**
   * URL'de placeholder'ları değiştir
   * Example: '/Products/{id}' + {id: 123} = '/Products/123'
   */
  interpolateEndpoint: (endpoint, params = {}) => {
    let result = endpoint;
    Object.keys(params).forEach(key => {
      result = result.replace(`{${key}}`, params[key]);
    });
    return result;
  },

  /**
   * Full API URL oluştur
   */
  getFullApiUrl: (endpoint, params = {}) => {
    const interpolated = ConfigUtils.interpolateEndpoint(endpoint, params);
    return API_CONFIG.BASE_URL + interpolated;
  },

  /**
   * Product type bilgisini product code'dan çıkar
   */
  getProductTypeFromCode: (productCode) => {
    if (!productCode || productCode.length < 3) return null;
    const thirdDigit = productCode.charAt(2);
    
    return Object.values(BUSINESS_CONFIG.PRODUCT_TYPES)
      .find(type => type.codeDigit === thirdDigit) || null;
  },

  /**
   * Environment değişkenine göre config değeri al
   */
  getConfigByEnv: (devValue, prodValue) => {
    return ENV_CONFIG.isDevelopment() ? devValue : prodValue;
  }
};

// Named export as APP_CONFIG
export const APP_CONFIG = {
  API: API_CONFIG,
  CACHE: CACHE_CONFIG,
  UI: UI_CONFIG,
  BUSINESS: BUSINESS_CONFIG,
  ENV: ENV_CONFIG,
  Utils: ConfigUtils
};

// Default export olarak tüm config
export default APP_CONFIG;