/**
 * Merkezi Validation Engine
 * Tüm validation rules'ları ve business logic'i merkezileştir
 */

import { APP_CONFIG } from '../../config/app-config.js';
import DataTransformer from '../managers/data-transformer.js';

export class ValidationEngine {
  constructor() {
    this.rules = new Map();
    this.customValidators = new Map();
    this.schemas = new Map();
    
    // Built-in rules'ları yükle
    this._loadBuiltInRules();
  }

  /**
   * Built-in validation rules
   */
  _loadBuiltInRules() {
    // Basic rules
    this.addRule('required', {
      validate: (value) => value !== null && value !== undefined && value.toString().trim() !== '',
      message: 'Bu alan zorunludur'
    });

    this.addRule('email', {
      validate: (value) => !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
      message: 'Geçerli bir email adresi giriniz'
    });

    this.addRule('numeric', {
      validate: (value) => !value || !isNaN(value),
      message: 'Sayısal değer giriniz'
    });

    this.addRule('integer', {
      validate: (value) => !value || Number.isInteger(Number(value)),
      message: 'Tam sayı giriniz'
    });

    this.addRule('positive', {
      validate: (value) => !value || Number(value) > 0,
      message: 'Pozitif sayı giriniz'
    });

    // String rules
    this.addRule('minLength', {
      validate: (value, params) => !value || value.toString().length >= params.min,
      message: (params) => `En az ${params.min} karakter olmalıdır`
    });

    this.addRule('maxLength', {
      validate: (value, params) => !value || value.toString().length <= params.max,
      message: (params) => `En fazla ${params.max} karakter olabilir`
    });

    this.addRule('pattern', {
      validate: (value, params) => !value || new RegExp(params.regex).test(value),
      message: (params) => params.message || 'Geçersiz format'
    });

    // Business rules
    this.addRule('productCode', {
      validate: (value) => {
        if (!value) return false;
        const result = DataTransformer.Product.validateProductCode(value);
        return result.isValid;
      },
      message: 'Geçerli bir ürün kodu giriniz'
    });

    this.addRule('operationCode', {
      validate: (value) => {
        if (!value) return false;
        const result = DataTransformer.Operation.validateOperationCode(value);
        return result.isValid;
      },
      message: 'Geçerli bir operasyon kodu giriniz'
    });

    this.addRule('productType', {
      validate: (value) => {
        if (!value) return false;
        return Object.values(APP_CONFIG.BUSINESS.PRODUCT_TYPES)
          .some(type => type.code === value);
      },
      message: 'Geçerli bir ürün tipi seçiniz'
    });

    // Date rules
    this.addRule('date', {
      validate: (value) => !value || !isNaN(new Date(value).getTime()),
      message: 'Geçerli bir tarih giriniz'
    });

    this.addRule('futureDate', {
      validate: (value) => !value || new Date(value) > new Date(),
      message: 'Gelecek bir tarih seçiniz'
    });

    this.addRule('pastDate', {
      validate: (value) => !value || new Date(value) < new Date(),
      message: 'Geçmiş bir tarih seçiniz'
    });
  }

  /**
   * Yeni rule ekle
   */
  addRule(name, rule) {
    this.rules.set(name, {
      validate: rule.validate,
      message: rule.message,
      async: rule.async || false
    });
  }

  /**
   * Custom validator ekle
   */
  addCustomValidator(name, validator) {
    this.customValidators.set(name, validator);
  }

  /**
   * Schema tanımla
   */
  defineSchema(name, schema) {
    this.schemas.set(name, schema);
  }

  /**
   * Tek field validation
   */
  async validateField(fieldName, value, rules, context = {}) {
    const errors = [];

    for (const rule of rules) {
      try {
        const result = await this._executeRule(rule, value, fieldName, context);
        if (!result.isValid) {
          errors.push(result.message);
        }
      } catch (error) {
        console.error(`Validation error for ${fieldName}:`, error);
        errors.push('Validation hatası oluştu');
      }
    }

    return {
      isValid: errors.length === 0,
      errors: errors
    };
  }

  /**
   * Object validation (schema-based)
   */
  async validateObject(data, schema) {
    const results = {};
    const allErrors = [];

    for (const [fieldName, fieldRules] of Object.entries(schema)) {
      const fieldValue = data[fieldName];
      const fieldResult = await this.validateField(fieldName, fieldValue, fieldRules, data);
      
      results[fieldName] = fieldResult;
      
      if (!fieldResult.isValid) {
        allErrors.push(...fieldResult.errors.map(err => ({
          field: fieldName,
          message: err
        })));
      }
    }

    return {
      isValid: allErrors.length === 0,
      errors: allErrors,
      fieldResults: results
    };
  }

