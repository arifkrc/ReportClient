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

export async function mount(container, opts = {}) {
  const setHeader = opts.setHeader || (() => {});
  setHeader('Günlük Rapor', 'Bugünün üretim özetleri');

  container.innerHTML = `
    <div class="p-4">
      <div class="flex items-center justify-between mb-4">
        <div>
          <h3 class="text-lg font-semibold">Günlük Rapor</h3>
          <div class="text-sm text-neutral-400">Günlük üretim özeti - API kaynak: /Reports/daily</div>
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

    const d = new Date();
    d.setDate(d.getDate() - 1); // default to 1 day ago
    dateInput.value = d.toISOString().slice(0,10);
  }

  async function loadDaily(dateIso) {
    try {
      typesContainer.innerHTML = '';
      // store payload for exports
      let lastPayload = null;
      const api = new ApiClient(APP_CONFIG.API.BASE_URL);
      // Call backend with ISO date (YYYY-MM-DD)
      const endpoint = `/Reports/daily?date=${encodeURIComponent(dateIso)}`;
      const res = await api.get(endpoint);
      let payload;
      try {
        payload = ApiResponseHelpers.extractData(res);
      } catch (err) {
        console.error('Reports/daily extractData error', res, err);
        showToast('Günlük rapor yüklenemedi: ' + (err.message || 'unknown'), 'error');
        return;
      }
      console.log('Reports/daily payload:', payload);
  // persist last payload for exports
  lastPayload = payload;
      // Debug: log basic counts
      console.log('Reports/daily production:', {
        hasProduction: !!payload.production,
        typeGroups: (payload.production && Array.isArray(payload.production.typeGroups)) ? payload.production.typeGroups.length : 0,
        shipments: Array.isArray(payload.shipments) ? payload.shipments.length : 0
      });
      const prod = payload.production || {};
      const total = prod.totalQuantity ?? prod.total ?? 0;
      const start = prod.startDate ? new Date(prod.startDate).toLocaleString() : '-';
      const end = prod.endDate ? new Date(prod.endDate).toLocaleString() : '-';

      // Write grouped totals UI
      container.querySelector('#daily-total').textContent = String(total);
      container.querySelector('#daily-range').textContent = `${start} — ${end}`;
  const shipmentTotals = payload.shipmentTotals || {};
  // Show only Domestic + Abroad totals (omit combined)
  const domesticTotals = shipmentTotals.domestic || {};
  const abroadTotals = shipmentTotals.abroad || {};
  const sumTotal = (domesticTotals.combinedTotal ?? domesticTotals.total ?? 0) + (abroadTotals.combinedTotal ?? abroadTotals.total ?? 0);
  container.querySelector('#daily-shipments-total').textContent = String(sumTotal ?? '-');
  const disk = (domesticTotals.diskTotal ?? 0) + (abroadTotals.diskTotal ?? 0);
  const kamp = (domesticTotals.kampanaTotal ?? 0) + (abroadTotals.kampanaTotal ?? 0);
  const poy = (domesticTotals.poyraTotal ?? 0) + (abroadTotals.poyraTotal ?? 0);
  container.querySelector('#daily-shipments-sub').textContent = `Disk: ${disk} · Kampana: ${kamp} · Poyra: ${poy}`;

      // Production by type: prefer production.typeGroups, fallback to productionTotals
      const groups = Array.isArray(prod.typeGroups) ? prod.typeGroups : [];
      typesContainer.innerHTML = '';
      // Render production type groups as simple cards with product rows
      if (groups.length) {
        groups.forEach(g => {
          const card = document.createElement('div');
          card.className = 'mb-3 p-3 bg-neutral-800 rounded';
          // subtle transition for background when expanded
          card.style.transition = 'background-color 180ms ease';
          const title = escapeHtml(g.typeName || '');
          const total = g.totalQuantity ?? 0;

          // header row: clickable label to toggle product list (with chevron)
          const header = document.createElement('div');
          header.className = 'flex items-center justify-between cursor-pointer';
          header.setAttribute('role', 'button');
          header.setAttribute('tabindex', '0');
          // chevron SVG placed on the left of the title
          const chevronHtml = `<span class="chev" style="display:inline-block;width:14px;height:14px;margin-right:8px;transition:transform .18s ease"><svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" width="14" height="14"><path d="M6 8l4 4 4-4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></span>`;
          header.innerHTML = `<div class="flex items-center"><span>${chevronHtml}</span><span class="text-sm text-neutral-400 font-semibold">${title}</span></div><div class="text-sm text-neutral-200 font-bold">${total}</div>`;

          // product list (hidden by default)
          const products = Array.isArray(g.products) ? g.products : [];
          const listWrap = document.createElement('div');
          listWrap.style.display = 'none';
          listWrap.className = 'mt-2 text-sm text-neutral-300';

          function renderProducts() {
            if (!products.length) {
              listWrap.innerHTML = `<div class="text-xs text-neutral-500">Detay yok</div>`;
              return;
            }
            let html = '<table style="width:100%;border-collapse:collapse"><thead><tr><th style="text-align:left;padding:4px">Kod</th><th style="text-align:left;padding:4px">Ürün</th><th style="text-align:right;padding:4px">Adet</th></tr></thead><tbody>';
            products.forEach(p => {
              html += `<tr><td style="padding:4px">${escapeHtml(p.productCode||'')}</td><td style="padding:4px">${escapeHtml(p.productName||'')}</td><td style="padding:4px;text-align:right">${p.quantity ?? 0}</td></tr>`;
            });
            html += '</tbody></table>';
            listWrap.innerHTML = html;
          }

          // toggle handler (lazy render on first expand)
          let rendered = false;
          function toggleList() {
            const chev = header.querySelector('.chev');
            if (listWrap.style.display === 'none') {
              if (!rendered) { renderProducts(); rendered = true; }
              listWrap.style.display = 'block';
              if (chev) chev.style.transform = 'rotate(90deg)';
              // highlight
              card.style.backgroundColor = '#0f1724';
            } else {
              listWrap.style.display = 'none';
              if (chev) chev.style.transform = 'rotate(0deg)';
              // remove highlight
              card.style.backgroundColor = '';
            }
          }

          header.addEventListener('click', toggleList);
          header.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); toggleList(); } });

          card.appendChild(header);
          card.appendChild(listWrap);
          typesContainer.appendChild(card);
        });
      } else if (payload.productionTotals) {
        // fallback simple totals card
        const pt = payload.productionTotals;
        const card = document.createElement('div');
        card.className = 'mb-3 p-3 bg-neutral-800 rounded';
        card.innerHTML = `<div class="flex items-center justify-between"><div class="text-sm text-neutral-400 font-semibold">Tip Bazlı Üretim (Özet)</div><div class="text-sm text-neutral-200 font-bold">Disk: ${pt.diskTotal ?? 0} · Kampana: ${pt.kampanaTotal ?? 0} · Poyra: ${pt.poyraTotal ?? 0}</div></div>`;
        typesContainer.appendChild(card);
      }
      const carry = Array.isArray(payload.carryoverCounts) ? payload.carryoverCounts : [];
      const pyramidEl = container.querySelector('#daily-carryover-pyramid');
      const carryListEl = container.querySelector('#daily-carryover-list');
      const carryToggle = container.querySelector('#daily-carryover-toggle');
      const carryoversEl = container.querySelector('#daily-carryovers');

      if (carry.length === 0) {
        if (carryoversEl) carryoversEl.innerHTML = '<div class="text-sm text-neutral-400">Carryover verisi yok</div>';
        if (pyramidEl) pyramidEl.innerHTML = '';
        if (carryListEl) carryListEl.innerHTML = '';
      } else {
        // Build a single grouped column chart (x-axis: 1..15+). Three series: Disk, Kampana, Poyra/Other.
        // Hide the badge/list views (we only show the chart as requested)
        if (carryoversEl) carryoversEl.style.display = 'none';
        if (carryListEl) carryListEl.style.display = 'none';
        if (carryToggle) carryToggle.style.display = 'none';

        // Normalize series
        function normalizeType(t) {
          if (!t) return 'Poyra';
          const s = String(t).toLowerCase();
          if (s.includes('disk')) return 'Disk';
          if (s.includes('kamp')) return 'Kampana';
          if (s.includes('poy')) return 'Poyra';
          // unknown types are grouped under Poyra to keep three series consistent
          return 'Poyra';
        }

        const seriesNames = ['Disk','Kampana','Poyra'];
        const seriesMap = { Disk: {}, Kampana: {}, Poyra: {} };

        // fill seriesMap with counts per carryoverValue
        carry.forEach(ct => {
          const name = normalizeType(ct.productType);
          const buckets = Array.isArray(ct.buckets) ? ct.buckets : [];
          buckets.forEach(b => {
            const v = b.carryoverValue;
            const key = (v >= 15) ? '15+' : String(v);
            seriesMap[name][key] = (seriesMap[name][key] || 0) + (b.count || 0);
          });
        });

        // build bucket labels 1..14 and 15+
        const bucketLabels = [];
        for (let i=1;i<=14;i++) bucketLabels.push(String(i));
        bucketLabels.push('15+');

        // compute max for scaling
        let globalMax = 0;
        bucketLabels.forEach(lbl => {
          seriesNames.forEach(sn => {
            const val = seriesMap[sn][lbl] || 0;
            if (val > globalMax) globalMax = val;
          });
        });
        if (globalMax === 0) globalMax = 1;

        // draw chart
        if (pyramidEl) {
          pyramidEl.innerHTML = '';
          const chartTitle = document.createElement('div');
          chartTitle.className = 'text-sm text-neutral-300 font-semibold mb-2';
          chartTitle.textContent = 'Carryover - 1..15+';
          pyramidEl.appendChild(chartTitle);

          const chartScroll = document.createElement('div');
          chartScroll.style.overflowX = 'auto';
          chartScroll.style.paddingBottom = '8px';
          const chartArea = document.createElement('div');
          chartArea.style.display = 'flex';
          chartArea.style.gap = '6px';
          chartArea.style.alignItems = 'flex-end';
          chartArea.style.height = '180px';
          // ensure inner area can grow horizontally when many buckets are shown
          chartArea.style.minWidth = '600px';

          // create left Y-axis container
          const axisWrap = document.createElement('div');
          axisWrap.style.display = 'flex';
          axisWrap.style.alignItems = 'flex-end';
          axisWrap.style.marginRight = '8px';
          axisWrap.style.flexDirection = 'column';
          axisWrap.style.justifyContent = 'space-between';
          axisWrap.style.height = '130px';
          axisWrap.style.width = '40px';
          axisWrap.style.paddingBottom = '6px';
          const maxTick = document.createElement('div'); maxTick.className = 'text-xs text-neutral-400'; maxTick.textContent = String(globalMax);
          const midTick = document.createElement('div'); midTick.className = 'text-xs text-neutral-400'; midTick.textContent = String(Math.ceil(globalMax/2));
          const zeroTick = document.createElement('div'); zeroTick.className = 'text-xs text-neutral-400'; zeroTick.textContent = '0';
          axisWrap.appendChild(maxTick); axisWrap.appendChild(midTick); axisWrap.appendChild(zeroTick);
          // add a thin grid column for alignment
          const gridCol = document.createElement('div');
          gridCol.style.width = '1px';
          gridCol.style.background = 'rgba(255,255,255,0.03)';
          gridCol.style.marginRight = '6px';
          // prepend axisWrap + gridCol to chartArea content via wrapper
          const origChildren = [];
          while (chartArea.firstChild) origChildren.push(chartArea.removeChild(chartArea.firstChild));
          chartArea.appendChild(axisWrap);
          chartArea.appendChild(gridCol);
          origChildren.forEach(c => chartArea.appendChild(c));

          const colors = { Disk: '#16a34a', Kampana: '#0ea5e9', Poyra: '#f97316', Other: '#94a3b8' };

          bucketLabels.forEach(lbl => {
            // compute total for this bucket to decide whether to show it
            const diskVal = seriesMap['Disk'][lbl] || 0;
            const kampVal = seriesMap['Kampana'][lbl] || 0;
            const poyVal = seriesMap['Poyra'][lbl] || 0;
            const bucketTotal = diskVal + kampVal + poyVal;
            if (bucketTotal === 0) {
              // skip zero columns to reduce clutter
              return;
            }

            const group = document.createElement('div');
            group.style.display = 'flex';
            group.style.flexDirection = 'column';
            group.style.alignItems = 'center';
            group.style.width = '48px'; // tighter group width for closer columns

            const barsRow = document.createElement('div');
            barsRow.style.display = 'flex';
            barsRow.style.alignItems = 'flex-end';
            barsRow.style.gap = '2px';
            barsRow.style.height = '130px';

            // create side-by-side columns for each series (Disk, Kampana, Poyra)
            seriesNames.forEach(sn => {
              const val = seriesMap[sn][lbl] || 0;
              // hide individual columns with zero count for clarity

              if (!val) {
                const spacer = document.createElement('div');
                spacer.style.width = '4px';
                spacer.style.height = '90px';
                barsRow.appendChild(spacer);
                return;
              }

              const col = document.createElement('div');
              col.style.display = 'flex';
              col.style.flexDirection = 'column';
              col.style.alignItems = 'center';
              col.style.width = '8px';

              // count above the column (only when >0)
              const topLabel = document.createElement('div');
              topLabel.className = 'text-xs text-neutral-200';
              topLabel.style.marginBottom = '6px';
              topLabel.textContent = String(val);

              // bar container
              const barOuter = document.createElement('div');
              barOuter.style.width = '100%';
              barOuter.style.height = '90px';
              // lighter container to improve contrast with column colors
              barOuter.style.background = '#0b1220';
              barOuter.style.borderRadius = '6px';
              barOuter.style.overflow = 'hidden';
              barOuter.style.display = 'flex';
              barOuter.style.alignItems = 'flex-end';
              barOuter.style.justifyContent = 'center';

              const barInner = document.createElement('div');
              const hPct = Math.round((val / globalMax) * 100);
              barInner.style.height = (hPct) + '%';
              barInner.style.width = '100%';
              barInner.style.background = colors[sn] || colors.Other;
              barInner.style.display = 'block';
              barInner.title = `${sn} ${lbl}: ${val}`;

              barOuter.appendChild(barInner);

              col.appendChild(topLabel);
              col.appendChild(barOuter);
              barsRow.appendChild(col);
            });

            const lblEl = document.createElement('div');
            lblEl.className = 'text-xs text-neutral-400 mt-2';
            lblEl.style.textAlign = 'center';
            lblEl.textContent = lbl;

            group.appendChild(barsRow);
            group.appendChild(lblEl);
            chartArea.appendChild(group);
          });

          chartScroll.appendChild(chartArea);
          pyramidEl.appendChild(chartScroll);

          // legend
          const legend = document.createElement('div');
          legend.className = 'mt-2 flex gap-4 text-sm items-center';
          seriesNames.forEach(sn => {
            const entry = document.createElement('div');
            entry.className = 'flex items-center gap-2';
            entry.innerHTML = `<span style="display:inline-block;width:12px;height:12px;background:${colors[sn]};border-radius:2px"></span><span>${sn}</span>`;
            legend.appendChild(entry);
          });
          pyramidEl.appendChild(legend);
        }
      }

      // toggle button for delayed list
      if (carryToggle && carryListEl) {
        carryToggle.onclick = () => {
          const shown = carryListEl.style.display !== 'none';
          carryListEl.style.display = shown ? 'none' : 'block';
          carryToggle.textContent = shown ? 'Geciken Siparişleri Göster' : 'Gizle';
        };
      }

      // Shipments grouped by type: combined/domestic/abroad
      const shipmentsEl = container.querySelector('#daily-shipments');
      shipmentsEl.innerHTML = '';
  const domestic = shipmentTotals.domestic || {};
  const abroad = shipmentTotals.abroad || {};
      const makeCard = (title, totals, count) => {
        const c = document.createElement('div');
        c.className = 'mb-3 p-3 bg-neutral-800 rounded flex items-center justify-between';
        c.innerHTML = `
          <div>
            <div class="flex items-center gap-2">
              <svg class="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7h2l.4 2M7 7h10l1 5H6l1-5zm4 10a2 2 0 100-4 2 2 0 000 4z"></path></svg>
              <div class="text-sm text-neutral-400">${escapeHtml(title)}</div>
            </div>
            <div class="text-sm text-neutral-500 mt-1">Disk: ${totals.diskTotal ?? 0} · Kampana: ${totals.kampanaTotal ?? 0} · Poyra: ${totals.poyraTotal ?? 0}</div>
          </div>
          <div class="text-right">
            <div class="text-lg font-bold">${totals.combinedTotal ?? 0}</div>
            <div class="text-xs text-neutral-500">${count} sevkiyat</div>
          </div>
        `;
        return c;
      };

      // count shipments per category (simple heuristic: payload.shipments may include flags)
      const shipments = Array.isArray(payload.shipments) ? payload.shipments : [];
      const cnt = { combined: 0, domestic: 0, abroad: 0 };
      shipments.forEach(s => {
        if (s.abroad) cnt.abroad++; else if (s.domestic) cnt.domestic++; else cnt.combined++;
      });

  // Only show Domestic and Abroad cards
  shipmentsEl.appendChild(makeCard('Yurtiçi (Domestic)', domestic, cnt.domestic));
  shipmentsEl.appendChild(makeCard('Yurtdışı (Abroad)', abroad, cnt.abroad));

  // expose lastPayload to outer scope for export buttons
  container._lastDailyPayload = payload;

    } catch (err) {
      console.error('loadDaily error', err);
      showToast('Günlük rapor yüklenirken hata oluştu', 'error');
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

    rows.push(['Date', payload.date || ''].map(esc).join(','));
    // production totals
    const prod = payload.production || {};
    rows.push(['Production Total', prod.totalQuantity ?? prod.total ?? 0].map(esc).join(','));
    // production per-type and products
    rows.push([]);
    rows.push(['Production by Type'].map(esc).join(','));
    rows.push(['Type','ProductCode','ProductName','Quantity'].map(esc).join(','));
    const groups = Array.isArray(prod.typeGroups) ? prod.typeGroups : [];
    if (groups.length) {
      groups.forEach(g => {
        const typeName = g.typeName || '';
        const products = Array.isArray(g.products) ? g.products : [];
        if (products.length) {
          products.forEach(p => {
            rows.push([typeName, p.productCode ?? '', p.productName ?? '', p.quantity ?? 0].map(esc).join(','));
          });
        } else {
          rows.push([typeName, '', '', g.totalQuantity ?? 0].map(esc).join(','));
        }
      });
    } else if (payload.productionTotals) {
      const pt = payload.productionTotals;
      rows.push(['Disk','', '', pt.diskTotal ?? 0].map(esc).join(','));
      rows.push(['Kampana','', '', pt.kampanaTotal ?? 0].map(esc).join(','));
      rows.push(['Poyra','', '', pt.poyraTotal ?? 0].map(esc).join(','));
    }

    rows.push([]);
    rows.push(['Shipments'].map(esc).join(','));
    rows.push(['Id','Date','Disk','Kampana','Poyra','Abroad','Domestic'].map(esc).join(','));
    const shipments = Array.isArray(payload.shipments) ? payload.shipments : [];
    shipments.forEach(s => {
      rows.push([
        s.id ?? '',
        s.date ? new Date(s.date).toISOString() : '',
        s.disk ?? 0,
        s.kampana ?? 0,
        s.poyra ?? 0,
        Boolean(s.abroad),
        Boolean(s.domestic)
      ].map(esc).join(','));
    });

    // totals at bottom
    const st = payload.shipmentTotals || {};
    const combined = st.combined || {};
    const domestic = st.domestic || {};
    const abroad = st.abroad || {};
    rows.push([]);
    // Show totals as Domestic+Abroad (omit Combined per request)
    const domTotal = domestic.combinedTotal ?? domestic.total ?? 0;
    const abTotal = abroad.combinedTotal ?? abroad.total ?? 0;
    rows.push(['Shipment Totals', 'Domestic', domTotal].map(esc).join(','));
    rows.push(['Shipment Totals', 'Abroad', abTotal].map(esc).join(','));

    // Add carryoverCounts into CSV
    const carry = Array.isArray(payload.carryoverCounts) ? payload.carryoverCounts : [];
    if (carry.length) {
      rows.push([]);
      rows.push(['Carryover Counts'].map(esc).join(','));
      rows.push(['ProductType','CarryoverValue','Count'].map(esc).join(','));
      carry.forEach(ct => {
        const buckets = Array.isArray(ct.buckets) ? ct.buckets : [];
        buckets.forEach(b => {
          rows.push([ct.productType || '', b.carryoverValue ?? '', b.count ?? 0].map(esc).join(','));
        });
      });
    }

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
    // build a simple printable HTML
    const d = new Date(payload.date || Date.now()).toISOString().slice(0,10);
    // prepare shipment total as Domestic + Abroad
    const st = payload.shipmentTotals || {};
    const domestic = st.domestic || {};
    const abroad = st.abroad || {};
    const domTotal = domestic.combinedTotal ?? domestic.total ?? 0;
    const abTotal = abroad.combinedTotal ?? abroad.total ?? 0;
    const shipmentsSum = domTotal + abTotal;

    // carryover summary as simple table
    const carryRows = (Array.isArray(payload.carryoverCounts) ? payload.carryoverCounts : []).map(ct => {
      const total = (Array.isArray(ct.buckets) ? ct.buckets : []).reduce((s,b)=> s + (b.count||0), 0);
      return `<tr><td>${escapeHtml(ct.productType||'')}</td><td style="text-align:right">${total}</td></tr>`;
    }).join('');

    const html = `
      <html><head><title>Günlük Rapor ${d}</title><style>body{font-family:Arial,Helvetica,sans-serif;color:#111;background:white} table{border-collapse:collapse;width:100%} td,th{border:1px solid #ddd;padding:6px}</style></head><body>
      <h2>Günlük Rapor - ${d}</h2>
      <div class="card"><strong>Üretim Toplam:</strong> ${payload.production?.totalQuantity ?? 0}</div>
      <div class="card"><strong>Sevkiyat Toplam (Domestic+Abroad):</strong> ${shipmentsSum}</div>
      <div class="card"><h3>Carryover Summary</h3>
        <table><thead><tr><th>Product Type</th><th style="text-align:right">Total Carryover</th></tr></thead><tbody>
        ${carryRows || '<tr><td colspan="2">No carryover data</td></tr>'}
        </tbody></table>
      </div>
      </body></html>
    `;
    const w = window.open('', '_blank');
    w.document.write(html);
    w.document.close();
    w.focus();
    // let user print to PDF via browser/Electron
  }

  // Wire export buttons
  const btnCsv = container.querySelector('#daily-export-csv');
  const btnPdf = container.querySelector('#daily-export-pdf');
  if (btnCsv) btnCsv.addEventListener('click', exportCsv);
  if (btnPdf) btnPdf.addEventListener('click', exportPdf);

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
}
