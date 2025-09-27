// Module-based renderer entry (ESM)
import { showToast } from './ui/helpers.js';

const content = document.getElementById('content');
const headerTitle = document.getElementById('screen-title');
const headerSub = document.getElementById('screen-sub');
const tabsContainer = document.querySelector('.tabs');
const logoutBtn = document.getElementById('logout');

// track current loaded module so we can unmount it before loading another
let currentModule = null;
let currentScreenName = null;

async function loadScreen(name) {
  if (!name) return;
  // if same screen, noop
  if (name === currentScreenName) return;

  headerTitle.textContent = name === 'uretim' ? '\u00dcretim' : name === 'paketleme' ? 'Paketleme' : name;
  headerSub.textContent = '';

  // if current module exports unmount, call it
  try {
    if (currentModule && typeof currentModule.unmount === 'function') {
      await currentModule.unmount(content);
    } else {
      // default: clear content
      content.innerHTML = '';
    }
  } catch (err) {
    console.warn('error during unmount', err);
  }

  content.innerHTML = '<div class="p-4 text-neutral-400">Y\u00fckleniyor...</div>';
  try {
    const module = await import(`./screens/${name}.js`);
    currentModule = module;
    currentScreenName = name;
    if (module && typeof module.mount === 'function') {
      await module.mount(content, { setHeader: (t, s) => { headerTitle.textContent = t; headerSub.textContent = s }});
    } else {
      content.innerHTML = '<div class="text-rose-400">Ekran y\u00fcklenemedi</div>';
    }
  } catch (err) {
    console.error('loadScreen error', err);
    const msg = (err && (err.message || String(err))) || 'Bilinmeyen hata';
    const stack = (err && err.stack) ? `<pre class="text-xs text-neutral-400 mt-2">${String(err.stack).replace(/</g,'&lt;')}</pre>` : '';
    content.innerHTML = `
      <div class="text-rose-400">
        <div class="font-semibold">Ekran yüklenirken hata oluştu:</div>
        <div class="mt-2">${msg}</div>
        ${stack}
        <div class="mt-3"><button id="copy-error" class="px-2 py-1 bg-neutral-800 rounded">Hata kopyala</button></div>
      </div>
    `;
    showToast('Ekran yükleme hatası: ' + msg, 'error');
    // wire copy button
    setTimeout(() => {
      const btn = document.getElementById('copy-error');
      if (btn) btn.addEventListener('click', async () => {
        try { await navigator.clipboard.writeText((err && err.stack) ? err.stack : msg); showToast('Hata panoya kopyalandı', 'success'); } catch(e) { showToast('Kopyalama başarısız', 'error'); }
      });
    }, 50);
  }
}

function setActiveNav(screen) {
  document.querySelectorAll('.nav-btn').forEach(b => {
    b.classList.toggle('bg-indigo-600', b.dataset && b.dataset.screen === screen);
  });
  // If the active screen is one of the Sabitler children, mark parent active
  const sabitlerChildren = ['urun','operasyon','cevrim'];
  const parent = document.getElementById('sabitler-parent');
  const caret = document.getElementById('sabitler-caret');
  const childrenWrap = document.getElementById('sabitler-children');
  if (parent) {
    const isChildActive = sabitlerChildren.includes(screen);
    parent.classList.toggle('bg-indigo-600', isChildActive);
    // ensure children visible when a child is active
    if (childrenWrap) childrenWrap.style.display = isChildActive ? '' : childrenWrap.style.display;
    if (caret) caret.style.transform = isChildActive ? 'rotate(180deg)' : 'rotate(0deg)';
  }

  // show persistent sabitler subnav when sabitler or its children are active
  const subnav = document.getElementById('sabitler-subtabs');
  if (subnav) {
    if (screen === 'sabitler' || sabitlerChildren.includes(screen)) {
      subnav.style.display = '';
    } else {
      subnav.style.display = 'none';
    }
    // highlight the matching child inside subnav
    subnav.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('bg-indigo-600', b.dataset && b.dataset.screen === screen));
  }
}

function navigateTo(screen) {
  if (!screen) screen = 'uretim';
  location.hash = `#${screen}`;
}

window.addEventListener('hashchange', () => {
  const screen = (location.hash || '#uretim').replace('#','');
  setActiveNav(screen);
  loadScreen(screen);
});

