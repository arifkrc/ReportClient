/**
 * Merkezi Event Yöneticisi
 * Event listener'ları otomatik cleanup ile yönet, memory leak'leri önle
 */

export class EventManager {
  constructor(context = 'default') {
    this.context = context;
    this.listeners = new Map(); // WeakMap değil çünkü cleanup için referans tutmamız gerekiyor
    this.listenerCounter = 0;
    
    console.log(`🎯 EventManager created for context: ${context}`);
  }

  /**
   * Event listener ekle
   */
  add(element, eventType, handler, options = {}) {
    if (!element || !eventType || !handler) {
      console.error('❌ EventManager.add: Invalid parameters');
      return null;
    }

    const listenerId = ++this.listenerCounter;
    const listenerInfo = {
      id: listenerId,
      element,
      eventType,
      handler,
      options,
      addedAt: new Date(),
      context: this.context
    };

    // Event listener'ı ekle
    element.addEventListener(eventType, handler, options);
    
    // Kaydı tut
    this.listeners.set(listenerId, listenerInfo);
    
    console.log(`➕ Event added [${listenerId}]: ${eventType} on`, element.tagName?.toLowerCase() || 'element');
    
    return listenerId;
  }

  /**
   * Belirli bir listener'ı kaldır
   */
  remove(listenerId) {
    const listenerInfo = this.listeners.get(listenerId);
    
    if (listenerInfo) {
      const { element, eventType, handler, options } = listenerInfo;
      element.removeEventListener(eventType, handler, options);
      this.listeners.delete(listenerId);
      
      console.log(`➖ Event removed [${listenerId}]: ${eventType}`);
      return true;
    }
    
    console.warn(`⚠️ Event listener [${listenerId}] not found for removal`);
    return false;
  }

  /**
   * Belirli element'in tüm listener'larını kaldır
   */
  removeByElement(element) {
    let removedCount = 0;
    
    for (const [listenerId, listenerInfo] of this.listeners) {
      if (listenerInfo.element === element) {
        this.remove(listenerId);
        removedCount++;
      }
    }
    
    console.log(`🗑️ Removed ${removedCount} listeners for element`);
    return removedCount;
  }

  /**
   * Belirli event type'ının tüm listener'larını kaldır
   */
  removeByEventType(eventType) {
    let removedCount = 0;
    
    for (const [listenerId, listenerInfo] of this.listeners) {
      if (listenerInfo.eventType === eventType) {
        this.remove(listenerId);
        removedCount++;
      }
    }
    
    console.log(`🗑️ Removed ${removedCount} listeners for event type: ${eventType}`);
    return removedCount;
  }

  /**
   * Tüm listener'ları kaldır
   */
  removeAll() {
    const totalCount = this.listeners.size;
    
    for (const [listenerId] of this.listeners) {
      this.remove(listenerId);
    }
    
    console.log(`🗑️ Removed all ${totalCount} listeners for context: ${this.context}`);
    return totalCount;
  }

  /**
   * Listener bilgilerini al
   */
  getListenerInfo(listenerId) {
    return this.listeners.get(listenerId);
  }

  /**
   * Tüm aktif listener'ları listele
   */
  getAllListeners() {
    return Array.from(this.listeners.values());
  }

  /**
   * Element için listener sayısını al
   */
  getListenerCount(element = null) {
    if (element) {
      return Array.from(this.listeners.values())
        .filter(info => info.element === element).length;
    }
    return this.listeners.size;
  }

  /**
   * Memory leak detection
   */
  detectPotentialLeaks() {
    const leaks = [];
    const threshold = 50; // 50'den fazla listener şüpheli
    
    if (this.listeners.size > threshold) {
      leaks.push({
        type: 'too_many_listeners',
        count: this.listeners.size,
        threshold
      });
    }

    // Aynı element'te çok listener
    const elementCounts = new Map();
    for (const listenerInfo of this.listeners.values()) {
      const count = elementCounts.get(listenerInfo.element) || 0;
      elementCounts.set(listenerInfo.element, count + 1);
    }

    for (const [element, count] of elementCounts) {
      if (count > 10) {
        leaks.push({
          type: 'element_overload',
          element: element.tagName?.toLowerCase() || 'unknown',
          count
        });
      }
    }

    return leaks;
  }

