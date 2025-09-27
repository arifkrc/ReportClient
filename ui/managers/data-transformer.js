/**
 * Merkezi Data Transformer
 * API response parsing, data formatting ve payload hazırlama işlemlerini merkezileştir
 */

import { BUSINESS_CONFIG } from '../../config/app-config.js';

export class DataTransformer {
  
  /**
   * API Response işlemleri
   */
  static ApiResponse = {
    /**
     * Standardize API response
     */
    parse: (response, options = {}) => {
      const config = {
        expectArray: false,
        dataField: 'data',
        errorField: 'error',
        messageField: 'message',
        ...options
      };

      try {
        // Zaten parse edilmiş response
        if (response && typeof response === 'object' && response.success !== undefined) {
          return DataTransformer.ApiResponse._extractData(response, config);
        }

        // Raw string response
        if (typeof response === 'string') {
          try {
            const parsed = JSON.parse(response);
            return DataTransformer.ApiResponse._extractData(parsed, config);
          } catch {
            return {
              success: false,
              data: null,
              error: 'Invalid JSON response',
              raw: response
            };
          }
        }

        // Direct data
        return {
          success: true,
          data: response,
          error: null
        };

      } catch (error) {
        console.error('❌ ApiResponse.parse error:', error);
        return {
          success: false,
          data: null,
          error: error.message || 'Response parsing failed'
        };
      }
    },

    /**
     * Data extraction helper
     */
    _extractData: (response, config) => {
      // Success check
      const isSuccess = response.success === true || response.Success === true;
      
      if (!isSuccess) {
        return {
          success: false,
          data: null,
          error: response[config.errorField] || 
                 response[config.messageField] || 
                 'Request failed'
        };
      }

      // Data extraction
      let data = response[config.dataField] || response.Data || response.data || response;
      
      // Array validation
      if (config.expectArray && !Array.isArray(data)) {
        data = data ? [data] : [];
      }

      return {
        success: true,
        data: data,
        error: null
      };
    },

    /**
     * Error response oluştur
     */
    createError: (message, details = null) => ({
      success: false,
      data: null,
      error: message,
      details: details
    }),

    /**
     * Success response oluştur
     */
    createSuccess: (data, message = null) => ({
      success: true,
      data: data,
      error: null,
      message: message
    })
  };

  /**
   * Date formatting işlemleri
   */
  static Date = {
    /**
     * API'den gelen date string'i format et
     */
    formatApiDate: (dateString, format = 'datetime') => {
      if (!dateString) return '-';
      
      try {
        const date = new Date(dateString);
        
        if (isNaN(date.getTime())) {
          console.warn('Invalid date:', dateString);
          return dateString; // Fallback to original
        }

        const locale = 'tr-TR';
        
        switch (format) {
          case 'date':
            return date.toLocaleDateString(locale, {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric'
            });
            
          case 'time':
            return date.toLocaleTimeString(locale, {
              hour: '2-digit',
              minute: '2-digit'
            });
            
          case 'datetime':
            return date.toLocaleDateString(locale, {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric'
            }) + ' ' + date.toLocaleTimeString(locale, {
              hour: '2-digit',
              minute: '2-digit'
            });
            
          case 'relative':
            return DataTransformer.Date._getRelativeTime(date);
            
          default:
            return date.toLocaleString(locale);
        }
      } catch (error) {
        console.error('Date formatting error:', error);
        return dateString;
      }
    },

    /**
     * Relative time (2 saat önce, dün, vs.)
     */
    _getRelativeTime: (date) => {
      const now = new Date();
      const diffMs = now - date;
      const diffHours = diffMs / (1000 * 60 * 60);
      const diffDays = diffMs / (1000 * 60 * 60 * 24);

      if (diffHours < 1) return 'Az önce';
      if (diffHours < 24) return `${Math.floor(diffHours)} saat önce`;
      if (diffDays < 7) return `${Math.floor(diffDays)} gün önce`;
      
      return DataTransformer.Date.formatApiDate(date, 'date');
    },

    /**
     * Form için date input formatı
     */
    toInputFormat: (dateString) => {
      if (!dateString) return '';
      
      try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return '';
        
        return date.toISOString().split('T')[0]; // YYYY-MM-DD
      } catch {
        return '';
      }
    },