  /**
   * Schema ile validation
   */
  async validateWithSchema(schemaName, data) {
    const schema = this.schemas.get(schemaName);
    if (!schema) {
      throw new Error(`Schema not found: ${schemaName}`);
    }

    return await this.validateObject(data, schema);
  }

  /**
   * Rule çalıştır
   */
  async _executeRule(rule, value, fieldName, context) {
    let ruleName, params;
    
    // Rule format: 'required', 'minLength:3' veya {rule: 'minLength', params: {min: 3}}
    if (typeof rule === 'string') {
      // String parametreli format: 'minLength:3', 'maxLength:10' vs.
      if (rule.includes(':')) {
        const [name, paramStr] = rule.split(':');
        ruleName = name;
        
        // Parametre parsing'i
        if (name === 'minLength' || name === 'maxLength') {
          const length = parseInt(paramStr);
          params = name === 'minLength' ? { min: length } : { max: length };
        } else if (name === 'min' || name === 'max') {
          params = { [name]: parseFloat(paramStr) };
        } else {
          params = { value: paramStr };
        }
      } else {
        ruleName = rule;
        params = {};
      }
    } else {
      ruleName = rule.rule;
      params = rule.params || {};
    }

    // Built-in rule
    const builtInRule = this.rules.get(ruleName);
    if (builtInRule) {
      const isValid = builtInRule.async 
        ? await builtInRule.validate(value, params, context)
        : builtInRule.validate(value, params, context);

      return {
        isValid: isValid,
        message: isValid ? null : this._getMessage(builtInRule.message, params, fieldName)
      };
    }

    // Custom validator
    const customValidator = this.customValidators.get(ruleName);
    if (customValidator) {
      return await customValidator(value, params, context, fieldName);
    }

    throw new Error(`Unknown validation rule: ${ruleName}`);
  }

  /**
   * Error message oluştur
   */
  _getMessage(messageTemplate, params, fieldName) {
    if (typeof messageTemplate === 'function') {
      return messageTemplate(params, fieldName);
    }
    return messageTemplate;
  }

  /**
   * Conditional validation
   */
  addConditionalRule(name, condition, rules) {
    this.addCustomValidator(name, async (value, params, context, fieldName) => {
      // Condition kontrolü
      const shouldValidate = typeof condition === 'function' 
        ? condition(value, context, fieldName)
        : condition;

      if (!shouldValidate) {
        return { isValid: true, message: null };
      }

      // Rules'ları çalıştır
      for (const rule of rules) {
        const result = await this._executeRule(rule, value, fieldName, context);
        if (!result.isValid) {
          return result;
        }
      }

      return { isValid: true, message: null };
    });
  }

  /**
   * Cross-field validation
   */
  addCrossFieldValidator(name, validator) {
    this.addCustomValidator(name, async (value, params, context, fieldName) => {
      return await validator(context, params, fieldName);
    });
  }
}

// Global instance
const globalValidationEngine = new ValidationEngine();

// Pre-defined schemas
globalValidationEngine.defineSchema('product', {
  productCode: ['required', 'productCode'],
  name: ['required', { rule: 'maxLength', params: { max: 100 } }],
  type: ['required', 'productType'],
  description: [{ rule: 'maxLength', params: { max: 500 } }],
  lastOperationId: ['numeric']
});

globalValidationEngine.defineSchema('operation', {
  operasyonKodu: ['required', 'operationCode'],
  operasyonAdi: ['required', { rule: 'maxLength', params: { max: 100 } }]
});

globalValidationEngine.defineSchema('cycleTime', {
  operationId: ['required', 'numeric', 'positive'],
  productCode: ['required', 'minLength:3'],
  productId: ['numeric', 'positive'], // Runtime'da eklenen productId
  second: ['required', 'numeric', 'positive', { rule: 'maxValue', params: { max: 86400 } }]
});

globalValidationEngine.defineSchema('order', {
  documentNo: ['required', 'minLength:3'],
  customer: ['required', 'minLength:2'],
  productCode: ['required', 'productCode'],
  variants: [{ rule: 'maxLength', params: { max: 500 } }],
  orderCount: ['numeric', 'min:0'],
  carryover: ['numeric', 'min:0'],
  orderAddedDateTime: ['dateTime'],
  isActive: ['boolean']
});

