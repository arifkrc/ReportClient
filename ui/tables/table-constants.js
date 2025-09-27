// Shared table constants to reduce duplication across table configs
export const ProductionEndpoints = {
  LIST_PAGED: '/ProductionTrackingForms/paged',
  CREATE: '/ProductionTrackingForms',
  ACTIVATE: '/ProductionTrackingForms/{id}/activate',
  DEACTIVATE: '/ProductionTrackingForms/{id}/deactivate',
  UPDATE: '/ProductionTrackingForms/{id}'
};

export const productionColumns = [
  { field: 'date', header: 'Tarih', className: 'text-xs', editable: true },
  { field: 'shift', header: 'Vardiya', editable: true },
  { field: 'shiftSupervisor', header: 'Vardiya Sorum.', editable: true },
  { field: 'productCode', header: 'Ürün Kodu', className: 'font-mono', editable: true },
  { field: 'productName', header: 'Ürün Adı', editable: false },
  { field: 'operation', header: 'Operasyon', editable: true },
  { field: 'quantity', header: 'Adet', className: 'text-right', editable: true },
  { field: 'cycleTime', header: 'Çevrim (sn)', className: 'text-xs text-neutral-400', editable: true },
  { field: 'addedDateTime', header: 'Eklenme', className: 'text-neutral-400 text-xs', editable: false }
];
