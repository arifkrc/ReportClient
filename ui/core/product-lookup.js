/**
 * Product Lookup Service
 * Ürün kodu ile ürün ID ve isim bilgilerini getiren merkezi servis
 */

import ApiClient from './api-client.js';
import { APP_CONFIG } from '../../config/app-config.js';

class ProductLookupService {
  constructor() {
    this.apiClient = new ApiClient(APP_CONFIG.API.BASE_URL);
    this.cache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 dakika cache
  }

  /**
   * Ürün koduna göre ürün bilgilerini getirir
   * @param {string} productCode - Ürün kodu
   * @returns {Promise<{id: number, name: string, productCode: string, type: string} | null>}
   */
  async getProductByCode(productCode) {
    if (!productCode || typeof productCode !== 'string') {
      return null;
    }

    const normalizedCode = productCode.trim().toUpperCase();
    
    // Cache kontrolü
    const cached = this.cache.get(normalizedCode);
    if (cached && (Date.now() - cached.timestamp) < this.cacheTimeout) {
      console.log(`📦 Product cache hit for: ${normalizedCode}`);
      return cached.data;
    }

    try {
      console.log(`🔍 Looking up product: ${normalizedCode}`);
      
      // API'den tüm ürünleri al ve filtrele
      const response = await this.apiClient.get('/Products');
      console.log('🔍 API Response structure:', {
        success: response.success,
        hasData: !!response.data,
        isArray: Array.isArray(response),
        responseType: typeof response,
        dataType: response.data ? typeof response.data : 'undefined',
        dataIsArray: response.data ? Array.isArray(response.data) : false
      });
      
      let products = [];
      if (response.success && Array.isArray(response.data)) {
        products = response.data;
      } else if (Array.isArray(response)) {
        products = response;
      }

      console.log(`🔍 Total products loaded: ${products.length}`);
      
      // İlk birkaç ürünü log'a yazdır
      if (products.length > 0) {
        console.log('🔍 Sample products:', products.slice(0, 3).map(p => ({
          id: p.id,
          productCode: p.productCode,
          name: p.name
        })));
      }

      // Aradığımız ürün koduna benzer kodları bul
      const similarCodes = products
        .filter(p => p.productCode && p.productCode.includes(normalizedCode.substring(0, 4)))
        .map(p => p.productCode)
        .slice(0, 5);
      
      if (similarCodes.length > 0) {
        console.log(`🔍 Similar product codes found: ${similarCodes.join(', ')}`);
      }

      // Ürün koduna göre filtrele
      const product = products.find(p => 
        p.productCode && p.productCode.toUpperCase() === normalizedCode
      );

      if (product) {
        const result = {
          id: product.id,
          name: product.name,
          productCode: product.productCode,
          type: product.type
        };

        // Cache'e kaydet
        this.cache.set(normalizedCode, {
          data: result,
          timestamp: Date.now()
        });

        console.log(`✅ Product found: ${result.name} (ID: ${result.id})`);
        return result;
      } else {
        console.log(`❌ Product not found: ${normalizedCode}`);
        return null;
      }

    } catch (error) {
      console.error('❌ Product lookup error:', error);
      return null;
    }
  }

  /**
   * Birden fazla ürün kodunu toplu olarak getirir
   * @param {string[]} productCodes - Ürün kodları array'i
   * @returns {Promise<Map<string, {id: number, name: string, productCode: string, type: string}>>}
   */
  async getProductsByCodes(productCodes) {
    const results = new Map();
    
    for (const code of productCodes) {
      const product = await this.getProductByCode(code);
      if (product) {
        results.set(code.trim().toUpperCase(), product);
      }
    }

    return results;
  }

  /**
   * Cache'i temizler
   */
  clearCache() {
    this.cache.clear();
    console.log('🗑️ Product lookup cache cleared');
  }

  /**
   * Ürün kodu ile ilgili validasyonlar
   */
  validateProductCode(productCode) {
    if (!productCode) {
      return { isValid: false, error: 'Ürün kodu gerekli' };
    }

    const normalized = productCode.trim().toUpperCase();
    
    if (normalized.length < 3) {
      return { isValid: false, error: 'Ürün kodu en az 3 karakter olmalı' };
    }

    // Ürün kodu format kontrolleri
    if (!/^[A-Z0-9]+$/.test(normalized)) {
      return { isValid: false, error: 'Ürün kodu sadece harf ve rakam içermeli' };
    }

    return { isValid: true, productCode: normalized };
  }
}

// Singleton instance
const productLookupService = new ProductLookupService();

export default productLookupService;

// Backward compatibility için global fonksiyonlar
window.getProductByCode = (productCode) => productLookupService.getProductByCode(productCode);
window.getProductsByCodes = (productCodes) => productLookupService.getProductsByCodes(productCodes);