    /**
     * Bugünün tarihini form formatında al
     */
    getTodayInputFormat: () => {
      const today = new Date();
      return today.toISOString().split('T')[0];
    }
  };

  /**
   * Product data transformations
   */
  static Product = {
    /**
     * Form data'sını API payload'a dönüştür
     */
    formatPayload: (formData) => {
      return {
        productCode: (formData.productCode || '').toString().trim().toUpperCase(),
        name: (formData.name || '').toString().trim(),
        type: (formData.type || '').toString().trim(),
        description: (formData.description || '').toString().trim(),
        lastOperationId: formData.lastOperationId 
          ? parseInt(formData.lastOperationId) 
          : null
      };
    },

    /**
     * API response'u UI formatına dönüştür
     */
    formatForUI: (productData) => {
      return {
        ...productData,
        displayName: `${productData.productCode} - ${productData.name}`,
        typeInfo: DataTransformer.Product.getTypeInfo(productData.type),
        lastOperationDisplay: productData.lastOperationName 
          ? `${productData.lastOperationName} (${productData.lastOperationShortCode || ''})`
          : '-',
        addedDateFormatted: DataTransformer.Date.formatApiDate(productData.addedDateTime),
        statusBadge: DataTransformer.Product.getStatusBadge(productData.isActive)
      };
    },

    /**
     * Product type bilgisini al
     */
    getTypeInfo: (typeCode) => {
      return Object.values(BUSINESS_CONFIG.PRODUCT_TYPES)
        .find(type => type.code === typeCode) || { 
          code: typeCode, 
          color: 'gray' 
        };
    },

    /**
     * Status badge HTML
     */
    getStatusBadge: (isActive) => {
      const className = isActive 
        ? 'px-2 py-1 rounded text-xs bg-green-600 text-white'
        : 'px-2 py-1 rounded text-xs bg-red-600 text-white';
      const text = isActive ? 'Aktif' : 'Pasif';
      
      return `<span class="${className}">${text}</span>`;
    },

    /**
     * Product code validation
     */
    validateProductCode: (productCode, productType = null) => {
      if (!productCode || productCode.length < 3) {
        return {
          isValid: false,
          error: 'Ürün kodu en az 3 karakter olmalıdır'
        };
      }

      const cleaned = productCode.toString().trim().toUpperCase();
      
      if (!/^[A-Z0-9]+$/.test(cleaned)) {
        return {
          isValid: false,
          error: 'Ürün kodu sadece harf ve rakam içerebilir'
        };
      }

      // Type uyumluluğu kontrolü
      if (productType && cleaned.length >= 3) {
        const expectedType = DataTransformer.Product.getTypeFromCode(cleaned);
        if (expectedType && expectedType.code !== productType) {
          return {
            isValid: false,
            error: `Kod "${cleaned}" için beklenen tip "${expectedType.code}", girilen "${productType}"`,
            warning: true
          };
        }
      }

      return { isValid: true };
    },

    /**
     * Ürün kodundan tip çıkar
     */
    getTypeFromCode: (productCode) => {
      if (!productCode || productCode.length < 3) return null;
      
      const thirdDigit = productCode.charAt(2);
      return Object.values(BUSINESS_CONFIG.PRODUCT_TYPES)
        .find(type => type.codeDigit === thirdDigit) || null;
    }
  };

  /**
   * Operation data transformations
   */
  static Operation = {
    /**
     * Form data'sını API payload'a dönüştür
     */
    formatPayload: (formData) => {
      return {
        name: (formData.operasyonAdi || formData.name || '').toString().trim(),
        shortCode: (formData.operasyonKodu || formData.shortCode || '').toString().trim().toUpperCase()
      };
    },

    /**
     * API response'u UI formatına dönüştür
     */
    formatForUI: (operationData) => {
      return {
        ...operationData,
        displayName: `${operationData.shortCode} - ${operationData.name}`,
        addedDateFormatted: DataTransformer.Date.formatApiDate(operationData.addedDateTime),
        statusBadge: DataTransformer.Product.getStatusBadge(operationData.isActive) // Aynı badge kullan
      };
    },

    /**
     * Operation code validation
     */
    validateOperationCode: (operationCode) => {
      if (!operationCode) {
        return {
          isValid: false,
          error: 'Operasyon kodu zorunludur'
        };
      }

      const cleaned = operationCode.toString().trim().toUpperCase();
      
      if (cleaned.length > 10) {
        return {
          isValid: false,
          error: 'Operasyon kodu en fazla 10 karakter olabilir'
        };
      }

      if (!/^[A-Z0-9]+$/.test(cleaned)) {
        return {
          isValid: false,
          error: 'Operasyon kodu sadece harf ve rakam içerebilir'
        };
      }

      return { isValid: true };
    }
  };

  /**
   * Table data transformations
   */
  static Table = {
    /**
     * API data'sını table formatına dönüştür
     */
    formatForTable: (data, columns) => {
      if (!Array.isArray(data)) return [];

      return data.map(row => {
        const formattedRow = { ...row };
        
        columns.forEach(column => {
          const value = row[column.field];
          
          // Date formatting
          if (column.field.includes('Date') || column.field.includes('date')) {
            formattedRow[`${column.field}Formatted`] = 
              DataTransformer.Date.formatApiDate(value);
          }
          
          // Status formatting
          if (column.field === 'isActive') {
            formattedRow.statusBadge = DataTransformer.Product.getStatusBadge(value);
          }
        });

        return formattedRow;
      });
    },

    /**
     * Search için data normalize et
     */
    normalizeForSearch: (data, searchFields) => {
      if (!Array.isArray(data)) return [];

      return data.map(row => {
        const searchText = searchFields
          .map(field => (row[field] || '').toString().toLowerCase())
          .join(' ');
        
        return {
          ...row,
          _searchText: searchText
        };
      });
    },

    /**
     * Sort için data prepare et
     */
    prepareForSort: (data, sortField, sortDirection = 'asc') => {
      if (!Array.isArray(data)) return [];

      return [...data].sort((a, b) => {
        let valueA = a[sortField];
        let valueB = b[sortField];

        // String değerler için lowercase
        if (typeof valueA === 'string') valueA = valueA.toLowerCase();
        if (typeof valueB === 'string') valueB = valueB.toLowerCase();

        // Date değerler için timestamp
        if (sortField.includes('Date') || sortField.includes('date')) {
          valueA = new Date(valueA).getTime() || 0;
          valueB = new Date(valueB).getTime() || 0;
        }

        if (valueA < valueB) return sortDirection === 'asc' ? -1 : 1;
        if (valueA > valueB) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
    }
  };

  /**
   * Generic utilities
   */
  static Utils = {
    /**
     * Deep clone object
     */
    deepClone: (obj) => {
      try {
        return JSON.parse(JSON.stringify(obj));
      } catch {
        return obj;
      }
    },

    /**
     * Clean form data (trim strings, convert types)
     */
    cleanFormData: (formData) => {
      const cleaned = {};
      
      Object.keys(formData).forEach(key => {
        let value = formData[key];
        
        // String cleanup
        if (typeof value === 'string') {
          value = value.trim();
        }
        
        // Number conversion
        if (key.includes('Id') && value !== '' && !isNaN(value)) {
          value = parseInt(value);
        }
        
        // Boolean conversion
        if (value === 'true') value = true;
        if (value === 'false') value = false;
        
        cleaned[key] = value;
      });
      
      return cleaned;
    },

    /**
     * Filter null/undefined/empty values
     */
    removeEmpty: (obj) => {
      const cleaned = {};
      
      Object.keys(obj).forEach(key => {
        const value = obj[key];
        if (value !== null && value !== undefined && value !== '') {
          cleaned[key] = value;
        }
      });
      
      return cleaned;
    },

    /**
     * Format file size
     */
    formatFileSize: (bytes) => {
      if (bytes === 0) return '0 Bytes';
      
      const k = 1024;
      const sizes = ['Bytes', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
  };
}

// Default export
export default DataTransformer;