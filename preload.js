// Preload - expose a minimal, safe API for renderer to request saves
const { contextBridge, ipcRenderer } = require('electron');

// Main API - read-only surface: only expose list/get and lookup operations
const api = {
  // read-only production records
  listUretim: () => ipcRenderer.invoke('list-uretim'),

  // operations (read-only)
  listOperasyon: () => ipcRenderer.invoke('list-operasyon'),

  // products (read-only)
  listProducts: () => ipcRenderer.invoke('list-products'),

  // cycle times (read-only)
  listCycleTimes: () => ipcRenderer.invoke('list-cycle-times'),

  // orders (read-only)
  listOrders: () => ipcRenderer.invoke('list-orders'),

  // product lookup (read-only)
  lookupProduct: (productCode) => ipcRenderer.invoke('lookup-product', productCode),

  // operation types
  getOperationTypes: (onlyActive = false) => ipcRenderer.invoke('get-operation-types', onlyActive),

  // staging APIs disabled in report-only client
  // open external link in user's default browser (validated in main)
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
};

// Expose both 'api' and 'electronAPI' for consistency
contextBridge.exposeInMainWorld('api', api);
contextBridge.exposeInMainWorld('electronAPI', api);
