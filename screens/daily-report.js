import ApiClient from '../ui/core/api-client.js';
import { APP_CONFIG } from '../config/app-config.js';
import { createSimpleTable } from '../ui/simple-table.js';

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export async function mount(container, opts = {}) {
  const setHeader = opts.setHeader || (() => {});
  setHeader('Günlük Rapor', 'Bugünün üretim özetleri');
  // Use simple-table to render a proper table
  container.innerHTML = `
    <div class="p-4">
      <h3 class="text-lg font-semibold mb-2">Günlük Rapor</h3>
      <p class="text-sm text-neutral-400 mb-4">Bugün kaydedilen üretim kayıtları listeleniyor.</p>

      <div class="flex gap-2 items-center mb-3">
        <div>
          <button id="daily-today" class="px-2 py-1 bg-neutral-700 rounded text-sm">Today</button>
          <button id="daily-7days" class="px-2 py-1 bg-neutral-700 rounded text-sm">Last 7 days</button>
          <button id="daily-month" class="px-2 py-1 bg-neutral-700 rounded text-sm">This month</button>
        </div>
      </div>

      <div id="daily-table-container" class="bg-neutral-800 p-2 rounded"></div>
    </div>
  `;

  const tableContainer = container.querySelector('#daily-table-container');

  const table = createSimpleTable({
    apiBaseUrl: APP_CONFIG.API.BASE_URL,
    // use paged endpoint
    endpoints: { list: (APP_CONFIG.API.ENDPOINTS.PRODUCTION || '/uretim') + '/paged' },
    columns: [
      { field: 'date', header: 'Tarih', className: 'text-xs', sortable: true },
      { field: 'productCode', header: 'Ürün Kodu', className: 'font-mono', sortable: true },
      { field: 'productName', header: 'Ürün Adı', sortable: true },
      { field: 'operation', header: 'Operasyon', sortable: true },
      { field: 'quantity', header: 'Adet', className: 'text-right', sortable: true }
    ],
    title: 'Günlük Üretim',
    apiBaseUrl: APP_CONFIG.API.BASE_URL
  });

  tableContainer.appendChild(table);
  await table.init();

  // Summary containers
  const summaryWrap = document.createElement('div');
  summaryWrap.className = 'mb-4 grid grid-cols-3 gap-4';
  const producedCard = document.createElement('div'); producedCard.className = 'p-3 bg-neutral-800 rounded';
  const packedCard = document.createElement('div'); packedCard.className = 'p-3 bg-neutral-800 rounded';
  const overcycleCard = document.createElement('div'); overcycleCard.className = 'p-3 bg-neutral-800 rounded';
  producedCard.innerHTML = '<div class="text-sm text-neutral-400">Üretilen (toplam)</div><div id="produced-count" class="text-2xl font-bold">-</div>';
  packedCard.innerHTML = '<div class="text-sm text-neutral-400">Paketlenen (toplam)</div><div id="packed-count" class="text-2xl font-bold">-</div>';
  overcycleCard.innerHTML = '<div class="text-sm text-neutral-400">Overcycle Dağılımı</div><div id="overcycle-list" class="mt-2 text-sm text-neutral-300">-</div>';
  summaryWrap.appendChild(producedCard); summaryWrap.appendChild(packedCard); summaryWrap.appendChild(overcycleCard);
  container.querySelector('.p-4').insertBefore(summaryWrap, container.querySelector('#daily-table-container'));

  // element to show per-product comparison
  const compareWrap = document.createElement('div');
  compareWrap.className = 'mt-4 bg-neutral-800 p-2 rounded';
  container.querySelector('.p-4').insertBefore(compareWrap, container.querySelector('#daily-table-container'));

  async function loadSummary(startDate, endDate) {
    const api = new ApiClient(APP_CONFIG.API.BASE_URL);
    // build endpoints for list (paged) but we'll request all entries for the day by setting large pageSize
    const q = `?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}&pageNumber=1&pageSize=1000&status=active`;
    const prodEndpoint = (APP_CONFIG.API.ENDPOINTS.PRODUCTION || '/uretim') + '/paged' + q;
    const packEndpoint = (APP_CONFIG.API.ENDPOINTS.PACKAGING || '/paketleme') + '/paged' + q;

    try {
      const [pRes, pkRes] = await Promise.all([api.get(prodEndpoint), api.get(packEndpoint)]);
      const pData = pRes.success ? (Array.isArray(pRes.data) ? pRes.data : (pRes.data && Array.isArray(pRes.data.items) ? pRes.data.items : [])) : [];
      const pkData = pkRes.success ? (Array.isArray(pkRes.data) ? pkRes.data : (pkRes.data && Array.isArray(pkRes.data.items) ? pkRes.data.items : [])) : [];

      // compute totals
      const producedTotal = pData.reduce((s, r) => s + (Number(r.quantity) || 0), 0);
      const packedTotal = pkData.reduce((s, r) => s + (Number(r.quantity) || 0), 0);

      container.querySelector('#produced-count').textContent = producedTotal;
      container.querySelector('#packed-count').textContent = packedTotal;

      // compute per-product counts (optional)
      const producedByProduct = {};
      // keep list of production records per product for matching heuristics
      const prodRecordsByProduct = {};
      pData.forEach(r => {
        const code = (r.productCode||r.productcode||'').toString();
        if (!producedByProduct[code]) producedByProduct[code]=0;
        producedByProduct[code]+= Number(r.quantity)||0;
        if (!prodRecordsByProduct[code]) prodRecordsByProduct[code]=[];
        prodRecordsByProduct[code].push(r);
      });

      const packedByProduct = {};
      pkData.forEach(r => { const code = (r.productCode||r.productcode||'').toString(); if (!packedByProduct[code]) packedByProduct[code]=0; packedByProduct[code]+= Number(r.quantity)||0; });

      // compute overcycle distribution: look for fields like overcycle, overCycle, over_cycle, or cycleOver
      const overcycleCounts = new Map();
      pData.forEach(r => {
        const keys = Object.keys(r||{}).map(k=>k.toLowerCase());
        const ocKey = Object.keys(r||{}).find(k => ['overcycle','over_cycle','overcycletime','overcycletime','overcycleminutes','overcycle_min'].includes(k.toLowerCase()));
        let oc = null;
        if (ocKey) oc = Number(r[ocKey]);
        // fallback: some orders might have 'orderOverCycle' or 'overCycleCount' etc - try any numeric fields whose name contains 'over' and 'cycle'
        if (oc == null || isNaN(oc)) {
          for (const k of Object.keys(r||{})) {
            if (/over.*cycle/i.test(k) || /overcycle/i.test(k)) {
              const v = Number(r[k]); if (!isNaN(v)) { oc = v; break; }
            }
          }
        }
        if (oc == null || isNaN(oc)) return;
        const key = String(Math.max(0, Math.floor(oc)));
        overcycleCounts.set(key, (overcycleCounts.get(key)||0) + 1);
      });

  // render overcycle list
      const overEl = container.querySelector('#overcycle-list');
      if (!overEl) return;
      if (overcycleCounts.size === 0) {
        overEl.textContent = 'Overcycle bilgisi yok';
      } else {
        const rows = Array.from(overcycleCounts.entries()).sort((a,b)=>Number(a[0])-Number(b[0])).map(([k,v])=>`<div>${k} kez overcycle: <strong>${v}</strong></div>`).join('');
        overEl.innerHTML = rows;
      }

      // Build product-level comparison table
      const allProductCodes = new Set([...Object.keys(producedByProduct), ...Object.keys(packedByProduct)]);
      const rows = [];
      allProductCodes.forEach(code => {
        if (!code) return; // skip empty codes
        const producedTotal = producedByProduct[code] || 0;
        const packedTotal = packedByProduct[code] || 0;

        // producedMatchingOp: sum of production records where operation matches a 'lastOperation' field on the record (heuristic)
        let producedMatchingOp = 0;
        const recs = prodRecordsByProduct[code] || [];
        if (recs.length) {
          recs.forEach(r => {
            const lastOpKey = Object.keys(r||{}).find(k => /last.?operation|lastop|last_operation/i.test(k));
            if (lastOpKey) {
              if (String((r.operation||'')).toUpperCase() === String((r[lastOpKey]||'')).toUpperCase()) {
                producedMatchingOp += Number(r.quantity) || 0;
              }
            } else {
              // if no lastOp field exist on records, count all production as matching
              producedMatchingOp += Number(r.quantity) || 0;
            }
          });
        }

        rows.push({ productCode: code, produced: producedTotal, producedMatchingOp, packed: packedTotal, diff: producedTotal - packedTotal });
      });

      // render comparison table
      if (rows.length === 0) {
        compareWrap.innerHTML = '<div class="text-sm text-neutral-400">Ürün bazlı veri bulunamadı.</div>';
      } else {
        const tableHtml = [`<div class="text-sm text-neutral-400 mb-2">Ürün bazlı karşılaştırma</div>`,`<div class="overflow-x-auto"><table class="w-full text-sm"><thead><tr><th class="text-left p-2">Ürün Kodu</th><th class="text-right p-2">Üretilen</th><th class="text-right p-2">(Eşleşen Operasyon)</th><th class="text-right p-2">Paketlenen</th><th class="text-right p-2">Fark</th></tr></thead><tbody>`];
        rows.sort((a,b)=>a.productCode.localeCompare(b.productCode)).forEach(r => {
          tableHtml.push(`<tr class="border-t border-neutral-700"><td class="p-2">${escapeHtml(r.productCode)}</td><td class="p-2 text-right">${r.produced}</td><td class="p-2 text-right">${r.producedMatchingOp}</td><td class="p-2 text-right">${r.packed}</td><td class="p-2 text-right">${r.diff}</td></tr>`);
        });
        tableHtml.push('</tbody></table></div>');
        compareWrap.innerHTML = tableHtml.join('');
      }

    } catch (err) {
      console.error('daily-report summary load error', err);
      const overEl = container.querySelector('#overcycle-list'); if (overEl) overEl.textContent = 'Özet yüklenemedi';
    }
  }

  // initialize summary for today
  const d = new Date(); const iso = d.toISOString().slice(0,10);
  await loadSummary(iso, iso);

  function applyRange(startDate, endDate) {
    // server expects startDate/endDate in YYYY-MM-DD
    table.reload({ page: 1, pageSize: 20, startDate, endDate });
  }

  container.querySelector('#daily-today').addEventListener('click', () => {
    const d = new Date();
    const iso = d.toISOString().slice(0,10);
    applyRange(iso, iso);
  });
  container.querySelector('#daily-7days').addEventListener('click', () => {
    const to = new Date();
    const from = new Date(); from.setDate(to.getDate() - 6);
    applyRange(from.toISOString().slice(0,10), to.toISOString().slice(0,10));
  });
  container.querySelector('#daily-month').addEventListener('click', () => {
    const to = new Date();
    const from = new Date(to.getFullYear(), to.getMonth(), 1);
    applyRange(from.toISOString().slice(0,10), to.toISOString().slice(0,10));
  });
}

export async function unmount(container) {
  try { const el = container.querySelector('#daily-report-container'); if (el) el.innerHTML = ''; } catch(e){}
  try { container.innerHTML = ''; } catch(e){}
}
