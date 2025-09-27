/**
 * Merkezi API Client
 * Tüm HTTP çağrıları için standardize edilmiş interface
 */
export class ApiClient {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
    this.defaultHeaders = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };
    
    // HTTPS localhost için SSL ignore
    this.isHttps = baseUrl.startsWith('https://');
    this.isLocalhost = baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1');
    
    console.log(`🔧 ApiClient initialized: ${baseUrl} (HTTPS: ${this.isHttps}, Localhost: ${this.isLocalhost})`);
  }

  /**
   * GET request
   */
  async get(endpoint, options = {}) {
    return this._request('GET', endpoint, null, options);
  }

  // In report-only mode, disable write operations to prevent accidental POST/PUT/PATCH/DELETE
  _disabledWriteResponse() {
    return {
      success: false,
      error: 'write operations disabled: report-only client',
      status: 405
    };
  }

  /**
   * POST request
   */
  async post(endpoint, data = null, options = {}) {
    return this._disabledWriteResponse();
  }

  /**
   * PUT request
   */
  async put(endpoint, data = null, options = {}) {
    return this._disabledWriteResponse();
  }

  /**
   * DELETE request
   */
  async delete(endpoint, options = {}) {
    return this._disabledWriteResponse();
  }

  /**
   * PATCH request
   */
  async patch(endpoint, data = null, options = {}) {
    return this._disabledWriteResponse();
  }

  /**
   * Internal request handler with retry logic
   */
  async _request(method, endpoint, data = null, options = {}) {
    const url = this._buildUrl(endpoint);
    const config = this._buildRequestConfig(method, data, options);
    
    // Retry configuration
    const maxRetries = options.retries || 3;
    const retryDelay = options.retryDelay || 1000; // 1 second base delay

    let lastError = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // Log request (only on first attempt to avoid spam)
        if (attempt === 0) {
          console.log(`🔄 ${method} ${url}${data ? '\n📤 PAYLOAD: ' + JSON.stringify(data, null, 2) : ''}`);
        } else {
          console.log(`🔄 Retry ${attempt}/${maxRetries}: ${method} ${url}`);
        }
        
        const response = await fetch(url, config);
        
        console.log(`📥 ${method} ${url} - Status: ${response.status} ${response.statusText} (Attempt: ${attempt + 1})`);

        // Response body'yi oku
        const responseText = await response.text();
        let responseData = null;

        // JSON parse et (eğer boş değilse)
        if (responseText) {
          try {
            responseData = JSON.parse(responseText);
          } catch (parseError) {
            console.warn('⚠️ Response JSON parse hatası, raw text döndürülüyor:', parseError);
            responseData = responseText;
          }
        }

        // Başarılı response
        if (response.ok) {
          if (attempt > 0) {
            console.log(`✅ ${method} SUCCESS after ${attempt} retries:`, responseData);
          } else {
            console.log(`✅ ${method} SUCCESS:`, responseData);
          }
          return {
            success: true,
            data: responseData,
            status: response.status,
            statusText: response.statusText
          };
        }

        // 5xx server errors - retry yapılabilir
        if (response.status >= 500 && attempt < maxRetries) {
          console.warn(`⚠️ Server error ${response.status}, retrying in ${retryDelay * (attempt + 1)}ms...`);
          await this._delay(retryDelay * (attempt + 1)); // Exponential backoff
          continue;
        }

        // 4xx client errors - retry yapma, direkt fail
        console.error(`❌ ${method} ERROR - ${response.status} ${response.statusText}:`, responseData);
        
        return {
          success: false,
          error: responseData || `HTTP ${response.status} ${response.statusText}`,
          status: response.status,
          statusText: response.statusText
        };

      } catch (error) {
        lastError = error;
        
        // Network error - retry yapılabilir
        if (attempt < maxRetries) {
          console.warn(`⚠️ Network error, retrying in ${retryDelay * (attempt + 1)}ms:`, error.message);
          await this._delay(retryDelay * (attempt + 1));
          continue;
        }

        // Max retry'a ulaşıldı
        console.error(`💥 ${method} NETWORK ERROR after ${maxRetries} retries:`, error);
        return {
          success: false,
          error: error.message || 'Network error occurred',
          networkError: true
        };
      }
    }

    // Buraya ulaşılmamalı ama güvenlik için
    return {
      success: false,
      error: lastError?.message || 'Unknown error occurred',
      networkError: true
    };
  }

  /**
   * Utility function for delays
   */
  async _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * URL builder
   */
  _buildUrl(endpoint) {
    // Endpoint zaten tam URL ise direkt kullan
    if (endpoint.startsWith('http')) {
      return endpoint;
    }

    // Slash kontrolü
    const cleanBase = this.baseUrl.endsWith('/') ? this.baseUrl.slice(0, -1) : this.baseUrl;
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : '/' + endpoint;
    
    return cleanBase + cleanEndpoint;
  }

  /**
   * Request config builder
   */
  _buildRequestConfig(method, data, options) {
    const config = {
      method,
      headers: { ...this.defaultHeaders, ...(options.headers || {}) },
      ...options
    };

    // HTTPS localhost için SSL ignore (Electron ortamında)
    if (this.isHttps && this.isLocalhost && typeof window !== 'undefined' && window.process?.type === 'renderer') {
      config.agent = false; // Electron renderer process'te agent kullanma
    }

    // Body ekle (GET ve DELETE hariç)
    if (data && !['GET', 'HEAD'].includes(method)) {
      if (typeof data === 'string') {
        config.body = data;
      } else {
        config.body = JSON.stringify(data);
      }
    }

    return config;
  }

  /**
   * Base URL değiştir
   */
  setBaseUrl(newBaseUrl) {
    this.baseUrl = newBaseUrl;
  }

  /**
   * Default header ekle/güncelle
   */
  setHeader(key, value) {
    this.defaultHeaders[key] = value;
  }

  /**
   * Default header sil
   */
  removeHeader(key) {
    delete this.defaultHeaders[key];
  }
}

/**
 * Response helper functions
 */
export const ApiResponseHelpers = {
  /**
   * API response'dan data çıkar (standardize)
   */
  extractData: (response) => {
    if (!response.success) {
      throw new Error(response.error || 'API request failed');
    }

    // Eğer response.data bir object ise ve success/data pattern'i varsa
    if (response.data && typeof response.data === 'object') {
      if (response.data.success !== undefined) {
        return response.data.success ? (response.data.data || response.data) : response.data;
      }
    }

    return response.data;
  },

  /**
   * API response'u kontrol et
   */
  isSuccess: (response) => {
    return response && response.success === true;
  },

  /**
   * Error mesajını çıkar
   */
  getErrorMessage: (response) => {
    if (typeof response.error === 'string') {
      return response.error;
    }
    if (response.error && response.error.message) {
      return response.error.message;
    }
    return 'Unknown error occurred';
  }
};

// Default instance (global kullanım için)
export let defaultApiClient = null;

export function createDefaultApiClient(baseUrl) {
  defaultApiClient = new ApiClient(baseUrl);
  return defaultApiClient;
}

export function getDefaultApiClient() {
  if (!defaultApiClient) {
    throw new Error('Default API client not initialized. Call createDefaultApiClient first.');
  }
  return defaultApiClient;
}

// Default export
export default ApiClient;