// Max value rule için
globalValidationEngine.addRule('maxValue', {
  validate: (value, params) => !value || Number(value) <= params.max,
  message: (params) => `Değer en fazla ${params.max} olabilir`
});

// Business-specific validators
globalValidationEngine.addCustomValidator('productCodeTypeMatch', 
  async (value, params, context, fieldName) => {
    const productCode = context.productCode || value;
    const productType = context.type;
    
    if (!productCode || !productType) {
      return { isValid: true, message: null };
    }

    const expectedType = DataTransformer.Product.getTypeFromCode(productCode);
    if (expectedType && expectedType.code !== productType) {
      return {
        isValid: false,
        message: `Ürün kodu "${productCode}" için beklenen tip "${expectedType.code}", seçilen "${productType}"`
      };
    }

    return { isValid: true, message: null };
  }
);

globalValidationEngine.addCustomValidator('uniqueProductCode',
  async (value, params, context, fieldName) => {
    // Bu validator API call yapabilir
    if (!value || !params.apiClient) {
      return { isValid: true, message: null };
    }

    try {
      const response = await params.apiClient.get(`/Products/check-code/${value}`);
      const exists = response.data && response.data.exists;
      
      return {
        isValid: !exists,
        message: exists ? 'Bu ürün kodu zaten kullanımda' : null
      };
    } catch {
      // API hatası durumunda validation'ı geç
      return { isValid: true, message: null };
    }
  }
);

// Unique operation code validator (mirrors uniqueProductCode behavior)
globalValidationEngine.addCustomValidator('uniqueOperationCode',
  async (value, params, context, fieldName) => {
    if (!value || !params.apiClient) {
      return { isValid: true, message: null };
    }

    try {
      // Try a convention-based endpoint; if backend differs the call will fail and validation will pass
      const response = await params.apiClient.get(`/Operations/check-code/${value}`);
      const exists = response.data && response.data.exists;

      return {
        isValid: !exists,
        message: exists ? 'Bu operasyon kodu zaten kullanımda' : null
      };
    } catch {
      // On API error, don't block the user
      return { isValid: true, message: null };
    }
  }
);

// Export functions
export function getValidationEngine() {
  return globalValidationEngine;
}

export async function validateProduct(productData, options = {}) {
  const rules = { ...globalValidationEngine.schemas.get('product') };
  
  // Ek kurallar
  if (options.checkCodeTypeMatch) {
    rules.productCode.push('productCodeTypeMatch');
  }
  
  if (options.checkUnique && options.apiClient) {
    rules.productCode.push({
      rule: 'uniqueProductCode',
      params: { apiClient: options.apiClient }
    });
  }

  return await globalValidationEngine.validateObject(productData, rules);
}

export async function validateOperation(operationData, options = {}) {
  const rules = { ...globalValidationEngine.schemas.get('operation') };
  
  if (options.checkUnique && options.apiClient) {
    rules.operasyonKodu.push({
      rule: 'uniqueOperationCode',
      params: { apiClient: options.apiClient }
    });
  }

  return await globalValidationEngine.validateObject(operationData, rules);
}

export async function validateCycleTime(cycleTimeData, options = {}) {
  const rules = { ...globalValidationEngine.schemas.get('cycleTime') };
  
  return await globalValidationEngine.validateObject(cycleTimeData, rules);
}

export async function validateOrder(orderData, options = {}) {
  const rules = {
    documentNo: ['required', 'minLength:3'],
    customer: ['required', 'minLength:2'],
    productCode: ['required', 'productCode'],
    variants: [],
    orderCount: ['numeric', 'min:0'],
    carryover: ['numeric', 'min:0']
  };
  
  if (options.checkUnique && options.apiClient) {
    rules.documentNo.push({
      rule: 'uniqueDocumentNo',
      params: { apiClient: options.apiClient }
    });
  }

  return await globalValidationEngine.validateObject(orderData, rules);
}

// Quick validation helpers
export const QuickValidators = {
  required: (value) => value !== null && value !== undefined && value.toString().trim() !== '',
  
  email: (value) => !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
  
  productCode: (value) => {
    if (!value) return false;
    const result = DataTransformer.Product.validateProductCode(value);
    return result.isValid;
  },
  
  operationCode: (value) => {
    if (!value) return false;
    const result = DataTransformer.Operation.validateOperationCode(value);
    return result.isValid;
  },

  minLength: (min) => (value) => !value || value.toString().length >= min,
  
  maxLength: (max) => (value) => !value || value.toString().length <= max
};

export default globalValidationEngine;