  /**
   * Debug bilgileri
   */
  getDebugInfo() {
    const listeners = this.getAllListeners();
    const byEventType = {};
    const byElement = {};

    listeners.forEach(info => {
      // Event type grouping
      byEventType[info.eventType] = (byEventType[info.eventType] || 0) + 1;
      
      // Element grouping
      const elementKey = info.element.tagName?.toLowerCase() || 'unknown';
      byElement[elementKey] = (byElement[elementKey] || 0) + 1;
    });

    return {
      context: this.context,
      totalListeners: this.listeners.size,
      byEventType,
      byElement,
      potentialLeaks: this.detectPotentialLeaks(),
      oldestListener: listeners.length > 0 
        ? Math.min(...listeners.map(l => l.addedAt.getTime()))
        : null
    };
  }
}

/**
 * Global Event Manager (singleton pattern)
 */
class GlobalEventManager {
  constructor() {
    this.contexts = new Map();
    this.defaultContext = 'global';
  }

  /**
   * Context için EventManager al/oluştur
   */
  getContext(contextName = this.defaultContext) {
    if (!this.contexts.has(contextName)) {
      this.contexts.set(contextName, new EventManager(contextName));
    }
    return this.contexts.get(contextName);
  }

  /**
   * Context'i kaldır (tüm listener'ları da temizler)
   */
  removeContext(contextName) {
    const eventManager = this.contexts.get(contextName);
    if (eventManager) {
      eventManager.removeAll();
      this.contexts.delete(contextName);
      console.log(`🗑️ Context removed: ${contextName}`);
      return true;
    }
    return false;
  }

  /**
   * Tüm context'leri temizle
   */
  removeAllContexts() {
    const contextNames = Array.from(this.contexts.keys());
    contextNames.forEach(name => this.removeContext(name));
    console.log('🗑️ All contexts removed');
  }

  /**
   * Global debug bilgileri
   */
  getGlobalDebugInfo() {
    const info = {
      totalContexts: this.contexts.size,
      contexts: {}
    };

    for (const [name, eventManager] of this.contexts) {
      info.contexts[name] = eventManager.getDebugInfo();
    }

    return info;
  }
}

// Global instance
const globalEventManager = new GlobalEventManager();

// Export functions
export function getEventManager(context = 'global') {
  return globalEventManager.getContext(context);
}

export function createContext(context) {
  return globalEventManager.getContext(context);
}

export function destroyContext(context) {
  return globalEventManager.removeContext(context);
}

export function removeEventContext(context) {
  return globalEventManager.removeContext(context);
}

export function getGlobalEventDebugInfo() {
  return globalEventManager.getGlobalDebugInfo();
}

export function cleanupAllEvents() {
  globalEventManager.removeAllContexts();
}

/**
 * Helper functions - kolay kullanım için
 */
export const EventHelpers = {
  /**
   * Form için event manager oluştur
   */
  createFormEventManager: (formElement, context = null) => {
    const contextName = context || `form_${formElement.id || Date.now()}`;
    const eventManager = getEventManager(contextName);
    
    // Form submit
    eventManager.add(formElement, 'submit', (e) => {
      console.log('📝 Form submitted:', formElement.id);
    });

    return eventManager;
  },

  /**
   * Tablo için event manager oluştur
   */
  createTableEventManager: (tableElement, context = null) => {
    const contextName = context || `table_${tableElement.id || Date.now()}`;
    const eventManager = getEventManager(contextName);
    
    // Tablo içindeki button'lar için delegate
    eventManager.add(tableElement, 'click', (e) => {
      if (e.target.tagName === 'BUTTON') {
        console.log('🔘 Table button clicked:', e.target.textContent);
      }
    });

    return eventManager;
  },

  /**
   * Sayfa için event manager oluştur (cleanup için)
   */
  createPageEventManager: (pageName) => {
    return getEventManager(`page_${pageName}`);
  },

  /**
   * Component için event manager oluştur
   */
  createComponentEventManager: (componentName, instanceId = null) => {
    const contextName = instanceId 
      ? `component_${componentName}_${instanceId}`
      : `component_${componentName}`;
    return getEventManager(contextName);
  }
};

/**
 * Decorator pattern - otomatik cleanup
 */
export function withEventCleanup(contextName) {
  return function(target, propertyKey, descriptor) {
    const originalMethod = descriptor.value;
    
    descriptor.value = function(...args) {
      try {
        return originalMethod.apply(this, args);
      } finally {
        // Cleanup on method completion
        removeEventContext(contextName);
      }
    };
    
    return descriptor;
  };
}

// Auto-cleanup on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    console.log('🗑️ Page unloading - cleaning up all events');
    cleanupAllEvents();
  });
}

// Default export
export default globalEventManager;