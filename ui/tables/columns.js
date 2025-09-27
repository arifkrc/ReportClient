// Shared column descriptors to reduce duplication across table configs
export const productionColumns = [
  { field: 'date', header: 'Tarih', className: 'text-xs' },
  { field: 'shift', header: 'Vardiya' },
  { field: 'shiftSupervisor', header: 'Vardiya Sorum.' },
  { field: 'productCode', header: 'Ürün Kodu', className: 'font-mono' },
  { field: 'productName', header: 'Ürün Adı' },
  { field: 'operation', header: 'Operasyon' },
  { field: 'quantity', header: 'Adet', className: 'text-right' },
  { field: 'cycleTime', header: 'Çevrim (sn)', className: 'text-xs text-neutral-400' },
  { field: 'addedDateTime', header: 'Eklenme', className: 'text-neutral-400 text-xs' }
];

export const productsColumns = [
  { field: 'productCode', header: 'Ürün Kodu', className: 'font-mono' },
  { field: 'name', header: 'Ürün Adı' },
  { field: 'type', header: 'Ürün Tipi' },
  { field: 'addedDateTime', header: 'Eklenme', className: 'text-neutral-400 text-xs' },
  { field: 'description', header: 'Açıklama', className: 'text-sm max-w-xs' },
  { field: 'lastOperationName', header: 'Son İşlem', className: 'text-neutral-400 text-xs' }
];

export const ordersColumns = [
  { field: 'documentNo', header: 'Belge No', className: 'font-mono' },
  { field: 'customer', header: 'Müşteri' },
  { field: 'productCode', header: 'Ürün Kodu', className: 'font-mono' },
  { field: 'variants', header: 'Varyantlar', className: 'text-sm' },
  { field: 'orderCount', header: 'Sipariş Adet', className: 'text-center' },
  { field: 'completedQuantity', header: 'Tamamlanan', className: 'text-center' },
  { field: 'remaining', header: 'Kalan', className: 'text-center font-medium' },
  { field: 'carryover', header: 'Devir', className: 'text-center' },
  { field: 'orderAddedDateTime', header: 'Hafta', className: 'text-center font-mono' },
  { field: 'addedDateTime', header: 'Eklenme', className: 'text-neutral-400 text-xs' }
];

export const packingsColumns = [
  { field: 'date', header: 'Tarih', className: 'text-neutral-400 text-xs' },
  { field: 'shift', header: 'Vardiya', className: 'text-center font-mono' },
  { field: 'supervisor', header: 'Sorumlu', className: 'text-sm' },
  { field: 'productCode', header: 'Ürün Kodu', className: 'font-mono' },
  { field: 'quantity', header: 'Miktar', className: 'text-center font-medium' },
  { field: 'explodedFrom', header: 'Exploded From', className: 'text-sm text-neutral-400' },
  { field: 'explodingTo', header: 'Exploding To', className: 'text-sm text-neutral-400' },
  { field: 'addedDateTime', header: 'Eklenme', className: 'text-neutral-400 text-xs' }
];

export const operationsColumns = [
  { field: 'shortCode', header: 'Operasyon Kodu', className: 'font-mono' },
  { field: 'name', header: 'Operasyon Adı' },
  { field: 'addedDateTime', header: 'Eklenme', className: 'text-neutral-400 text-xs' }
];

export const cycleTimesColumns = [
  { field: 'productCode', header: 'Ürün Kodu', className: 'font-mono' },
  { field: 'productName', header: 'Ürün Adı' },
  { field: 'operationShortCode', header: 'Op. Kodu' },
  { field: 'operationName', header: 'Operasyon' },
  { field: 'second', header: 'Süre (sn)' },
  { field: 'isActive', header: 'Durum' }
];
