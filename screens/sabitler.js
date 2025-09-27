export async function mount(container, { setHeader }) {
  setHeader('Sabitler', 'Sabit veri yönetimi (okuma)');
  container.innerHTML = `
    <div class="p-4">
     
      

      <div class="grid grid-cols-3 gap-4">
        <div class="p-3 bg-neutral-800 rounded">
          <h4 class="text-sm font-medium mb-2">Ürünler</h4>
          <p class="text-sm text-neutral-400 mb-2">Ürün listesine gitmek için:</p>
          <button id="go-urun" class="px-3 py-2 bg-indigo-600 rounded text-sm">Ürünlere Git</button>
        </div>
        <div class="p-3 bg-neutral-800 rounded">
          <h4 class="text-sm font-medium mb-2">Operasyonlar</h4>
          <p class="text-sm text-neutral-400 mb-2">Operasyon sabitlerini görüntüle:</p>
          <button id="go-operasyon" class="px-3 py-2 bg-indigo-600 rounded text-sm">Operasyonlara Git</button>
        </div>
        <div class="p-3 bg-neutral-800 rounded">
          <h4 class="text-sm font-medium mb-2">Çevrim Zamanları</h4>
          <p class="text-sm text-neutral-400 mb-2">Çevrim sabitlerini görüntüle:</p>
          <button id="go-cevrim" class="px-3 py-2 bg-indigo-600 rounded text-sm">Çevrim Zamanlarına Git</button>
        </div>
      </div>
    </div>
  `;

  // wire internal tab buttons and quick links
  container.querySelectorAll('.tabs .nav-btn').forEach(btn => btn.addEventListener('click', () => { const s = btn.dataset && btn.dataset.screen; if (s) location.hash = `#${s}`; }));
  container.querySelector('#go-urun').addEventListener('click', () => location.hash = '#urun');
  container.querySelector('#go-operasyon').addEventListener('click', () => location.hash = '#operasyon');
  container.querySelector('#go-cevrim').addEventListener('click', () => location.hash = '#cevrim');

  // highlight active child when rendering Sabitler
  function updateActiveChild() {
    const current = (location.hash || '#sabitler').replace('#','');
    container.querySelectorAll('.tabs .nav-btn').forEach(b => b.classList.toggle('bg-indigo-600', b.dataset && b.dataset.screen === current));
  }
  window.addEventListener('hashchange', updateActiveChild);
  updateActiveChild();
}

export async function unmount(container) {
  container.innerHTML = '';
}
