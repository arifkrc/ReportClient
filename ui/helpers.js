// Core utility functions - Simplified and cleaned
import { showToast, showFormErrors, clearFormErrors } from './common-utils.js';

// Re-export core utilities
export { showToast, showFormErrors, clearFormErrors };

// Safe API call wrapper
export async function safeApiCall(apiMethod, ...args) {
  try {
    const result = await apiMethod(...args);
    return result;
  } catch (err) {
    console.error('API call failed:', err);
    showToast(`İşlem başarısız: ${err.message || 'Bilinmeyen hata'}`, 'error');
    return { ok: false, error: err.message || String(err) };
  }
}

// Safe delete with confirmation
export async function safeDelete(deleteMethod, itemId, itemName = 'kayıt') {
  try {
    const confirmed = await showConfirmDialog(`${itemName} silinecek. Emin misiniz?`);
    if (!confirmed) return { cancelled: true };

    const result = await deleteMethod(itemId);
    if (result && result.ok !== false) {
      showToast(`${itemName} başarıyla silindi`, 'success');
      return { ok: true };
    } else {
      throw new Error(result?.error || 'Silme işlemi başarısız');
    }
  } catch (err) {
    console.error('Delete error:', err);
    showToast(`Silme hatası: ${err.message}`, 'error');
    return { ok: false, error: err.message };
  }
}

// Simple confirmation dialog
function showConfirmDialog(message) {
  return new Promise((resolve) => {
    const confirmed = confirm(message);
    resolve(confirmed);
  });
}

// Time input helper for 24-hour format
export function setupTimeInput(input) {
  if (!input) return;
  
  input.addEventListener('input', function(e) {
    let value = e.target.value.replace(/[^\d]/g, '');
    
    if (value.length >= 3) {
      const hours = value.substring(0, 2);
      const minutes = value.substring(2, 4);
      
      const validHours = Math.min(parseInt(hours) || 0, 23).toString().padStart(2, '0');
      const validMinutes = Math.min(parseInt(minutes) || 0, 59).toString().padStart(2, '0');
      
      e.target.value = `${validHours}:${validMinutes}`;
    }
  });
}

// Setup all time inputs in a container
export function setupTimeInputs(container) {
  if (!container) return;
  const timeInputs = container.querySelectorAll('input[type="time"], input[data-time="true"]');
  timeInputs.forEach(setupTimeInput);
}