window.addEventListener('DOMContentLoaded', async () => {
  // login logic
  const isLoggedIn = localStorage.getItem('isLoggedIn') === '1';
  console.log('🔐 LOGIN CHECK:');
  console.log('localStorage isLoggedIn:', localStorage.getItem('isLoggedIn'));
  console.log('isLoggedIn boolean:', isLoggedIn);
  
  if (!isLoggedIn) {
    // hide tabs
    if (tabsContainer) tabsContainer.style.display = 'none';
    // load login screen
    const loginModule = await import('./screens/login.js');
    currentModule = loginModule;
    currentScreenName = 'login';
    await loginModule.mount(content, {
      setHeader: (t, s) => { headerTitle.textContent = t; headerSub.textContent = s; },
      onLogin: () => {
        localStorage.setItem('isLoggedIn', '1');
        if (tabsContainer) tabsContainer.style.display = '';
        // wire tab buttons under the header (so they work immediately after login)
        document.querySelectorAll('.tabs .nav-btn').forEach(btn => {
          btn.addEventListener('click', () => {
            const screen = btn.dataset && btn.dataset.screen;
            navigateTo(screen);
          });
        });

        // restore last screen from hash or localStorage and load it
        const initial = (location.hash || (localStorage.getItem('lastScreen') ? `#${localStorage.getItem('lastScreen')}` : '#uretim')).replace('#','');
        setActiveNav(initial);
        loadScreen(initial);

        // persist last screen on hash change
        window.addEventListener('hashchange', () => {
          const screen = (location.hash || '#uretim').replace('#','');
          try { localStorage.setItem('lastScreen', screen); } catch(e) {}
        });

        // keyboard shortcut: Ctrl+Tab -> next tab, Ctrl+Shift+Tab -> previous tab
        function handleCtrlTab(e) {
          if (!(e.ctrlKey || e.metaKey)) return;
          if (e.key !== 'Tab') return;
          e.preventDefault();
          const btns = Array.from(document.querySelectorAll('.tabs .nav-btn'));
          if (!btns.length) return;
          const screens = btns.map(b => b.dataset && b.dataset.screen).filter(Boolean);
          const current = currentScreenName || (location.hash ? location.hash.replace('#','') : screens[0]);
          const idx = Math.max(0, screens.indexOf(current));
          const forward = !e.shiftKey;
          const nextIdx = forward ? (idx + 1) % screens.length : (idx - 1 + screens.length) % screens.length;
          navigateTo(screens[nextIdx]);
        }
        window.addEventListener('keydown', handleCtrlTab);
        // wire Sabitler parent toggle after login
        const parentBtn = document.getElementById('sabitler-parent');
        const childrenWrap = document.getElementById('sabitler-children');
        const caret = document.getElementById('sabitler-caret');
        if (parentBtn && childrenWrap) {
          parentBtn.addEventListener('click', () => {
            const visible = childrenWrap.style.display !== 'none';
            childrenWrap.style.display = visible ? 'none' : '';
            if (caret) caret.style.transform = visible ? 'rotate(0deg)' : 'rotate(180deg)';
          });
        }
      }
    });
    return;
  } else {
    if (tabsContainer) tabsContainer.style.display = '';
  if (logoutBtn) logoutBtn.style.display = '';
    // wire tab buttons under the header
    document.querySelectorAll('.tabs .nav-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const screen = btn.dataset && btn.dataset.screen;
        navigateTo(screen);
      });
    });

    // wire Sabitler parent toggle
    const parentBtn = document.getElementById('sabitler-parent');
    const childrenWrap = document.getElementById('sabitler-children');
    const caret = document.getElementById('sabitler-caret');
    if (parentBtn && childrenWrap) {
      parentBtn.addEventListener('click', () => {
        const visible = childrenWrap.style.display !== 'none';
        childrenWrap.style.display = visible ? 'none' : '';
        if (caret) caret.style.transform = visible ? 'rotate(0deg)' : 'rotate(180deg)';
      });
    }

    // restore last screen from hash or localStorage
    const initial = (location.hash || (localStorage.getItem('lastScreen') ? `#${localStorage.getItem('lastScreen')}` : '#uretim')).replace('#','');
    setActiveNav(initial);
    loadScreen(initial);

    // persist last screen on hash change
    window.addEventListener('hashchange', () => {
      const screen = (location.hash || '#uretim').replace('#','');
      try { localStorage.setItem('lastScreen', screen); } catch(e) {}
    });

    // keyboard shortcut: Ctrl+Tab -> next tab, Ctrl+Shift+Tab -> previous tab
    function handleCtrlTab(e) {
      // support Ctrl (Windows) and Meta (Mac) as modifier
      if (!(e.ctrlKey || e.metaKey)) return;
      if (e.key !== 'Tab') return;
      e.preventDefault();
      const btns = Array.from(document.querySelectorAll('.tabs .nav-btn'));
      if (!btns.length) return;
      const screens = btns.map(b => b.dataset && b.dataset.screen).filter(Boolean);
      const current = currentScreenName || (location.hash ? location.hash.replace('#','') : screens[0]);
      const idx = Math.max(0, screens.indexOf(current));
      const forward = !e.shiftKey;
      const nextIdx = forward ? (idx + 1) % screens.length : (idx - 1 + screens.length) % screens.length;
      navigateTo(screens[nextIdx]);
    }
    window.addEventListener('keydown', handleCtrlTab);
    // wire logout
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        localStorage.removeItem('isLoggedIn');
        // reload to show login screen
        location.reload();
      });
    }
  }
});
