import ApiClient, { ApiResponseHelpers } from '../ui/core/api-client.js';
import { APP_CONFIG } from '../config/app-config.js';
import { showToast } from '../ui/helpers.js';

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Module-level product type cache (productCode → type string)
let _productTypeCache = null;

export async function mount(container, opts = {}) {
  const setHeader = opts.setHeader || (() => {});
  setHeader('Günlük Rapor', 'Bugünün üretim özetleri');

  container.innerHTML = `
    <div class="p-4">
      <div class="flex items-center justify-between mb-4">
        <div>
          <h3 class="text-lg font-semibold">Günlük Rapor</h3>
          <div class="text-sm text-neutral-400">Günlük üretim özeti</div>
        </div>
    <div class="flex items-center gap-2">
            <input id="daily-date" type="date" class="px-2 py-1 rounded bg-neutral-800 text-neutral-200" aria-label="Rapor tarihi" />
            <button id="daily-btn-yesterday" class="px-2 py-1 bg-neutral-700 rounded text-sm text-white">Dün</button>
            <button id="daily-btn-today" class="px-2 py-1 bg-neutral-700 rounded text-sm text-white">Bugün</button>
      <button id="daily-export-csv" class="px-3 py-1 bg-green-600 rounded text-white">CSV</button>
      <button id="daily-export-pdf" class="px-3 py-1 bg-slate-600 rounded text-white">PDF</button>
            <button id="daily-refresh" class="px-3 py-1 bg-indigo-600 rounded text-white">Yenile</button>
            <div class="text-xs text-neutral-400 ml-2">Varsayılan: Dün · Kısayollar: Y=dün, T=bugün, R=yenile, Enter=yenile</div>
          </div>
      </div>

      <div id="daily-summary" class="mb-4 p-4 bg-neutral-800 rounded grid grid-cols-2 gap-4">
        <div>
          <div class="text-sm text-neutral-400 font-bold">Üretim (Toplam)</div>
          <div id="daily-total" class="text-3xl font-bold">-</div>
          <div id="daily-range" class="text-sm text-neutral-400 mt-1" style="display:none">-</div>
        </div>
        <div>
          <div class="text-sm text-neutral-400 font-bold">Sevkiyat (Günlük Toplam)</div>
          <div id="daily-shipments-total" class="text-3xl font-bold text-emerald-400">-</div>
          <div id="daily-shipments-sub" class="text-sm text-neutral-400 font-semibold mt-1">Disk: - · Kampana: - · Poyra: -</div>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-6">
        <div>
          <h4 class="text-md font-bold mb-2">Üretim - Tip Bazlı</h4>
          <div id="daily-types" class="flex flex-col gap-4"></div>
          <div id="daily-carryovers-container" class="mt-4">
            <h5 class="text-sm font-bold mb-2">Carryover / Devreden Kayıtlar</h5>
            <div id="daily-carryovers" class="flex flex-col gap-2"></div>
            <div class="mt-3">
              <div id="daily-carryover-pyramid" class="mb-2"></div>
              <button id="daily-carryover-toggle" class="px-2 py-1 bg-neutral-700 rounded text-sm text-white">Geciken Siparişleri Göster</button>
              <div id="daily-carryover-list" class="mt-2" style="display:none"></div>
            </div>
          </div>
        </div>
        <div>
          <h4 class="text-md font-bold mb-2">Sevkiyatlar</h4>
          <div id="daily-shipments" class="mt-0"></div>
        </div>
      </div>

      <!-- Full-width carryover details section -->
      <div id="carryover-details-container" class="mt-6" style="display:none">
        <div class="bg-neutral-800 rounded-lg p-4">
          <div class="flex items-center justify-between mb-4">
            <h4 class="text-lg font-semibold text-neutral-200" id="carryover-details-title">Carryover Detayları</h4>
            <button id="carryover-details-close" class="px-3 py-1 bg-neutral-700 hover:bg-neutral-600 rounded text-sm text-neutral-300 hover:text-white transition-colors">
              ✕ Kapat
            </button>
          </div>
          <div id="carryover-details-content" class="bg-neutral-900 rounded-lg p-4">
            <div class="text-center text-neutral-400 py-8">
              <div class="animate-pulse">Detaylar yükleniyor...</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  const dateInput = container.querySelector('#daily-date');
  const refreshBtn = container.querySelector('#daily-refresh');
  const typesContainer = container.querySelector('#daily-types');

  function setDefaultDate() {
    // Try persisted date first
    try {
      const saved = localStorage.getItem('dailyReport.lastDate');
      if (saved) { dateInput.value = saved; return; }
    } catch (e) { /* ignore */ }

    // Default to last known date with data in DB
    dateInput.value = '2025-09-27';
  }

  // Function to show detailed carryover orders when a chart column is clicked
  window.showCarryoverDetails = async function showCarryoverDetails(productType, carryoverValue) {
    const detailsContainer = container.querySelector('#carryover-details-container');
    const detailsContent = container.querySelector('#carryover-details-content');
    const detailsTitle = container.querySelector('#carryover-details-title');
    
    if (!detailsContainer || !detailsContent || !detailsTitle) return;
    
    // Show the details container and set loading state
    detailsContainer.style.display = 'block';
    detailsTitle.textContent = `${productType} - ${carryoverValue} hafta gecikme`;
    detailsContent.innerHTML = '<div class="text-center text-neutral-400 py-4">Detaylar yükleniyor...</div>';
    
    try {
      // API call to get detailed carryover orders (real-time data, no date filter needed)
      const api = new ApiClient(APP_CONFIG.API.BASE_URL);
      const params = new URLSearchParams({
        productType: productType,
        carryoverValue: carryoverValue === '15+' ? '15' : carryoverValue,
        includeDetails: 'true'
      });
      
      const endpoint = `/Reports/carryover-details?${params.toString()}`;
      const res = await api.get(endpoint);
      
      let orders;
      try {
        orders = ApiResponseHelpers.extractData(res);
      } catch (err) {
        console.error('Carryover details extractData error', res, err);
        throw new Error(err.message || 'API response format error');
      }
      
      if (!Array.isArray(orders) || orders.length === 0) {
        // Show the API message if available
        const message = res.data?.message || `Bu kategoride geciken sipariş bulunamadı`;
        detailsContent.innerHTML = `
          <div class="text-center text-neutral-400 py-4">
            <div class="text-sm">${escapeHtml(message)}</div>
            <div class="text-xs mt-1 text-neutral-500">${productType} - ${carryoverValue} hafta gecikme</div>
          </div>
        `;
        return;
      }
      
      // Generate orders table with API message
      const apiMessage = res.data?.message;
      const tableHTML = generateCarryoverOrdersTable(orders);
      
      detailsContent.innerHTML = `
        ${apiMessage ? `<div class="mb-2 text-xs text-green-400 bg-green-900/20 p-2 rounded">${escapeHtml(apiMessage)}</div>` : ''}
        ${tableHTML}
      `;
      
    } catch (error) {
      console.error('Error loading carryover details:', error);
      detailsContent.innerHTML = `
        <div class="text-center text-rose-400 py-4">
          <div class="text-sm">Detaylar yüklenirken hata oluştu</div>
          <div class="text-xs mt-1">${escapeHtml(error.message || 'Unknown error')}</div>
          <button onclick="showCarryoverDetails('${productType}', '${carryoverValue}')" 
                  class="mt-2 px-2 py-1 bg-neutral-700 rounded text-xs text-white">Tekrar Dene</button>
        </div>
      `;
    }
  };

  // Function to toggle text display (expand/collapse truncated text)
  window.toggleText = function toggleText(elementId) {
    const shortEl = document.getElementById(`${elementId}_short`);
    const fullEl = document.getElementById(`${elementId}_full`);
    
    if (shortEl && fullEl) {
      if (shortEl.style.display === 'none') {
        // Currently showing full, switch to short
        shortEl.style.display = 'inline';
        fullEl.style.display = 'none';
      } else {
        // Currently showing short, switch to full
        shortEl.style.display = 'none';
        fullEl.style.display = 'inline';
      }
    }
  };

  // Function to show all carryover orders for a specific product type
  window.showAllCarryoverOrders = async function showAllCarryoverOrders(productType) {
    const detailsContainer = container.querySelector('#carryover-details-container');
    const detailsContent = container.querySelector('#carryover-details-content');
    const detailsTitle = container.querySelector('#carryover-details-title');
    
    if (!detailsContainer || !detailsContent || !detailsTitle) return;
    
    // Show the details container and set loading state
    detailsContainer.style.display = 'block';
    detailsTitle.textContent = `${productType} - Tüm Geciken Siparişler`;
    detailsContent.innerHTML = '<div class="text-center text-neutral-400 py-4">Tüm geciken siparişler yükleniyor...</div>';
    
    try {
      // API call to get all carryover orders for this product type
      const api = new ApiClient(APP_CONFIG.API.BASE_URL);
      const params = new URLSearchParams({
        productType: productType,
        includeDetails: 'true'
        // No carryoverValue parameter = get all weeks
      });
      
      const endpoint = `/Reports/carryover-details?${params.toString()}`;
      const res = await api.get(endpoint);
      
      let orders;
      try {
        orders = ApiResponseHelpers.extractData(res);
      } catch (err) {
        console.error('All carryover details extractData error', res, err);
        throw new Error(err.message || 'API response format error');
      }
      
      if (!Array.isArray(orders) || orders.length === 0) {
        const message = res.data?.message || `${productType} için geciken sipariş bulunamadı`;
        detailsContent.innerHTML = `
          <div class="text-center text-neutral-400 py-4">
            <div class="text-sm">${escapeHtml(message)}</div>
            <div class="text-xs mt-1 text-neutral-500">${productType} - Tüm geciken siparişler</div>
          </div>
        `;
        return;
      }
      
      // Sort orders by delay weeks (descending - most delayed first)
      orders.sort((a, b) => (b.delayDays || 0) - (a.delayDays || 0));
      
      // Generate orders table with API message and grouping info
      const apiMessage = res.data?.message;
      const tableHTML = generateCarryoverOrdersTable(orders, true); // true = show week grouping
      
      detailsContent.innerHTML = `
        ${apiMessage ? `<div class="mb-2 text-xs text-blue-400 bg-blue-900/20 p-2 rounded">${escapeHtml(apiMessage)}</div>` : ''}
        ${tableHTML}
      `;
      
    } catch (error) {
      console.error('Error loading all carryover details:', error);
      detailsContent.innerHTML = `
        <div class="text-center text-rose-400 py-4">
          <div class="text-sm">Tüm geciken siparişler yüklenirken hata oluştu</div>
          <div class="text-xs mt-1">${escapeHtml(error.message || 'Unknown error')}</div>
          <button onclick="showAllCarryoverOrders('${productType}')" 
                  class="mt-2 px-2 py-1 bg-neutral-700 rounded text-xs text-white">Tekrar Dene</button>
        </div>
      `;
    }
  };
  
  // Function to generate HTML table for carryover orders
  function generateCarryoverOrdersTable(orders, showWeekGrouping = false) {
    // Helper function to generate individual order row
    function generateOrderRow(order) {
      // Use your actual API response field names
      const orderCreatedDate = order.orderCreatedDate ? new Date(order.orderCreatedDate).toLocaleDateString('tr-TR') : '-';
      const delayWeeks = order.delayDays || 0; // delayDays is actually weeks, not days
      const orderCount = order.orderCount || 0;
      const completedQuantity = order.completedQuantity || 0;
      const remainingQuantity = orderCount - completedQuantity; // Calculate remaining as order - completed
      const customerName = order.customerName || '-';
      const orderNumber = order.orderNumber || '-';
      const productDisplay = order.productName || order.productCode || '-';
      const variants = order.variants || '-';
      const orderWeek = order.orderWeek || '-';
      
      // Generate unique IDs for expand/collapse functionality
      const productId = `product_${Math.random().toString(36).substr(2, 9)}`;
      const variantsId = `variants_${Math.random().toString(36).substr(2, 9)}`;
      
      // Check if truncation is needed
      const productTruncated = String(productDisplay).length > 50;
      const variantsTruncated = String(variants).length > 100;
      
      const productContent = productTruncated ? 
        `<span id="${productId}_short">${escapeHtml(String(productDisplay).slice(0, 47))}... <button onclick="toggleText('${productId}')" class="text-blue-400 hover:text-blue-300 underline cursor-pointer text-xs ml-1">daha fazla</button></span>
         <span id="${productId}_full" style="display:none">${escapeHtml(String(productDisplay))} <button onclick="toggleText('${productId}')" class="text-blue-400 hover:text-blue-300 underline cursor-pointer text-xs ml-1">daha az</button></span>` :
        escapeHtml(String(productDisplay));
      
      const variantsContent = variants !== '-' && variantsTruncated ? 
        `<div class="text-neutral-500 text-sm mt-1">
           <span id="${variantsId}_short">${escapeHtml(String(variants).slice(0, 97))}... <button onclick="toggleText('${variantsId}')" class="text-blue-400 hover:text-blue-300 underline cursor-pointer text-xs ml-1">daha fazla</button></span>
           <span id="${variantsId}_full" style="display:none">${escapeHtml(String(variants))} <button onclick="toggleText('${variantsId}')" class="text-blue-400 hover:text-blue-300 underline cursor-pointer text-xs ml-1">daha az</button></span>
         </div>` :
        variants !== '-' ? `<div class="text-neutral-500 text-sm mt-1">${escapeHtml(String(variants))}</div>` : '';
      
      return `
        <tr class="hover:bg-neutral-800 transition-colors">
          <td class="px-4 py-3 font-mono text-blue-400">${escapeHtml(String(orderNumber))}</td>
          <td class="px-4 py-3">
            <div class="font-medium text-neutral-200">${productContent}</div>
            ${variantsContent}
          </td>
          <td class="px-4 py-3 text-neutral-300">${escapeHtml(String(customerName))}</td>
          <td class="px-4 py-3 text-right">
            <div class="font-semibold text-neutral-200">${orderCount.toLocaleString()}</div>
            <div class="text-neutral-500 text-sm">Tamamlanan: ${completedQuantity.toLocaleString()}</div>
          </td>
          <td class="px-4 py-3 text-center">
            <span class="px-3 py-1 rounded-full text-sm font-medium ${remainingQuantity > 50 ? 'bg-red-600' : remainingQuantity > 20 ? 'bg-orange-600' : 'bg-yellow-600'} text-white">
              ${remainingQuantity.toLocaleString()}
            </span>
          </td>
          <td class="px-4 py-3">
            <div class="text-neutral-200">${orderCreatedDate}</div>
            <div class="text-neutral-500 text-sm">${orderWeek}</div>
          </td>
          <td class="px-4 py-3 text-center">
            <span class="px-3 py-1 rounded-full text-sm font-medium ${delayWeeks > 2 ? 'bg-red-600' : delayWeeks > 1 ? 'bg-orange-600' : 'bg-yellow-600'} text-white">
              ${delayWeeks} hafta
            </span>
          </td>
        </tr>
      `;
    }

    // Generate rows with or without grouping
    let rows = '';
    if (showWeekGrouping) {
      // Group orders by delay weeks
      const weekGroups = {};
      orders.forEach(order => {
        const delayWeeks = order.delayDays || 0;
        const weekKey = delayWeeks >= 15 ? '15+' : String(delayWeeks);
        if (!weekGroups[weekKey]) weekGroups[weekKey] = [];
        weekGroups[weekKey].push(order);
      });
      
      // Sort week keys numerically (most delayed first)
      const sortedWeeks = Object.keys(weekGroups).sort((a, b) => {
        const aNum = a === '15+' ? 999 : parseInt(a);
        const bNum = b === '15+' ? 999 : parseInt(b);
        return bNum - aNum;
      });
      
      sortedWeeks.forEach(weekKey => {
        const weekOrders = weekGroups[weekKey];
        const weekLabel = weekKey === '15+' ? '15+ Hafta' : `${weekKey} Hafta`;
        
        // Week group header
        rows += `
          <tr class="bg-neutral-700">
            <td colspan="7" class="px-4 py-2 text-sm font-semibold text-neutral-200">
              📅 ${weekLabel} Gecikme (${weekOrders.length} sipariş)
            </td>
          </tr>
        `;
        
        // Orders in this week group
        weekOrders.forEach(order => {
          rows += generateOrderRow(order);
        });
      });
    } else {
      // Simple list without grouping
      rows = orders.map(order => generateOrderRow(order)).join('');
    }
    
    // Calculate totals for summary
    const totalOrders = orders.length;
    const totalOrderCount = orders.reduce((sum, o) => sum + (o.orderCount || 0), 0);
    const totalCompleted = orders.reduce((sum, o) => sum + (o.completedQuantity || 0), 0);
    const totalRemaining = orders.reduce((sum, o) => sum + ((o.orderCount || 0) - (o.completedQuantity || 0)), 0);
    
    return `
      <div class="mb-3 p-2 bg-neutral-800 rounded">
        <div class="text-xs text-neutral-300 font-semibold mb-1">Özet</div>
        <div class="grid grid-cols-4 gap-2 text-xs">
          <div><span class="text-neutral-400">Sipariş:</span> <span class="font-medium">${totalOrders}</span></div>
          <div><span class="text-neutral-400">Toplam Adet:</span> <span class="font-medium">${totalOrderCount}</span></div>
          <div><span class="text-neutral-400">Tamamlanan:</span> <span class="font-medium text-green-400">${totalCompleted}</span></div>
          <div><span class="text-neutral-400">Kalan:</span> <span class="font-medium text-orange-400">${totalRemaining}</span></div>
        </div>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="bg-neutral-800 text-neutral-300 border-b border-neutral-600">
              <th class="px-4 py-3 text-left font-medium">Sipariş No</th>
              <th class="px-4 py-3 text-left font-medium">Ürün Bilgisi</th>
              <th class="px-4 py-3 text-left font-medium">Müşteri</th>
              <th class="px-4 py-3 text-right font-medium">Sipariş Miktarı</th>
              <th class="px-4 py-3 text-center font-medium">Kalan Miktar</th>
              <th class="px-4 py-3 text-left font-medium">Sipariş Tarihi</th>
              <th class="px-4 py-3 text-center font-medium">Gecikme (Hafta)</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-neutral-700">
            ${rows}
          </tbody>
        </table>
      </div>
    `;
  }

  async function loadDaily(dateIso) {
    const TYPE_ORDER = ['DISK', 'KAMPANA', 'POYRA'];
    const TYPE_COLORS = { DISK: '#6366f1', KAMPANA: '#10b981', POYRA: '#f59e0b', 'DIGER': '#6b7280' };
    function typeKey(raw) { const u = (raw || '').toUpperCase().replace('İ','I').replace('Ğ','G'); return TYPE_ORDER.includes(u) ? u : 'DIGER'; }
    function typeLabel(k) { return k === 'DIGER' ? 'Diğer' : k.charAt(0) + k.slice(1).toLowerCase(); }

    try {
      typesContainer.innerHTML = '<div class="text-sm text-neutral-400 animate-pulse p-3">Yükleniyor...</div>';
      const api = new ApiClient(APP_CONFIG.API.BASE_URL);

      // === Faz 1: Günlük paketleme kayıtları ===
      const nextDay = new Date(dateIso);
      nextDay.setDate(nextDay.getDate() + 1);
      const nextDayIso = nextDay.toISOString().slice(0, 10);
      const endpoint = `/Packings/daterange?startDate=${encodeURIComponent(dateIso + 'T00:00:00')}&endDate=${encodeURIComponent(nextDayIso + 'T00:00:00')}`;
      const res = await api.get(endpoint);
      let records;
      try {
        records = ApiResponseHelpers.extractData(res);
      } catch (err) {
        console.error('Packings/daterange extractData error', res, err);
        showToast('Günlük rapor yüklenemedi: ' + (err.message || 'unknown'), 'error');
        typesContainer.innerHTML = `<div class="text-rose-400 p-3">${escapeHtml(err.message || 'Veri alınamadı')}</div>`;
        return;
      }
      if (!Array.isArray(records)) {
        showToast('Beklenmeyen veri formatı', 'error');
        typesContainer.innerHTML = '<div class="text-rose-400 p-3">Beklenmeyen veri formatı</div>';
        return;
      }
      const totalQty = records.reduce((sum, r) => sum + (r.quantity || 0), 0);

      // === Faz 2: Ürün tip önbelleği (Products API, bir kez yüklenir) ===
      if (!_productTypeCache) {
        try {
          const cache = {};
          let pg = 1;
          while (true) {
            const pr = await api.get(`/Products/paged?pageNumber=${pg}&pageSize=200`);
            const pd = ApiResponseHelpers.extractData(pr);
            const items = (pd && pd.items) ? pd.items : [];
            if (!items.length) break;
            items.forEach(p => { if (p.productCode) cache[p.productCode] = p.type || ''; });
            if (items.length < 200) break;
            pg++;
          }
          _productTypeCache = cache;
        } catch (e) {
          console.warn('Product type cache failed', e);
          _productTypeCache = {};
        }
      }

      // === Faz 3: Tipe göre toplam ===
      const byType = {};
      records.forEach(r => {
        const t = typeKey(_productTypeCache[r.productCode] || '');
        byType[t] = (byType[t] || 0) + (r.quantity || 0);
      });

      // === Faz 4: Hedefe göre (explodingTo) ===
      const byDest = {};
      records.forEach(r => {
        const dest = (r.explodingTo || 'Belirtilmemiş').trim();
        byDest[dest] = (byDest[dest] || 0) + (r.quantity || 0);
      });

      // === Faz 5: Ürüne göre ===
      const byProduct = {};
      records.forEach(r => {
        const key = r.productCode || 'Bilinmiyor';
        if (!byProduct[key]) byProduct[key] = { productCode: key, productName: r.productName || '', type: _productTypeCache[key] || '', quantity: 0 };
        byProduct[key].quantity += (r.quantity || 0);
      });
      const productList = Object.values(byProduct).sort((a, b) => b.quantity - a.quantity);

      // === Faz 6: Özet başlık ===
      container.querySelector('#daily-total').textContent = `${totalQty.toLocaleString('tr-TR')} adet`;
      const rangeEl = container.querySelector('#daily-range');
      rangeEl.textContent = `${records.length} kayıt`;
      rangeEl.style.display = 'block';
      container.querySelector('#daily-shipments-total').textContent = totalQty.toLocaleString('tr-TR');
      container.querySelector('#daily-shipments-sub').textContent =
        `Disk: ${(byType['DISK']||0).toLocaleString('tr-TR')} · Kampana: ${(byType['KAMPANA']||0).toLocaleString('tr-TR')} · Poyra: ${(byType['POYRA']||0).toLocaleString('tr-TR')}`;

      // === Faz 7: Tip bazlı bar grafik + ürün tablosu ===
      typesContainer.innerHTML = '';
      if (records.length === 0) {
        typesContainer.innerHTML = '<div class="text-sm text-neutral-400 p-3">Bu tarihte paketleme kaydı bulunamadı.</div>';
      } else {
        const activeTypes = [...TYPE_ORDER, 'DIGER'].filter(t => byType[t] > 0);
        const maxVal = Math.max(...activeTypes.map(t => byType[t] || 0), 1);

        let chartHtml = '<div class="p-3 bg-neutral-800 rounded mb-3"><div class="text-sm font-semibold text-neutral-300 mb-3">Üretim — Tip Bazlı Dağılım</div>';
        activeTypes.forEach(t => {
          const qty = byType[t] || 0;
          const pct = Math.round((qty / maxVal) * 100);
          const pctTotal = Math.round((qty / Math.max(totalQty, 1)) * 100);
          const color = TYPE_COLORS[t] || '#6b7280';
          chartHtml += `
            <div class="mb-3">
              <div class="flex justify-between text-xs mb-1">
                <span class="font-semibold text-neutral-200">${typeLabel(t)}</span>
                <span class="text-neutral-400">${qty.toLocaleString('tr-TR')} adet &mdash; %${pctTotal}</span>
              </div>
              <div style="height:20px;background:#374151;border-radius:4px;overflow:hidden">
                <div style="width:${pct}%;height:100%;background:${color};border-radius:4px"></div>
              </div>
            </div>`;
        });
        chartHtml += '</div>';
        typesContainer.insertAdjacentHTML('beforeend', chartHtml);

        let prodHtml = '<div class="p-3 bg-neutral-800 rounded"><div class="text-sm font-semibold text-neutral-300 mb-2">Ürün Bazlı Dağılım</div>';
        prodHtml += '<table style="width:100%;border-collapse:collapse"><thead><tr>';
        ['Tip', 'Ürün Kodu', 'Ürün Adı', 'Adet'].forEach(h => {
          prodHtml += `<th style="text-align:left;padding:4px 8px;color:#9ca3af;border-bottom:1px solid #374151;font-size:12px">${h}</th>`;
        });
        prodHtml += '</tr></thead><tbody>';
        productList.forEach(p => {
          const tk = typeKey(p.type);
          const color = TYPE_COLORS[tk] || '#6b7280';
          prodHtml += `<tr class="hover:bg-neutral-700">
            <td style="padding:4px 8px"><span style="background:${color};color:white;padding:1px 6px;border-radius:3px;font-size:10px">${escapeHtml(typeLabel(tk))}</span></td>
            <td style="padding:4px 8px;font-family:monospace;font-size:12px">${escapeHtml(p.productCode)}</td>
            <td style="padding:4px 8px;font-size:12px">${escapeHtml(p.productName)}</td>
            <td style="padding:4px 8px;text-align:right;font-weight:600;font-size:12px">${p.quantity.toLocaleString('tr-TR')}</td>
          </tr>`;
        });
        prodHtml += '</tbody></table></div>';
        typesContainer.insertAdjacentHTML('beforeend', prodHtml);
      }

      // === Faz 8: Devreden siparişler (Orders API) ===
      const carryoversContainer = container.querySelector('#daily-carryovers-container');
      const carryoversEl = container.querySelector('#daily-carryovers');
      if (carryoversContainer && carryoversEl) {
        carryoversContainer.style.display = 'block';
        carryoversEl.innerHTML = '<div class="text-xs text-neutral-400 animate-pulse">Devreden siparişler yükleniyor...</div>';
        try {
          let allOrders = [];
          let pg = 1;
          while (pg <= 5) {
            const or = await api.get(`/Orders/paged?pageNumber=${pg}&pageSize=100`);
            const od = ApiResponseHelpers.extractData(or);
            const items = (od && od.items) ? od.items : [];
            if (!items.length) break;
            allOrders = allOrders.concat(items);
            if (items.length < 100 || !od.hasNextPage) break;
            pg++;
          }

          const pending = allOrders
            .map(o => ({ ...o, remaining: (o.orderCount || 0) - (o.completedQuantity || 0) }))
            .filter(o => o.remaining > 0)
            .sort((a, b) => (b.carryover || 0) - (a.carryover || 0));

          const pyramidEl = container.querySelector('#daily-carryover-pyramid');
          const carryoverList = container.querySelector('#daily-carryover-list');
          const carryoverToggle = container.querySelector('#daily-carryover-toggle');
          if (carryoverList) { carryoverList.style.display = 'none'; delete carryoverList.dataset.populated; }

          if (pending.length === 0) {
            carryoversEl.innerHTML = '<div class="text-xs text-neutral-400 p-2">Devreden sipariş bulunamadı.</div>';
            if (pyramidEl) pyramidEl.innerHTML = '';
          } else {
            // Tipe göre özet kartlar
            const cByType = {};
            pending.forEach(o => {
              const t = typeKey(_productTypeCache[o.productCode] || '');
              if (!cByType[t]) cByType[t] = { count: 0, remaining: 0 };
              cByType[t].count++;
              cByType[t].remaining += o.remaining;
            });

            let summaryHtml = `<div class="text-xs text-neutral-400 mb-2">${pending.length} devreden sipariş</div><div class="grid grid-cols-2 gap-2 mb-2">`;
            Object.entries(cByType).forEach(([t, data]) => {
              const color = TYPE_COLORS[t] || '#6b7280';
              summaryHtml += `
                <div class="p-2 rounded" style="background:#1f2937;border-left:3px solid ${color}">
                  <div class="text-xs font-semibold" style="color:${color}">${typeLabel(t)}</div>
                  <div class="text-base font-bold text-neutral-200">${data.count} sipariş</div>
                  <div class="text-xs text-neutral-400">${data.remaining.toLocaleString('tr-TR')} kalan adet</div>
                </div>`;
            });
            summaryHtml += '</div>';
            carryoversEl.innerHTML = summaryHtml;

            // Gecikme haftası piramidi
            if (pyramidEl) {
              const wkGroups = {};
              pending.forEach(o => {
                const wk = o.carryover || 0;
                const k = wk >= 15 ? '15+' : String(wk);
                wkGroups[k] = (wkGroups[k] || 0) + 1;
              });
              const maxWk = Math.max(...Object.values(wkGroups), 1);
              const sortedWks = Object.keys(wkGroups).sort((a, b) =>
                (a === '15+' ? 999 : Number(a)) - (b === '15+' ? 999 : Number(b)));

              let pyHtml = '<div class="text-xs font-semibold text-neutral-400 mb-2">Gecikme Dağılımı (Hafta)</div>';
              pyHtml += '<div class="flex items-end gap-1" style="height:80px">';
              sortedWks.forEach(wk => {
                const cnt = wkGroups[wk];
                const h = Math.max(8, Math.round((cnt / maxWk) * 68));
                pyHtml += `<div class="flex flex-col items-center flex-1">
                  <div class="text-xs text-neutral-400 mb-1">${cnt}</div>
                  <div style="height:${h}px;width:100%;background:#ef4444;border-radius:2px 2px 0 0;cursor:pointer"
                       onclick="showCarryoverDetails('TÜM','${escapeHtml(wk)}')"
                       title="${escapeHtml(wk)} hafta: ${cnt} sipariş"></div>
                  <div class="text-xs text-neutral-500 mt-1">${escapeHtml(wk)}h</div>
                </div>`;
              });
              pyHtml += '</div>';
              pyramidEl.innerHTML = pyHtml;
            }

            // Toggle listesi
            if (carryoverToggle && carryoverList) {
              carryoverToggle.onclick = () => {
                const visible = carryoverList.style.display !== 'none';
                carryoverList.style.display = visible ? 'none' : 'block';
                carryoverToggle.textContent = visible ? 'Geciken Siparişleri Göster' : 'Geciken Siparişleri Gizle';
                if (!visible && !carryoverList.dataset.populated) {
                  carryoverList.innerHTML = generateCarryoverOrdersTable(pending, true);
                  carryoverList.dataset.populated = '1';
                }
              };
            }
          }
        } catch (e) {
          console.warn('Carryover orders load failed', e);
          carryoversEl.innerHTML = '<div class="text-xs text-rose-400 p-2">Devreden siparişler yüklenemedi.</div>';
        }
      }

      // === Faz 9: Sağ sütun — vardiya detay tablosu ===
      const shipmentsEl = container.querySelector('#daily-shipments');
      shipmentsEl.innerHTML = '';
      if (records.length > 0) {
        const tableCard = document.createElement('div');
        tableCard.className = 'p-3 bg-neutral-800 rounded';
        let html = '<div class="text-sm font-semibold text-neutral-300 mb-2">Vardiya Detayları</div>';
        html += '<div class="overflow-x-auto"><table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr>';
        ['Vardiya', 'Ürün Kodu', 'Ürün Adı', 'Adet', 'Kaynaktan', 'Hedefe', 'Sorumlu'].forEach(h => {
          html += `<th style="text-align:left;padding:4px 8px;color:#9ca3af;border-bottom:1px solid #374151">${h}</th>`;
        });
        html += '</tr></thead><tbody>';
        records.forEach(r => {
          html += `<tr class="hover:bg-neutral-700">
            <td style="padding:4px 8px">${escapeHtml(r.shift || '-')}</td>
            <td style="padding:4px 8px;font-family:monospace">${escapeHtml(r.productCode || '-')}</td>
            <td style="padding:4px 8px">${escapeHtml(r.productName || '-')}</td>
            <td style="padding:4px 8px;text-align:right">${r.quantity || 0}</td>
            <td style="padding:4px 8px">${escapeHtml(r.explodedFrom || '-')}</td>
            <td style="padding:4px 8px">${escapeHtml(r.explodingTo || '-')}</td>
            <td style="padding:4px 8px">${escapeHtml(r.supervisor || '-')}</td>
          </tr>`;
        });
        html += '</tbody></table></div>';
        tableCard.innerHTML = html;
        shipmentsEl.appendChild(tableCard);
      } else {
        shipmentsEl.innerHTML = '<div class="text-sm text-neutral-400 p-3">Sevkiyat kaydı bulunamadı.</div>';
      }

      container._lastDailyPayload = { date: dateIso, records, totalQty, byDest, byType, productList };

    } catch (err) {
      console.error('loadDaily error', err);
      showToast('Günlük rapor yüklenirken hata oluştu: ' + (err.message || ''), 'error');
      typesContainer.innerHTML = `<div class="text-rose-400 p-3">Hata: ${escapeHtml(err.message || 'Bilinmeyen hata')}</div>`;
    }
  }

  setDefaultDate();
  await loadDaily(dateInput.value);

  // Enter in date input triggers refresh
  dateInput.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const val = dateInput.value;
      if (!val) { showToast('Lütfen tarih seçin', 'warning'); return; }
      await loadDaily(val);
    }
  });

  // When the user picks a date (change event), auto-refresh immediately
  // debounce helper
  function debounce(fn, wait = 300) {
    let t = null;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), wait); };
  }

  const debouncedLoad = debounce(async (val) => {
    await loadDaily(val);
    try { localStorage.setItem('dailyReport.lastDate', val); } catch (e) {}
  }, 300);

  dateInput.addEventListener('change', async (e) => {
    const val = dateInput.value;
    if (!val) { return; }
    debouncedLoad(val);
  });

  // quick presets
  const btnY = container.querySelector('#daily-btn-yesterday');
  const btnT = container.querySelector('#daily-btn-today');
  if (btnY) btnY.addEventListener('click', () => { const d = new Date(); d.setDate(d.getDate()-1); dateInput.value = d.toISOString().slice(0,10); debouncedLoad(dateInput.value); });
  if (btnT) btnT.addEventListener('click', () => { const d = new Date(); dateInput.value = d.toISOString().slice(0,10); debouncedLoad(dateInput.value); });

  refreshBtn.addEventListener('click', async () => {
    const val = dateInput.value;
    if (!val) { showToast('Lütfen tarih seçin', 'warning'); return; }
    await loadDaily(val);
  });

  // Export helpers
  function generateCsv(payload) {
    if (!payload) return null;
    const rows = [];
    function esc(v) {
      if (v == null) return '';
      const s = String(v);
      if (s.includes(',') || s.includes('\n') || s.includes('"')) {
        return '"' + s.replace(/"/g, '""') + '"';
      }
      return s;
    }

    rows.push(['Günlük Paketleme Raporu', payload.date || ''].map(esc).join(','));
    rows.push(['Toplam Adet', payload.totalQty ?? 0].map(esc).join(','));
    rows.push(['Kayıt Sayısı', (payload.records || []).length].map(esc).join(','));
    rows.push([]);

    // Product breakdown
    rows.push(['Ürün Bazlı Dağılım'].map(esc).join(','));
    rows.push(['Ürün Kodu', 'Ürün Adı', 'Adet'].map(esc).join(','));
    (payload.productList || []).forEach(p => {
      rows.push([p.productCode || '', p.productName || '', p.quantity || 0].map(esc).join(','));
    });
    rows.push([]);

    // Destination breakdown
    rows.push(['Hedef Bazlı Dağılım'].map(esc).join(','));
    rows.push(['Hedef', 'Adet'].map(esc).join(','));
    Object.entries(payload.byDest || {}).forEach(([k, v]) => {
      rows.push([k, v].map(esc).join(','));
    });
    rows.push([]);

    // All records
    rows.push(['Tüm Kayıtlar'].map(esc).join(','));
    rows.push(['ID', 'Tarih', 'Vardiya', 'Ürün Kodu', 'Ürün Adı', 'Adet', 'Kaynaktan', 'Hedefe', 'Sorumlu'].map(esc).join(','));
    (payload.records || []).forEach(r => {
      rows.push([
        r.id || '',
        r.date ? new Date(r.date).toISOString().slice(0, 10) : '',
        r.shift || '',
        r.productCode || '',
        r.productName || '',
        r.quantity || 0,
        r.explodedFrom || '',
        r.explodingTo || '',
        r.supervisor || ''
      ].map(esc).join(','));
    });

    return rows.join('\r\n');
  }

  function exportCsv() {
    const payload = container._lastDailyPayload;
    if (!payload) { showToast('Export için veri yok', 'warning'); return; }
    const csv = generateCsv(payload);
    if (!csv) { showToast('CSV oluşturulamadı', 'error'); return; }
    const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const d = new Date(payload.date || Date.now());
    a.download = `daily_report_${d.toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showToast('CSV indirildi', 'success');
  }

  function exportPdf() {
    const payload = container._lastDailyPayload;
    if (!payload) { showToast('Export için veri yok', 'warning'); return; }
    const d = payload.date || new Date().toISOString().slice(0, 10);

    const productRows = (payload.productList || []).map(p =>
      `<tr><td>${escapeHtml(p.productCode || '')}</td><td>${escapeHtml(p.productName || '')}</td><td style="text-align:right">${p.quantity || 0}</td></tr>`
    ).join('');

    const destRows = Object.entries(payload.byDest || {}).map(([k, v]) =>
      `<tr><td>${escapeHtml(k)}</td><td style="text-align:right">${v}</td></tr>`
    ).join('');

    const html = `<html><head><title>Günlük Rapor ${d}</title>
      <style>body{font-family:Arial,Helvetica,sans-serif;color:#111;background:white} h2{margin-bottom:8px} table{border-collapse:collapse;width:100%;margin-bottom:16px} td,th{border:1px solid #ddd;padding:6px} th{background:#f5f5f5}</style>
      </head><body>
      <h2>Günlük Paketleme Raporu - ${d}</h2>
      <p><strong>Toplam Adet:</strong> ${payload.totalQty ?? 0} &nbsp;&nbsp; <strong>Kayıt Sayısı:</strong> ${(payload.records || []).length}</p>
      <h3>Ürün Bazlı Dağılım</h3>
      <table><thead><tr><th>Ürün Kodu</th><th>Ürün Adı</th><th>Adet</th></tr></thead><tbody>
        ${productRows || '<tr><td colspan="3">Veri yok</td></tr>'}
      </tbody></table>
      <h3>Hedef Bazlı Dağılım</h3>
      <table><thead><tr><th>Hedef</th><th>Adet</th></tr></thead><tbody>
        ${destRows || '<tr><td colspan="2">Veri yok</td></tr>'}
      </tbody></table>
      </body></html>`;
    const w = window.open('', '_blank');
    if (!w) { showToast('Pop-up engelleyici açık, PDF önizlemesi açılamadı', 'warning'); return; }
    w.document.write(html);
    w.document.close();
    w.focus();
  }

  // Wire export buttons
  const btnCsv = container.querySelector('#daily-export-csv');
  const btnPdf = container.querySelector('#daily-export-pdf');
  if (btnCsv) btnCsv.addEventListener('click', exportCsv);
  if (btnPdf) btnPdf.addEventListener('click', exportPdf);

  // Wire carryover details close button
  const detailsCloseBtn = container.querySelector('#carryover-details-close');
  if (detailsCloseBtn) {
    detailsCloseBtn.addEventListener('click', () => {
      const detailsContainer = container.querySelector('#carryover-details-container');
      if (detailsContainer) detailsContainer.style.display = 'none';
    });
  }

  // Global keyboard shortcuts (only when focus is not in an input)
  let _dailyGlobalKeyHandler = (e) => {
    const active = document.activeElement;
    const activeIsInput = active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable);
    if (activeIsInput) return; // avoid interfering with typing
    const key = (e.key || '').toLowerCase();
    if (key === 'y') {
      // yesterday
      const d = new Date(); d.setDate(d.getDate() - 1); dateInput.value = d.toISOString().slice(0,10); loadDaily(dateInput.value);
    } else if (key === 't') {
      const d = new Date(); dateInput.value = d.toISOString().slice(0,10); loadDaily(dateInput.value);
    } else if (key === 'r') {
      loadDaily(dateInput.value);
    }
  };
  window.addEventListener('keydown', _dailyGlobalKeyHandler);
}

export async function unmount(container) {
  try { const el = container.querySelector('#daily-report-container'); if (el) el.innerHTML = ''; } catch(e){}
  try { container.innerHTML = ''; } catch(e){}
  try { window.removeEventListener('keydown', _dailyGlobalKeyHandler); } catch(e) { /* ignore */ }
  try { delete window.showCarryoverDetails; } catch(e) { /* ignore */ }
  try { delete window.showAllCarryoverOrders; } catch(e) { /* ignore */ }
  try { delete window.toggleText; } catch(e) { /* ignore */ }
}
