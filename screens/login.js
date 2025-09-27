// Login screen module
import { showToast } from '../ui/simple-table.js';

export async function mount(container, { setHeader, onLogin }) {
  setHeader('Giriş', 'Kullanıcı girişi');
  container.innerHTML = `
    <div class="flex flex-col items-center justify-center min-h-[60vh]">
      <form id="login-form" class="bg-neutral-900 p-8 rounded-lg shadow-xl w-full max-w-sm space-y-6 border border-neutral-800">
        <h2 class="text-xl font-semibold mb-4 text-center text-neutral-200">Sisteme Giriş</h2>
        <div>
          <label class="block text-sm mb-1">Kullanıcı Adı</label>
          <input name="username" type="text" class="w-full px-3 py-2 rounded bg-neutral-800 text-neutral-100" required />
        </div>
        <div>
          <label class="block text-sm mb-1">Şifre</label>
          <input name="password" type="password" class="w-full px-3 py-2 rounded bg-neutral-800 text-neutral-100" required />
        </div>
        <button type="submit" class="w-full py-2 rounded bg-indigo-600 hover:bg-indigo-500 font-semibold">Giriş</button>
      </form>
    </div>
  `;
  const form = container.querySelector('#login-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = form.username.value.trim();
    const password = form.password.value;
    // Simple hardcoded check (replace with real auth if needed)
    if (username === 'admin' && password === '1234') {
      localStorage.setItem('isLoggedIn', '1');
      showToast('Giriş başarılı!', 'success');
      if (onLogin) onLogin();
    } else {
      showToast('Kullanıcı adı veya şifre yanlış', 'error');
    }
  });
}

export async function unmount(container) {
  container.innerHTML = '';
}
