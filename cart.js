// ============================================================
// BAZARE — Cart System
// cart.js  (localStorage for guests, Firestore for logged-in)
// ============================================================

function getLocalCart() {
  try { return JSON.parse(localStorage.getItem('bazare_cart') || '[]'); }
  catch { return []; }
}

function saveLocalCart(cart) {
  localStorage.setItem('bazare_cart', JSON.stringify(cart));
  updateCartBadge();
}

// ── Add to Cart ──
function addToCart(product, btn = null) {
  requireAuth(async () => {
    const cart = getLocalCart();
    const existing = cart.find(i => i.id === product.id);

    if (existing) existing.qty = (existing.qty || 1) + 1;
    else cart.push({ ...product, qty: 1 });

    saveLocalCart(cart);

    if (btn) {
      const orig = btn.textContent;
      btn.textContent = '✓ যোগ হয়েছে';
      btn.style.background = '#f0b429';
      btn.style.color = '#000';
      setTimeout(() => {
        btn.textContent = orig;
        btn.style.background = '';
        btn.style.color = '';
      }, 1500);
    }

    showToast(`🛒 কার্টে যোগ হয়েছে`, 'success');
    updateCartBadge();
  });
}

// ── Remove from Cart ──
function removeFromCart(productId) {
  const cart = getLocalCart().filter(i => i.id !== productId);
  saveLocalCart(cart);
}

// ── Update Quantity ──
function updateQty(productId, qty) {
  const cart = getLocalCart();
  const item = cart.find(i => i.id === productId);
  if (!item) return;
  if (qty <= 0) removeFromCart(productId);
  else { item.qty = qty; saveLocalCart(cart); }
}

// ── Totals ──
function getCartCount() {
  return getLocalCart().reduce((s, i) => s + (i.qty || 1), 0);
}
function getCartTotal() {
  return getLocalCart().reduce((s, i) => s + (i.price * (i.qty || 1)), 0);
}

// ── Update Badge ──
function updateCartBadge() {
  const count = getCartCount();
  document.querySelectorAll('.cart-badge').forEach(el => {
    el.textContent = count;
    el.style.display = count > 0 ? 'flex' : 'none';
  });
}

document.addEventListener('DOMContentLoaded', updateCartBadge);