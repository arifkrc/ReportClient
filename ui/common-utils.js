// Ortak utility fonksiyonları
// helpers.js ve simple-table.js'teki duplikasyonu önlemek için

export function showToast(message, type = 'info') {
  try {
    const el = document.createElement('div');
    el.textContent = message;
    let bgClass = 'bg-neutral-700'; // default
    if (type === 'success') bgClass = 'bg-green-600';
    else if (type === 'error') bgClass = 'bg-rose-600';
    else if (type === 'warning') bgClass = 'bg-amber-600';
    
    el.className = `fixed bottom-6 right-6 px-4 py-2 rounded shadow z-50 ${bgClass}`;
    document.body.appendChild(el);
    setTimeout(() => {
      try { el.remove(); } catch(e) { /* element might be already removed */ }
    }, 4000);
  } catch (err) {
    console.error('showToast error:', err);
  }
}

export function showFormErrors(form, errors) {
  try {
    if (!form || !Array.isArray(errors)) return;
    clearFormErrors(form);
    
    errors.forEach(err => {
      if (!err.field || !err.msg) return;
      const field = form.querySelector(`[name="${err.field}"]`);
      if (!field) return;
      
      field.classList.add('border', 'border-rose-500');
      let note = field.parentElement.querySelector('.field-error');
      if (!note) {
        note = document.createElement('div');
        note.className = 'field-error text-rose-400 text-sm mt-1';
        field.parentElement.appendChild(note);
      }
      note.textContent = err.msg;
    });
  } catch (err) {
    console.error('showFormErrors error:', err);
  }
}

export function clearFormErrors(form) {
  try {
    if (!form) return;
    form.querySelectorAll('.field-error').forEach(n => n.remove());
    form.querySelectorAll('.border-rose-500').forEach(el => el.classList.remove('border', 'border-rose-500'));
  } catch (err) {
    console.error('clearFormErrors error:', err);
  }
}